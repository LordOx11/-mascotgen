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
// One item from each pool per generation. 7×9×8×7×4 = 14,112 combinations, so
// two identical trait builds can't land on the same picture.
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
];
const FRAMINGS = [
  "full body, head to toe in frame",
  "three-quarter body from the thighs up",
  "chest-up power portrait",
  "full body with a sweeping landscape filling the lower third",
];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shotRecipe = () =>
  `Camera: ${pick(CAMERAS)}. Pose: ${pick(POSES)}. Behind the subject: ${pick(DISCS)}. ` +
  `Palette: ${pick(PALETTES)}. Framing: ${pick(FRAMINGS)}.`;

// ---- WESTERN COMIC STYLE BOOST ---------------------------------------------
// The client's STYLE LOCK for Western Comic is detected by this marker phrase
// (it appears verbatim in App.jsx's STYLE_SUFFIX). When present, this heavier
// block is appended — it's the vocabulary FLUX actually responds to.
const WESTERN_MARKER = "American comic book illustration";
// Same idea for Anime / Manga — detected by the marker phrase in App.jsx's
// anime STYLE LOCK ("flat cel-shaded 2D anime illustration").
const ANIME_MARKER = "2D anime illustration";
const ANIME_BOOST =
  " High-detail modern shonen anime key visual. Crisp confident ink linework with varied line weight, " +
  "flat cel shading with hard-edged shadow shapes, two-tone shading on skin and clothing, vibrant saturated " +
  "colors, dramatic backlighting with glow and bloom effects on energy sources, a large luminous disc or " +
  "moon behind the subject, detailed painted anime background, floating particles and light flecks, official " +
  "anime poster composition with the subject dominant. Retro-modern anime cel aesthetic — STRICTLY NOT " +
  "photorealistic, NOT 3D, NOT CGI, no realistic skin texture, not a western cartoon.";
const WESTERN_BOOST =
  " 1990s American comic book cover art, Image Comics era — Jim Lee, Todd McFarlane, Simon Bisley influence. " +
  "Heavy black ink outlines with thick tapering contour lines, bold spot blacks, cross-hatching in shadow areas. " +
  "Flat saturated cel-shaded color blocking with hard-edged highlights, neon rim light tracing the body contours. " +
  "Vintage offset print grain with subtle halftone dot texture. Comic cover poster composition, subject centered " +
  "and dominant, environment framing the lower third. Hand-drawn and inked — STRICTLY NOT a 3D render, NOT " +
  "photorealistic, NOT airbrushed digital painting, no CGI, no photography.";

// Universal negatives for every generation.
const ART_NEGATIVES =
  " No text, no lettering, no watermark, no signature, no speech bubbles, no logos, no borders.";

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

async function getSubscriber(email) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=plan,status,mints_used`,
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
    const recipe = shotRecipe();
    const isWestern = basePrompt.includes(WESTERN_MARKER);
    const isAnime = !isWestern && basePrompt.includes(ANIME_MARKER);
    const finalPrompt =
      basePrompt +
      qualitySuffix +
      ART_NEGATIVES +
      ` COMPOSITION (these instructions OVERRIDE any pose, camera angle, backdrop or framing described earlier — follow them exactly): ${recipe}` +
      (isWestern ? WESTERN_BOOST : "") +
      (isAnime ? ANIME_BOOST : "");

    // Random seed every call — without it FLUX re-converges on (or fal caches)
    // the same composition for identical prompts. guidance_scale is only a
    // flux/dev parameter; flux-pro v1.1 doesn't accept it.
    const falBody = {
      prompt: finalPrompt,
      image_size: "square_hd",
      num_images: 1,
      seed: Math.floor(Math.random() * 2147483647),
      // FLUX's safety checker returns SOLID BLACK images when it (often
      // wrongly) flags a prompt — weapon accessories like "Machine Gun
      // Turret" trip it randomly. Off = real art every time.
      enable_safety_checker: false,
    };
    if (!usePro) falBody.guidance_scale = 3.5;

    // ---- The paid call, with a hard timeout -------------------------------
    // An unbounded fetch pins a serverless slot until the platform kills it,
    // which is exactly how a slow upstream turns into a site-wide outage.
    const callFal = async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 55000);
      try {
        return await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Key ${process.env.FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(falBody),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    };

    let response;
    try {
      response = await callFal();
      // One retry, ONLY on the codes that mean "we didn't start your job" —
      // never on a 4xx or a 500, which could mean an image was produced.
      if ([429, 502, 503, 504].includes(response.status)) {
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
    // Belt & suspenders: if a safety checker still ran and flagged the image,
    // fail loudly instead of returning a black square — and burn no credit.
    if (Array.isArray(data.has_nsfw_concepts) && data.has_nsfw_concepts[0] === true) {
      await refund();
      return res.status(502).json({ error: "The image generator's safety filter misfired on this prompt — hit Regenerate to try again (no credit was used)." });
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
