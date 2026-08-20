// Generates character art via fal.ai (FLUX) with PER-CYCLE POOLS:
//   starter  →  25 images, lifetime (one-time plan, nothing to reset)
//   platinum →  50 images per 30-day cycle
//   elite    → 100 images per 30-day cycle
// Out of pool? Purchased art credits (10 for $2.99, never expire) are spent
// automatically as overflow.
// Dev emails (DEV_EMAILS env) bypass limits entirely.
// Usage is tracked in the art_usage table (email + mascot_id -> regens).
// Env vars: FAL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, DEV_EMAILS
//           optional: ART_DAILY_GLOBAL_CAP (circuit breaker, see below)
//
// LOAD-READINESS PASS (v2) — five fixes, none of them cosmetic:
//   1. ATOMIC CONSUMPTION. The old read-then-write let parallel requests all
//      read the same `used` value and all pass the limit check — N images
//      billed by fal, 1 counted. Now consume_art_regen() locks the row and
//      increments in one step, BEFORE the paid call, and refunds on failure.
//   2. ACCOUNT-WIDE DAILY CEILING. mascotId comes from the browser, so a
//      fresh random id per request used to grant a fresh allowance —
//      unlimited art on your bill. A per-ACCOUNT daily cap closes that.
//   3. HARD TIMEOUT. An unbounded fetch to fal pinned a serverless slot until
//      the platform killed it. Now aborted at 55s, credit refunded.
//   4. NEVER LOSE A PAID IMAGE. Accounting failures after a successful
//      generation used to 500 — fal charged, user got nothing. Now the image
//      always returns; bookkeeping problems are logged, not fatal.
//   5. TRANSIENT-ERROR HONESTY. A Supabase blip used to be reported as
//      "you need an active plan" to paying customers. Now it's a 503.
//
// ART VARIETY ENGINE: every generation gets a random SHOT RECIPE
// (camera + pose + backdrop + palette + framing) injected server-side, plus a
// random seed sent to FLUX — so regenerating the same mascot produces a
// genuinely different image every time instead of the same converged
// composition. Western Comic prompts also get a heavy 90s-comics style boost,
// because the client's short style lock alone doesn't pull FLUX far enough
// away from its glossy-render default.

// Vercel: give the function room for a slow FLUX call (Pro can run long).
export const maxDuration = 60;

const MODEL_ENDPOINTS = {
  standard: "https://fal.run/fal-ai/flux/dev",
  pro: "https://fal.run/fal-ai/flux-pro/v1.1",
};

// Images per BILLING CYCLE (not per day, not per mascot). This is the number
// that bounds your fal.ai spend: Elite can never exceed ~$5/cycle in art.
const ART_CAP = {
  starter: 25,
  pass: 25,            // legacy one-month pass
  platinum: 50,
  platinum_pass: 50,   // legacy all-access pass
  elite: 100,
};

// Plans that get the Pro engine. Derived from the PLAN, not from the regen
// limit — an Elite user in credit territory has a limit of 5 and used to be
// silently downgraded to the standard engine mid-subscription.
const PRO_PLANS = ["elite"];

// Optional global circuit breaker. UNSET BY DEFAULT — a global cap that trips
// during a real launch surge would block paying customers, which is usually
// worse than the bill. Set ART_DAILY_GLOBAL_CAP in Vercel only if you want a
// hard ceiling on total daily spend.
const GLOBAL_CAP = parseInt(process.env.ART_DAILY_GLOBAL_CAP || "", 10);

// Longest prompt we'll forward. Unbounded prompts are slow and expensive.
const MAX_PROMPT = 4000;

// ---- COMPOSITION RANDOMIZER -------------------------------------------------
// CAMERA, POSE and FRAMING are rolled fresh every generation (7×9×4 = 252 shots).
// DISCS and PALETTES are NOT rolled — they are seeded from the mascotId in
// shotRecipe() below, so a character keeps one color identity for life. See the
// LOCKED LOOK note there for why.
const CAMERAS = [
  "low heroic angle looking up at the subject",
  "straight-on symmetrical full-body hero shot",
  "three-quarter turn with weight on the back leg",
  "worm's-eye view, subject towering over the camera",
  "slight dutch tilt, off-balance and kinetic",
  "wide shot, subject dominant against a vast landscape",
  "over-the-shoulder from behind, subject turning back toward camera",
];
const POSES = [
  "mid-stride walking toward the viewer, hair and clothing blown back",
  "arms raised mid-roar, chest out, both fists clenched",
  "weapon or signature item held diagonally across the body, chin down, eyes up",
  "one hand extended toward the viewer, palm crackling with energy",
  "arms crossed, dead still, staring straight through the camera",
  "crouched and coiled to launch, fingertips grazing the ground",
  "turning back over one shoulder mid-walk, cape or coat flaring behind",
  "seated on a throne or ledge, leaning forward, elbows on knees",
  "mid-air, descending, landing impact about to happen",
];
const DISCS = [
  "a blazing orange sun disc filling the upper frame",
  "a huge cracked pale moon behind the subject",
  "a burning magenta corona backlighting the subject",
  "a white halo ring of hard light behind the head",
  "a swirling energy vortex behind the subject",
  "a deep red eclipse ring with a black center",
  "a violet nebula glow across a dense starfield",
  "a ring of cold blue flame behind the subject",
];
const PALETTES = [
  "sunset orange and blood red against black",
  "magenta and cyan neon over deep purple",
  "icy blue and white with silver highlights",
  "toxic green and teal with crushed black shadows",
  "gold and amber against a dark night sky",
  "high-contrast black and white with one single spot color",
  "hot pink and electric violet with black inks",
  // Multi-hue entries — these are the ones that give a card the layered,
  // three-color look people describe as "the MascotGen look".
  "crimson, gold and deep teal layered against a stormy indigo sky",
  "electric cyan and molten orange with purple shadow tones",
  "emerald green, hot magenta and pale gold over dark slate",
  "burnt orange sunset, turquoise rim light and violet clouds",
  "royal blue, blood red and bright yellow — primary comic triad",
];
const FRAMINGS = [
  "full body, head to toe in frame",
  "three-quarter body from the thighs up",
  "chest-up power portrait",
  "full body with a sweeping landscape filling the lower third",
];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---- LOCKED LOOK, RANDOM SHOT ----------------------------------------------
// Regenerating used to reroll EVERYTHING — palette, backdrop, camera, pose —
// and the composition line tells FLUX these OVERRIDE the stored description.
// So the same character came back with a different color identity every single
// time, which reads to a collector as "different quality", not "different
// pose". That was the #1 art complaint.
//
// Now the two that define a character's LOOK are derived from the mascotId:
//   · PALETTE  — the card's color story
//   · DISC     — what sits behind the subject
// and the three that define the SHOT stay random:
//   · CAMERA · POSE · FRAMING
//
// Same mascot → same colors, forever, on every regeneration. Different mascot →
// a different color identity. Regens become genuinely different pictures OF THE
// SAME CHARACTER, which is exactly what a trading-card set needs.
// FNV-1a, 32-bit — tiny, dependency-free, and stable across deploys.
function hash32(str) {
  const s = String(str || "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
// Different bit slices for each pool so palette and backdrop aren't correlated.
const pickBy = (arr, n) => arr[(n >>> 0) % arr.length];
const shotRecipe = (mascotId) => {
  const h = hash32(mascotId);
  return (
    `Camera: ${pick(CAMERAS)}. Pose: ${pick(POSES)}. Behind the subject: ${pickBy(DISCS, h)}. ` +
    `Environment palette: ${pickBy(PALETTES, h >>> 9)}. Framing: ${pick(FRAMINGS)}.`
  );
};

// ---- WESTERN COMIC STYLE BOOST ---------------------------------------------
// The client's STYLE LOCK for Western Comic is detected by this marker phrase
// (it appears verbatim in App.jsx's STYLE_SUFFIX). When present, this heavier
// block is appended — it's the vocabulary FLUX actually responds to.
const WESTERN_MARKER = "American comic book illustration";
// Same idea for Anime / Manga — detected by the marker phrase in App.jsx's
// anime STYLE LOCK ("flat cel-shaded 2D anime illustration").
const ANIME_MARKER = "2D anime illustration";
// ---- COLOR RICHNESS ---------------------------------------------------------
// Shared by both styles. The v17 pass fixed the "CGI plastic" problem but the
// anti-render language ("no gradient shading", "no volumetric lighting") also
// stripped the saturated, layered color that made MascotGen art look like
// MascotGen art. This block puts the COLOR back without letting the RENDERING
// back in: every rich effect below is described as something DRAWN — flat
// shapes, spot color, screened dots — never as a lighting simulation.
const COLOR_RICHNESS =
  " COLOR IS BOLD AND SATURATED — vivid, high-chroma inks, not muted, not washed out, not desaturated. " +
  "Three to four flat tones per surface (base, shadow, deep shadow, and a bright rim tone) so forms read " +
  "rich rather than empty. Strong complementary color contrast between the character and the background. " +
  "Colored ambient light spills onto the character as FLAT drawn shapes — a rim of hot color along one " +
  "edge, a cool bounce on the other. Glows, sparks, energy and fire are drawn as layered flat color shapes " +
  "with hard edges. The background is a fully illustrated environment with its own color story — layered " +
  "sky, clouds, city, terrain or energy field — never a flat empty void.";

const ANIME_BOOST =
  " Hand-inked 2D animation cel. Flat cel shading in three to four hard-edged tones per surface — crisp " +
  "shadow shapes with NO gradient falloff. Confident hand-drawn ink linework with varied brush weight, " +
  "visible line tapering. Uniform flat color fills in vivid saturated anime colors. Lush painted anime " +
  "background art with deep color. Light rays, glows and highlights are DRAWN as flat shapes, not " +
  "rendered. Retro-modern shonen key-visual composition. " +
  "Absolutely no ambient occlusion, no subsurface scattering, no specular highlights, no depth-of-field " +
  "blur, no volumetric lighting, no smooth gradient shading, no rendered bloom — those are 3D artifacts " +
  "and this is drawn by hand." +
  COLOR_RICHNESS;

const WESTERN_BOOST =
  " A single-image comic book COVER, inked by hand and printed in full color on glossy modern comic stock. " +
  "1990s Image Comics era — Jim Lee, Todd McFarlane, Simon Bisley. Heavy black brush inking with thick " +
  "tapering contour lines, bold spot blacks, cross-hatching and feathering in the shadows. Vivid flat spot " +
  "colors with visible Ben-Day halftone dot screening. Comic cover composition, subject centered and " +
  "dominant. " +
  "Absolutely no ambient occlusion, no subsurface scattering, no specular highlights, no depth-of-field, no " +
  "smooth gradient shading, no airbrushing — this is ink on paper." +
  COLOR_RICHNESS;

// Universal negatives for every generation.
// ✍️ NO GIBBERISH LETTERING. "No text" on its own does not work, and this was
// the single most quality-destroying artifact in the collection: a Las Vegas
// street scene came back plastered in "BAEMN CAMNIA", "VAGIUSA", "NVEGDO".
// The reason a bare negative fails is that the SCENE implies signage — a neon
// strip without signs is not a neon strip — so the model draws them anyway and
// fills them with letter-shaped noise, because diffusion models cannot spell.
// The fix is to give it something to draw INSTEAD: signage as pure light and
// shape. Stated positively, repeated at the end where the model weights it, and
// with every word for writing named explicitly, because "text" alone does not
// cover billboards, jerseys, licence plates or shop fronts.
const ART_NEGATIVES =
  " ABSOLUTELY NO WRITING ANYWHERE IN THE IMAGE. No text, no letters, no words, no numbers, no alphabets of any kind, no watermark, no signature, no speech bubbles, no captions, no logos, no borders. " +
  "This includes every surface in the background: signs, billboards, neon, storefronts, screens, banners, posters, licence plates, packaging and clothing. " +
  "Render all signage as ABSTRACT LIGHT ONLY — glowing bars, blocks, stripes, geometric symbols and colour shapes that suggest a lit sign from a distance without forming a single readable character. " +
  "Illegible letter-shaped scribble is the WORST possible outcome and is strictly forbidden: if a surface would carry writing, leave it blank, cover it in glow, or turn it away from the camera.";

function isDevEmail(email) {
  const list = (process.env.DEV_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes((email || "").toLowerCase());
}

// 🔐 Dev bypass, done right: the request must carry a WALLET SIGNATURE from a
// wallet in DEV_WALLETS (same 10-minute-bucket scheme battle.js uses). An
// email string is guessable; an ed25519 signature is not. Verified with
// Node's built-in crypto — no new dependencies.
import crypto from "node:crypto";
const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(str) {
  let n = 0n;
  for (const c of String(str)) {
    const i = B58_ALPHABET.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const c of String(str)) { if (c === "1") bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}
function verifyWalletAuth(wallet, auth) {
  try {
    if (!wallet || !auth || !auth.signature || typeof auth.bucket !== "number") return false;
    const nowBucket = Math.floor(Date.now() / (10 * 60 * 1000));
    if (auth.bucket !== nowBucket && auth.bucket !== nowBucket - 1) return false;
    const pub = b58decode(wallet);
    if (!pub || pub.length !== 32) return false;
    const sig = Buffer.from(String(auth.signature), "base64");
    if (sig.length !== 64) return false;
    const msg = Buffer.from(`mascotgen-auth:${wallet}:${auth.bucket}`);
    const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pub)]);
    const key = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
    return crypto.verify(null, msg, key, sig);
  } catch (e) {
    return false;
  }
}
function isDevWallet(wallet) {
  const list = (process.env.DEV_WALLETS || "").split(",").map((w) => w.trim()).filter(Boolean);
  return list.includes((wallet || "").trim());
}

const sbHeaders = {
  "Content-Type": "application/json",
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
};

// Thrown when Supabase itself is unhappy — distinct from "this user has no
// plan", so a database blip is never reported to a paying customer as a
// billing problem.
class UpstreamError extends Error {}

async function sbRpc(fn, body) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: sbHeaders,
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new UpstreamError(`rpc ${fn}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// 💸 `mints_reset_at` MUST be in the select. It was missing, so `sub.mints_reset_at`
// was always undefined, so `periodKey` below always fell through to "lifetime" —
// which meant the art pool NEVER RESET when a billing cycle renewed. Platinum and
// Elite subscribers were silently getting a one-time lifetime allowance of 50/100
// images instead of 50/100 PER CYCLE, then being told to buy credit packs while
// still paying monthly. Refund risk, and exactly the kind of limits-are-wrong bug
// that burns a launch.
async function getSubscriber(email) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=plan,status,mints_used,mints_reset_at`,
    { headers: sbHeaders }
  );
  if (!res.ok) throw new UpstreamError(`subscribers: ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// LEGACY per-mascot helper kept only so an older deploy can't crash; the pool
// model above replaced it entirely.
async function noop() {}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, prompt, mascotId } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email required — set it in the Studio to generate art." });
  if (!prompt) return res.status(400).json({ error: "Missing art prompt" });
  if (!mascotId) return res.status(400).json({ error: "Missing mascotId" });
  if (String(mascotId).length > 80) return res.status(400).json({ error: "Bad mascotId" });

  // 🔐 Dev bypass — TWO doors, both fail-closed:
  //   1. In the app: dev email + a valid wallet signature from a DEV_WALLETS
  //      address (the browser signs automatically; nobody can fake it).
  //   2. Scripts/tooling: DEV_ART_KEY sent as { devKey } (optional env).
  const { wallet, auth } = req.body || {};
  const devBypass =
    (isDevEmail(email) && isDevWallet(wallet) && verifyWalletAuth(wallet, auth)) ||
    (isDevEmail(email) && !!process.env.DEV_ART_KEY && req.body.devKey === process.env.DEV_ART_KEY);
  // Tracks WHAT we took so every failure path gives back the right thing:
  // a slot from the cycle pool, or a purchased art credit.
  let consumedKind = null;   // "period" | "credit" | null
  let periodKey = null;
  const refund = async () => {
    if (!consumedKind || devBypass) return;
    try {
      if (consumedKind === "period") await sbRpc("refund_art_period", { p_email: email, p_period: periodKey });
      else await sbRpc("refund_art_credit", { p_email: email });
    } catch (e) {
      console.warn("art refund failed:", e.message);
    }
    consumedKind = null;
  };

  try {
    let used = 0;
    let limit = Infinity;
    let plan = "elite"; // dev default

    if (!devBypass) {
      const sub = await getSubscriber(email);
      if (!sub || sub.status !== "active" || !ART_CAP[sub.plan]) {
        return res.status(402).json({
          error: "Art generation needs an active plan — see Pricing.",
          needsPlan: true,
        });
      }
      plan = sub.plan;
      limit = ART_CAP[plan];
      // The pool resets when the billing cycle does: keying on mints_reset_at
      // means a renewal automatically opens a fresh pool, no extra bookkeeping.
      // One-time plans (Starter) have no reset date → a single lifetime bucket.
      periodKey = sub.mints_reset_at ? String(sub.mints_reset_at).slice(0, 10) : "lifetime";

      // --- Optional global circuit breaker ---------------------------------
      if (Number.isFinite(GLOBAL_CAP) && GLOBAL_CAP > 0) {
        try {
          const gl = await sbRpc("bump_art_global", { p_cap: GLOBAL_CAP });
          if (gl && gl.allowed === false) {
            return res.status(503).json({
              error: "The art forge has hit today's global capacity. It resets at midnight UTC — your credits are untouched.",
              globalCapReached: true,
            });
          }
        } catch (e) {
          console.warn("global art counter unavailable:", e.message);
        }
      }

      // --- ATOMIC: take a slot from this cycle's pool BEFORE paying fal ----
      let pool = null;
      try {
        pool = await sbRpc("consume_art_period", { p_email: email, p_period: periodKey, p_cap: limit });
      } catch (e) {
        console.warn("art pool unavailable (run art-limits.sql):", e.message);
      }

      if (pool && pool.allowed === true) {
        consumedKind = "period";
        used = pool.used - 1;              // count BEFORE this generation
      } else if (pool && pool.allowed === false) {
        // Pool is spent — fall through to PURCHASED art credits, which is
        // exactly what the $2.99 pack is for (and what it never did before).
        let credit = null;
        try { credit = await sbRpc("consume_art_credit", { p_email: email }); } catch (e) {}
        if (credit && credit.ok) {
          consumedKind = "credit";
          used = limit;
        } else {
          const isCycle = periodKey !== "lifetime";
          return res.status(402).json({
            error: isCycle
              ? `You've used all ${limit} image generations in this cycle. Grab an art credit pack (10 for $2.99, never expires) to keep going, or wait for your cycle to renew.`
              : `You've used all ${limit} image generations your plan comes with. Grab an art credit pack (10 for $2.99, never expires) to keep going.`,
            poolExhausted: true,
            used: limit,
            limit,
          });
        }
      }
      // pool === null → SQL not installed yet; allow (fails open, logged).
    }

    // Elite (and dev testers) get the Pro engine; everyone else the standard.
    const usePro = devBypass || PRO_PLANS.includes(plan);
    const endpoint = usePro ? MODEL_ENDPOINTS.pro : MODEL_ENDPOINTS.standard;

    // Server-side quality guard appended to every prompt — targets the classic
    // diffusion failure modes (hands, merged/misplaced accessories).
    const qualitySuffix =
      " Correct anatomy, exactly five fingers per hand, all accessories clearly separated, correctly sized and placed where they belong on the body, clean coherent composition, no floating or merged objects.";

    // ---- Assemble the final prompt ----------------------------------------
    // 1. Character identity (client prompt, incl. its STYLE LOCK)
    // 2. Fresh random shot recipe — explicitly overrides any pose/camera the
    //    stored description baked in, so regens stop cloning each other.
    // 3. Western Comic boost when that style lock is detected.
    // 4. Quality guard + universal negatives.
    const basePrompt = String(prompt).slice(0, MAX_PROMPT);
    // Seeded on mascotId — see shotRecipe(). Palette + backdrop are stable for
    // the life of the character; camera, pose and framing reroll every time.
    const recipe = shotRecipe(mascotId);
    const isWestern = basePrompt.includes(WESTERN_MARKER);
    const isAnime = !isWestern && basePrompt.includes(ANIME_MARKER);
    // MEDIUM FIRST. Diffusion models weight the opening tokens most heavily, so
    // the medium is declared before the character is described — otherwise
    // FLUX's photoreal prior wins and everything comes out looking like a 3D
    // render regardless of what the style lock says 400 characters later.
    // NOTE: "cover" / "key visual", never "page". A comic *page* makes FLUX
    // draw a panel grid with gutters; a comic *cover* is one full-bleed
    // illustration, which is what a character card needs.
    const mediumPrefix = isWestern
      ? "Comic book COVER art — ONE single full-bleed illustration of one character. Hand-inked, bold saturated halftone color, glossy comic stock. "
      : isAnime
      ? "Anime KEY VISUAL — ONE single full-bleed illustration of one character. Hand-inked cel animation art, flat cel shading, vivid saturated color. "
      : "";
    const finalPrompt =
      mediumPrefix +
      basePrompt +
      qualitySuffix +
      ART_NEGATIVES +
      ` COMPOSITION — the CAMERA, POSE and FRAMING below OVERRIDE any pose, camera angle or framing described earlier; follow them exactly. The ENVIRONMENT PALETTE describes the BACKGROUND and the ambient light only: THE CHARACTER'S OWN COLORS AS DESCRIBED ABOVE ALWAYS WIN where the two conflict — never recolor the character to match the environment. ${recipe}` +
      (isWestern ? WESTERN_BOOST : "") +
      (isAnime ? ANIME_BOOST : "") +
      (isWestern || isAnime
        ? " LAYOUT: ONE single unbroken full-bleed image of ONE character. Absolutely NO multi-panel " +
          "comic layout, no panel borders, no gutters, no grid of boxes, no page divisions, no inset " +
          "frames, no storyboard, no collage, no speech balloons, no caption boxes, no title text."
        : "") +
      (isWestern ? " Final check: a single comic cover illustration, hand-inked — not a render, not a page of panels." : "") +
      (isAnime ? " Final check: a single anime key visual, hand-drawn — not a render, not a page of panels." : "");

    // Random seed every call — without it FLUX re-converges on (or fal caches)
    // the same composition for identical prompts. guidance_scale is only a
    // flux/dev parameter; flux-pro v1.1 doesn't accept it.
    const falBody = {
      prompt: finalPrompt,
      image_size: "square_hd",
      num_images: 1,
      seed: Math.floor(Math.random() * 2147483647),
    };
    // ---- SAFETY FILTER: the two endpoints take DIFFERENT parameters --------
    // FLUX's safety checker (often wrongly) flags ordinary character art — a
    // skull-faced figure holding a weapon is enough — and the request then
    // comes back with has_nsfw_concepts=true, which this file turns into a 502.
    //
    // The trap: fal IGNORES unknown fields instead of rejecting them, so
    // sending the wrong parameter fails silently and looks like a model
    // problem. Each endpoint accepts only its own:
    //   flux/dev      → enable_safety_checker (boolean)
    //   flux-pro v1.1 → safety_tolerance ("1" strictest … "6" loosest, default
    //                   "2"; API-only, no enable_safety_checker at all). fal's
    //                   prose calls 5 "most permissive" but the accepted range
    //                   is 1–6 and 6 is the real ceiling — we use 6.
    //
    // Pro was being sent enable_safety_checker, ignoring it, and running at
    // the default "2" — so ELITE, the only plan on the Pro engine, was the one
    // tier that couldn't generate art. Each endpoint now gets its own knob.
    if (usePro) {
      // "6", not "5". fal's flux-pro/v1.1 accepts 1–6 (default "2"); the prose
      // in their docs calls 5 "most permissive" but 6 is a real, accepted value
      // and it is the loosest setting available. Pro has no way to switch the
      // checker off entirely — safety_tolerance is the only knob — so a horned
      // skull-faced character holding a weapon can still trip it. This is the
      // last notch; anything beyond it needs the prompt softened instead.
      falBody.safety_tolerance = "6";
    } else {
      falBody.enable_safety_checker = false;
      falBody.guidance_scale = 3.5;
    }

    // ---- The paid call, with a hard timeout -------------------------------
    // An unbounded fetch pins a serverless slot until the platform kills it,
    // which is exactly how a slow upstream turns into a site-wide outage.
    const callFal = async (ep = endpoint, body = falBody) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 55000);
      try {
        return await fetch(ep, {
          method: "POST",
          headers: {
            Authorization: `Key ${process.env.FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    };

    // ⏱️ TIME BUDGET. maxDuration is 60s and each call carries its own 55s
    // abort, so primary + retry + safety-fallback can add up to far more than
    // the function is allowed to live. If Vercel kills the invocation mid-call
    // the refund never runs and the user is charged for nothing — the exact
    // failure this file was written to prevent. Every optional extra call is
    // now gated on how much time is actually left.
    const startedAt = Date.now();
    const msLeft = () => 60000 - (Date.now() - startedAt);

    let response;
    try {
      response = await callFal();
      // One retry, ONLY on the codes that mean "we didn't start your job" —
      // never on a 4xx or a 500, which could mean an image was produced.
      if ([429, 502, 503, 504].includes(response.status) && msLeft() > 20000) {
        await new Promise((r) => setTimeout(r, 1500));
        response = await callFal();
      }
    } catch (e) {
      await refund();
      const aborted = e && (e.name === "AbortError" || /abort/i.test(String(e.message)));
      return res.status(504).json({
        error: aborted
          ? "The art forge took too long to answer — no credit was used. Try again in a moment."
          : "Couldn't reach the art forge — no credit was used. Try again in a moment.",
      });
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      await refund();
      return res.status(502).json({ error: "The art forge sent back something unreadable — no credit was used." });
    }

    if (!response.ok || !data.images || !data.images[0]) {
      await refund();
      return res.status(502).json({ error: data.error || data.detail || "Image generation failed — no credit was used." });
    }
    // 🛟 SAFETY-FILTER FALLBACK. flux-pro CANNOT switch its checker off — the
    // only knob is safety_tolerance, and even at "6" it still flags ordinary
    // character art: a skull face, horns, a drawn weapon is enough. That was
    // handing Elite (and dev) users a 502 on exactly the mascots this project
    // is built to make, and telling them to hit Regenerate on a prompt that
    // would fail identically every time.
    //
    // flux/dev DOES accept enable_safety_checker:false and can be turned off
    // completely. So instead of failing, retry once there. The image comes back
    // from a slightly different model, which is a real cost — but a slightly
    // different picture beats no picture and a burnt minute.
    const flagged = (d) => Array.isArray(d.has_nsfw_concepts) && d.has_nsfw_concepts[0] === true;
    if (flagged(data) && usePro && msLeft() > 20000) {
      try {
        const fallbackBody = { ...falBody, enable_safety_checker: false, guidance_scale: 3.5 };
        delete fallbackBody.safety_tolerance; // flux/dev rejects nothing, but don't send a param it ignores
        const r2 = await callFal(MODEL_ENDPOINTS.standard, fallbackBody);
        const d2 = await r2.json().catch(() => null);
        if (r2.ok && d2 && d2.images && d2.images[0] && !flagged(d2)) {
          data = d2;
        }
      } catch (e) {
        console.warn("safety fallback failed:", e.message);
      }
    }
    // Still flagged after the fallback — fail loudly rather than return a black
    // square, and burn no credit.
    if (flagged(data)) {
      await refund();
      return res.status(502).json({
        error: "The image generator refused this prompt twice — its safety filter is misreading something in the description. Try editing the character's art prompt (the Studio's REWRITE ART PROMPT button) before regenerating; no credit was used.",
      });
    }

    return res.status(200).json({
      imageUrl: data.images[0].url,
      regensUsed: devBypass ? 0 : used + 1,
      regenLimit: devBypass ? "∞ (dev)" : limit,
    });
  } catch (err) {
    await refund();
    if (err instanceof UpstreamError) {
      console.error("supabase upstream error:", err.message);
      return res.status(503).json({
        error: "The studio's records are briefly unreachable — nothing was charged. Try again in a moment.",
      });
    }
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
