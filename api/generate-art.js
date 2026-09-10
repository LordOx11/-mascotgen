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
//           optional: ART_LORA_URL, ART_LORA_SCALE, ART_LORA_DEV_ONLY,
//                     ART_LORA_CHAR_LIMIT  (style-LoRA engine, see below)
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
//      the platform killed it. Now every call aborts on a BUDGET derived from
//      the time actually left in the invocation (never later than 55s, and
//      always ~5s before maxDuration), so the refund always gets to run.
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
//
// ═══════════════════════════════════════════════════════════════════════════
// STYLE-LoRA ENGINE (added 10 Sep 2026) — THIRD ENGINE, FULLY OPT-IN
// ═══════════════════════════════════════════════════════════════════════════
// A custom style LoRA (MGXSTYLE, trained on Xavier's own approved keepers) is
// available as a third engine. It is OFF unless ART_LORA_URL is set, and even
// then it is DEV-ONLY unless ART_LORA_DEV_ONLY is explicitly set to "0".
//
// NOTHING BELOW THIS LINE CHANGES THE EXISTING PRO/STANDARD PATHS. Their
// endpoints, their prompt assembly, their safety knobs and their full-length
// ART_NEGATIVES block are byte-for-byte what they were on 24 Aug, because that
// is the config that produced art Xavier confirmed good, and two attempts to
// "improve" it both had to be reverted. The LoRA path is a SEPARATE branch
// with its OWN short prompt; if it is disabled or it fails, every request
// takes exactly the old road.
//
// WHY A SHORT PROMPT ON THIS PATH: the legacy prompt is 5–7k characters and
// FLUX reads roughly the first 2k, so the style block at the end survives or
// doesn't depending on how long that character's description happens to be —
// that was the coin flip. A LoRA bakes the style into the weights, so the
// prompt only carries the trigger word plus the character, and style stops
// competing with description for the read window.
//
// WHAT WAS PROVEN ON FAL'S PLAYGROUND BEFORE ANY OF THIS WAS WRITTEN
// (full detail in MASCOT GENERATOR/Art LoRA/LORA-v2-LOCKED-SPEC.md):
//   · Scene lighting is the real style lever. Bright saturated backgrounds
//     make FLUX render airbrush-poster; dark ones force the ink to carry the
//     image. Same LoRA, same character, same settings: hot orange sunset
//     scored 2/4, near-black scored 3/4, solid black edge-to-edge scored 4/4.
//   · State the scene as what FILLS the frame, never as what's absent.
//     Negative lists leak — the model escapes and reverts to the dataset
//     average, which is city + signage + sunset.
//   · A FACE BLOCK is what makes a face menacing instead of a soft anime mask:
//     heavy brow shadow, half the face in spot black, jaw closed not shouting.
//   · LEGWEAR must be drawn as a distinct garment or it fuses into the skin
//     and reads as painted-on shorts.
//
// PROMPT BUDGET ON THIS PATH: blocks are ordered by importance because the
// tail past ~2000 characters is insurance, not guarantee. Trigger and style
// first, then the character, then face, garments, shot recipe. The anatomy
// guard and the signage line sit after those deliberately — they are cheap
// insurance that mostly duplicates what the LoRA already does.

// Vercel: give the function room for a slow FLUX call (Pro can run long).
export const maxDuration = 60;

const MODEL_ENDPOINTS = {
  standard: "https://fal.run/fal-ai/flux/dev",
  pro: "https://fal.run/fal-ai/flux-pro/v1.1",
  lora: "https://fal.run/fal-ai/flux-lora",
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

// ---- STYLE-LoRA CONFIG ------------------------------------------------------
// ART_LORA_URL       the trained .safetensors URL from fal's trainer. UNSET =
//                    the LoRA engine does not exist and nothing changes.
// ART_LORA_SCALE     LoRA strength. 1.0 is the tested value. Below ~0.8 the
//                    style stops holding; above ~1.3 anatomy starts melting.
// ART_LORA_DEV_ONLY  "1" (default) = dev accounts only, which is how this
//                    ships. Set to "0" to open the engine to every plan.
// ART_LORA_CHAR_LIMIT  how much of the stored character description to keep.
//                    900 keeps the whole prompt inside FLUX's read window with
//                    room for the face and garment blocks.
const LORA_URL = (process.env.ART_LORA_URL || "").trim();
const LORA_SCALE = (() => {
  const n = parseFloat(process.env.ART_LORA_SCALE || "");
  return Number.isFinite(n) && n > 0 && n <= 2 ? n : 1.0;
})();
const LORA_DEV_ONLY = (process.env.ART_LORA_DEV_ONLY || "1").trim() !== "0";
const LORA_CHAR_LIMIT = (() => {
  const n = parseInt(process.env.ART_LORA_CHAR_LIMIT || "", 10);
  return Number.isFinite(n) && n >= 200 && n <= 2000 ? n : 900;
})();
const LORA_TRIGGER = "MGXSTYLE";

// Longest prompt we'll forward. Unbounded prompts are slow and expensive.
//
// ⚠️ REVERTED TO 4000 ON 24 AUG — READ BEFORE CHANGING THIS AGAIN.
// Two attempts to "fix" truncation by capping this number both made things
// WORSE and were reverted: capping to 750 produced cartoony/silly art, and
// capping to 1100 (plus a shortened no-writing block) brought gibberish
// lettering BACK and drifted the style off the locked-in look. 4000 is the
// value that produced the art Xavier confirmed good. The FLUX ~2000-char
// truncation is real, but shortening blocks to fit it costs more than the
// truncation does. DO NOT RE-TUNE WITHOUT A TESTED RESULT.
//
// NOTE: this governs the LEGACY pro/standard path only. The LoRA path uses
// LORA_CHAR_LIMIT above, which is a different number for a different reason —
// there, style lives in the weights instead of competing for the read window.
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

// ✍️ ARTIST NAMES RESTORED (24 Aug) — TESTED AND PUT BACK. DO NOT REMOVE AGAIN.
// They were deleted for one round on the theory that naming illustrators caused
// the fake corner signatures. Result: signatures STILL appeared (Brimlock
// Jawtide), and the art went noticeably FLATTER — losing the painted-over-inks
// depth that Gravel Mortis, Corvaxis, Kragg and Solenne have. These three names
// are what carry the dimensional 90s rendering; "1990s Image Comics era" alone
// is too generic and lands on flat poster art.
// Signatures are handled instead by the explicit no-signature / clean-corners
// lines in ART_NEGATIVES, which is the right tool for them.
const WESTERN_BOOST =
  " A single-image comic book COVER, inked by hand and printed in full color on glossy modern comic stock. " +
  "1990s Image Comics era — Jim Lee, Todd McFarlane, Simon Bisley. Heavy black brush inking with thick " +
  "tapering contour lines, bold spot blacks, cross-hatching and feathering in the shadows. Vivid saturated " +
  "MODERN digital comic color, richly layered and glossy — NOT newsprint, NO Ben-Day halftone dots, no " +
  "printed paper texture. Comic cover composition, subject centered and " +
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
// ⚠️ DO NOT SHORTEN THIS BLOCK. It was compressed to ~380 characters on 23 Aug
// on the theory that a shorter rule survives truncation better — and gibberish
// lettering came back MORE often, not less. The reason is in the note above:
// a bare negative fails because the SCENE implies signage, so the model draws
// signs regardless and fills them with letter-shaped noise. What works is the
// POSITIVE instruction telling it what to draw INSTEAD, in detail — the
// "glowing bars, blocks, stripes, geometric symbols" clause. That clause is the
// working part of this block. Length is not the problem; losing that clause is.
const ART_NEGATIVES =
  " ABSOLUTELY NO WRITING ANYWHERE IN THE IMAGE. No text, no letters, no words, no numbers, no alphabets of any kind, no watermark, no signature, no artist signature, no initials, no monogram, no speech bubbles, no captions, no logos, no borders. " +
  "This includes every surface in the background: signs, billboards, neon, storefronts, screens, banners, posters, licence plates, packaging and clothing. " +
  "Render all signage as ABSTRACT LIGHT ONLY — glowing bars, blocks, stripes, geometric symbols and colour shapes that suggest a lit sign from a distance without forming a single readable character. " +
  "Illegible letter-shaped scribble is the WORST possible outcome and is strictly forbidden: if a surface would carry writing, leave it blank, cover it in glow, or turn it away from the camera. " +
  "The corners and edges of the image are CLEAN — never sign the artwork.";

// ═══════════════════════════════════════════════════════════════════════════
// LoRA PROMPT BLOCKS — every one of these was tested on fal's playground
// before it was written here. Do not edit from theory; edit from a test grid.
// ═══════════════════════════════════════════════════════════════════════════

// The style line. Shorter than WESTERN_BOOST because the LoRA already carries
// the look — this only has to steer it. Two clauses earned their place in
// testing and should not be dropped: "cross-hatching in the shadows" and
// "restricted palette of three or four colors". Removing the palette clause is
// what let the neon oversaturation back in.
const LORA_STYLE_WESTERN =
  "Comic book cover art — one full-bleed illustration of one character. Anime cel-shaded character " +
  "rendering inked like a 90s American comic cover: bold clean black ink outlines with varied line weight, " +
  "heavy spot blacks, cross-hatching in the shadows, hard-edged cel shading in three flat tones, " +
  "restricted palette of three or four colors, heroic anatomy, dramatic cover composition.";

// Anime variant. PROVISIONAL — Xavier is still selecting the reference set that
// defines the anime half of the blend, so this is the western line retuned
// toward cel animation rather than something proven on a test grid. When the
// anime references land, this is the constant to replace.
const LORA_STYLE_ANIME =
  "Anime key visual — one full-bleed illustration of one character. Hand-inked cel animation art: clean " +
  "black ink linework with varied brush weight, flat cel shading in three hard-edged tones with no gradient " +
  "falloff, restricted palette of three or four saturated colors, heroic anatomy, dramatic key-visual " +
  "composition.";

// THE FACE BLOCK. This is what turns a soft symmetrical anime mask into a face
// that reads as menacing. Menace in comic ink comes from three things the model
// does not do by default: a heavy brow shadow that drops the eyes into black,
// an asymmetric light so one side falls to spot black, and a closed jaw instead
// of an open shout. All three are named explicitly.
//
// Tested on Corvaxis: clear improvement, brow shadow and set jaw both landed.
// Tested on Ghoulox Rex (a T-rex): NO effect, because a beast skull has no brow
// ridge or cheekbones to shadow. The last sentence is the beast variant folded
// in so one block serves both — it is the untested half of this constant.
const LORA_FACE =
  "Face rendered in hard graphic shadow: heavy brow throwing a solid black shadow across the eye sockets, " +
  "deep-set narrowed eyes, sharp angular cheekbones, jaw set tight and closed rather than open in a shout, " +
  "chin tilted slightly down so the eyes look up at the viewer. Half the face falls in solid spot black. " +
  "Expression cold and predatory. On a beast or animal head, shadow falls across the top of the skull, the " +
  "eye sinks into black, and the lips draw back tight over the teeth.";

// THE GARMENT RULE. Without this, legwear fuses into the body and reads as
// painted-on shorts — worst when the skin and the trousers are close in value,
// which is most of the roster. The engine cannot know what a given character
// wears, so this is phrased as a drawing instruction rather than a description.
const LORA_GARMENTS =
  "Every garment is drawn as a separate object from the body: legwear and footwear have a visible waistband, " +
  "a clear hem and their own tone distinct from the skin, so the ink line between cloth and body is never " +
  "lost. Accessories sit on top of the clothing, not fused into it.";

// SIGNAGE — the condensed line for this path.
// ⚠️ This is NOT a shortened ART_NEGATIVES and the 23 Aug lesson still stands.
// ART_NEGATIVES above is untouched and still runs on the legacy path in full.
// What survives here is the clause the code comments identify as the working
// part — the POSITIVE instruction naming what to draw instead of writing. The
// long form is dropped on this path only because the whole point of the LoRA
// prompt is to stay inside FLUX's read window, and a 900-character block at the
// end would sit outside it anyway.
const LORA_SIGNAGE =
  "Any sign, screen, banner or storefront in the scene is rendered as ABSTRACT LIGHT ONLY — glowing bars, " +
  "blocks, stripes and geometric colour shapes that suggest a lit sign without forming a single readable " +
  "character. No text, no letters, no numbers, no watermark, no signature. Corners and edges are clean and " +
  "unmarked.";

// The anatomy guard, trimmed. Same intent as qualitySuffix on the legacy path.
const LORA_ANATOMY =
  "Correct anatomy, exactly five fingers per hand, no extra or missing limbs, all accessories correctly " +
  "sized and placed where they belong on the body, no floating or merged objects.";

const LORA_LAYOUT =
  "ONE single unbroken full-bleed image of ONE character. No panel borders, no gutters, no grid of boxes, " +
  "no inset frames, no speech balloons, no caption boxes, no title text.";

// Assemble the LoRA prompt. Blocks are ordered by importance, because anything
// past roughly 2000 characters is insurance rather than instruction.
function buildLoraPrompt({ characterText, recipe, isAnime }) {
  const character = String(characterText || "").slice(0, LORA_CHAR_LIMIT).trim();
  // Deliberate default: a prompt carrying NEITHER style marker gets the western
  // line, because that is the half of the blend the LoRA was actually trained
  // and tested on. The anime line is provisional until the reference set lands.
  const styleLine = isAnime ? LORA_STYLE_ANIME : LORA_STYLE_WESTERN;
  return [
    `${LORA_TRIGGER}. ${styleLine}`,
    character,
    LORA_FACE,
    LORA_GARMENTS,
    // The shot recipe carries camera, pose, framing, the backdrop disc and the
    // environment palette — this is what keeps regenerations from converging on
    // the same picture, and it is stated as what fills the frame, not as what
    // to avoid, which is the phrasing the model actually holds onto.
    `COMPOSITION — the camera, pose and framing below OVERRIDE any pose or camera described earlier; follow them exactly. The environment palette describes the BACKGROUND and ambient light only: the character's own colors as described above always win where the two conflict. ${recipe} The background fills the frame edge to edge as a fully illustrated environment.`,
    LORA_ANATOMY,
    LORA_SIGNAGE,
    LORA_LAYOUT,
  ].join(" ");
}

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

  // ⏱️ TIME BUDGET — STARTS HERE, NOT AT THE FAL CALL.
  // This clock used to start just before the first paid call, which made the
  // four Supabase round-trips above it invisible to the budget: on a slow
  // Supabase day msLeft() would report 25s left when 15s actually remained.
  // Every abort and every optional retry is measured from the moment the
  // request arrives, because that is what Vercel's 60s maxDuration measures.
  const startedAt = Date.now();
  const msLeft = () => 60000 - (Date.now() - startedAt);

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
      console.warn("art refund failed:", e && e.message);
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
          console.warn("global art counter unavailable:", e && e.message);
        }
      }

      // --- ATOMIC: take a slot from this cycle's pool BEFORE paying fal ----
      let pool = null;
      try {
        pool = await sbRpc("consume_art_period", { p_email: email, p_period: periodKey, p_cap: limit });
      } catch (e) {
        console.warn("art pool unavailable (run art-limits.sql):", e && e.message);
      }

      if (pool && pool.allowed === true) {
        consumedKind = "period";
        used = pool.used - 1;              // count BEFORE this generation
      } else if (pool && pool.allowed === false) {
        // Pool is spent — fall through to PURCHASED art credits, which is
        // exactly what the $2.99 pack is for (and what it never did before).
        let credit = null;
        // ⚠️ A DATABASE BLIP IS NOT A BILLING STATE. This catch used to swallow
        // everything, so a Supabase outage told a paying customer their credits
        // were gone and invited them to spend $2.99 on the strength of it —
        // the same class of bug as fix #5 in the header. An UpstreamError is
        // re-thrown so the outer handler answers 503 "nothing was charged";
        // only a genuine empty balance falls through to the 402 below.
        // ⚠️ EVERY throw is re-thrown, not just UpstreamError. sbRpc only builds
        // an UpstreamError when the response is a clean non-2xx — a real
        // database outage usually drops the connection instead, which surfaces
        // as a TypeError from fetch, or a SyntaxError from JSON.parse on a
        // truncated body. Catching only UpstreamError left exactly those cases
        // falling through to the 402 below, telling a customer with a full
        // balance to go buy another credit pack. Only a SUCCESSFUL rpc that
        // reports no credit should reach that message.
        try { credit = await sbRpc("consume_art_credit", { p_email: email }); }
        catch (e) {
          console.warn("art credit RPC unavailable:", e && e.message);
          throw e instanceof UpstreamError
            ? e
            : new UpstreamError(`consume_art_credit: ${e && e.message}`);
        }
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

    // ---- STYLE-LoRA GATE — fails closed at every step ----------------------
    // No URL configured → no LoRA engine, full stop. Configured but still
    // dev-only (the default) → dev accounts only. Flipping ART_LORA_DEV_ONLY to
    // "0" is the single deliberate act that opens it to paying plans, and it
    // should not happen until the A/B on real cards holds up.
    const useLora = !!LORA_URL && (devBypass || !LORA_DEV_ONLY);

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
    // Detect on the full string, then slice. (At MAX_PROMPT 4000 the marker is
    // effectively always inside the slice anyway, but detecting first costs
    // nothing and removes one way this can silently break.)
    const fullPrompt = String(prompt);
    const isWestern = fullPrompt.includes(WESTERN_MARKER);
    const isAnime = !isWestern && fullPrompt.includes(ANIME_MARKER);
    const basePrompt = fullPrompt.slice(0, MAX_PROMPT);
    // Seeded on mascotId — see shotRecipe(). Palette + backdrop are stable for
    // the life of the character; camera, pose and framing reroll every time.
    const recipe = shotRecipe(mascotId);
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
    const legacyPrompt =
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
    const seed = Math.floor(Math.random() * 2147483647);
    const legacyBody = {
      prompt: legacyPrompt,
      image_size: "square_hd",
      num_images: 1,
      seed,
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
    //   flux-lora     → enable_safety_checker (boolean) — same family as dev
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
      legacyBody.safety_tolerance = "6";
    } else {
      legacyBody.enable_safety_checker = false;
      legacyBody.guidance_scale = 3.5;
    }

    // ---- The LoRA body, when the engine is on ------------------------------
    // Settings are the ones pinned on fal's playground during testing; see
    // LORA-v2-LOCKED-SPEC.md. flux-lora is a flux/dev derivative, so the safety
    // checker can be switched off entirely here — no safety_tolerance, and no
    // need for the Pro fallback dance further down.
    const loraBody = useLora
      ? {
          prompt: buildLoraPrompt({ characterText: basePrompt, recipe, isAnime }),
          loras: [{ path: LORA_URL, scale: LORA_SCALE }],
          image_size: "square_hd",
          num_images: 1,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          enable_safety_checker: false,
          output_format: "png",
          seed,
        }
      : null;

    // What we're actually calling first.
    let activeEngine = useLora ? "lora" : usePro ? "pro" : "standard";
    let activeEndpoint = useLora ? MODEL_ENDPOINTS.lora : endpoint;
    let activeBody = useLora ? loraBody : legacyBody;

    // ---- The paid call, with a hard timeout -------------------------------
    // An unbounded fetch pins a serverless slot until the platform kills it,
    // which is exactly how a slow upstream turns into a site-wide outage.
    const callFal = async (ep = activeEndpoint, body = activeBody) => {
      const ctrl = new AbortController();
      // ⚠️ THE ABORT IS BUDGETED, NOT FIXED. A flat 55s timeout was wrong: the
      // optional retries below only check that 20s REMAIN before starting, so a
      // call could legally begin at t=40s and then run its full 55s — Vercel
      // kills the invocation at t=60s, refund() never runs, and the user is
      // charged for an image they never received. That is the single failure
      // this whole file was written to prevent, so the abort now tracks the
      // real remaining budget and always leaves ~5s for refund()'s own
      // Supabase round-trip.
      const budget = Math.max(3000, Math.min(55000, msLeft() - 5000));
      const timer = setTimeout(() => ctrl.abort(), budget);
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

    // The Supabase calls above are unbounded — no AbortController — so on a bad
    // day the bookkeeping alone can eat most of the 60s. If there isn't enough
    // left to run a fal call AND refund on failure, stop here: the request was
    // already lost, and the only remaining question is whether the user also
    // gets billed for it.
    if (msLeft() < 8000) {
      await refund();
      return res.status(503).json({
        error: "The studio is briefly overloaded and couldn't start your image in time — nothing was charged. Try again in a moment.",
      });
    }

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
      // 🛟 LoRA NEVER COSTS A USER THEIR IMAGE. If the experimental engine is
      // unreachable, drop to the engine that has been serving this app all
      // along and use the legacy prompt with it. A slightly different picture
      // beats an error, and the user is not a test subject.
      //
      // NOTE — this covers CONNECTION failures, not TIMEOUTS. Because callFal's
      // abort is budgeted to fire with ~5s left, a LoRA call that times out
      // leaves far less than the 20s this branch requires, so it ends as a
      // refund + 504 rather than a second attempt. That is the correct
      // trade: the credit always comes back, and we never start a call we
      // can't finish inside maxDuration.
      const describe = (err) =>
        err && (err.name === "AbortError" || /abort/i.test(String(err.message)))
          ? "The art forge took too long to answer — no credit was used. Try again in a moment."
          : "Couldn't reach the art forge — no credit was used. Try again in a moment.";
      if (useLora && msLeft() > 20000) {
        console.warn("lora engine unreachable, falling back to legacy:", e && e.message);
        try {
          activeEngine = usePro ? "pro" : "standard";
          activeEndpoint = endpoint;
          activeBody = legacyBody;
          response = await callFal(endpoint, legacyBody);
        } catch (e2) {
          await refund();
          // Reports the SECOND failure, which is the one that actually ended
          // the request — describing it with the first error's shape sent
          // "took too long" for a connection refusal and vice versa.
          return res.status(504).json({ error: describe(e2) });
        }
      } else {
        await refund();
        return res.status(504).json({ error: describe(e) });
      }
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    // Same fallback, for the case where the LoRA endpoint answers but the
    // answer is unusable — a bad LoRA URL is a 4xx here, and without this the
    // whole app would break the moment that URL expired or was mistyped.
    if (useLora && activeEngine === "lora" && (!response.ok || !data || !data.images || !data.images[0] || !data.images[0].url) && msLeft() > 20000) {
      console.warn("lora engine returned no image, falling back to legacy:", (data && (data.error || data.detail)) || response.status);
      try {
        activeEngine = usePro ? "pro" : "standard";
        activeEndpoint = endpoint;
        activeBody = legacyBody;
        response = await callFal(endpoint, legacyBody);
        data = await response.json().catch(() => null);
      } catch (e) {
        console.warn("legacy fallback after lora failure also failed:", e && e.message);
      }
    }

    if (!data) {
      await refund();
      return res.status(502).json({ error: "The art forge sent back something unreadable — no credit was used." });
    }

    // ⚠️ `.url` IS PART OF THE GUARD, not an assumption. Without it a response
    // carrying an image object with a null url returned HTTP 200 with
    // imageUrl: undefined — the user saw a broken card AND kept the charge,
    // because a 200 never reaches refund().
    // fal returns `detail` as an ARRAY of objects on validation errors, so it
    // is stringified rather than dropped raw into a user-facing message.
    if (!response.ok || !data.images || !data.images[0] || !data.images[0].url) {
      await refund();
      // Log the whole payload before discarding it — fal's validation errors
      // arrive as an array of objects, which is exactly the shape that can't be
      // shown to a user and is also the shape you most need when debugging.
      console.warn("fal returned no usable image:", response.status, JSON.stringify(data).slice(0, 500));
      // 🔐 The upstream string goes to DEV ACCOUNTS ONLY. fal echoes prompt
      // fragments and internal identifiers in some of its error messages, so
      // forwarding it verbatim would let any user who can trigger a 502 read
      // parts of the server-side prompt — including the LoRA trigger word.
      // Everyone else gets the generic line; the full payload is in the log
      // above either way, so nothing is lost for debugging.
      // (`.find` rather than a `||` chain: fal returns `detail` as an ARRAY of
      // objects on validation errors, and an object-shaped `error` would
      // otherwise shadow a perfectly good string `detail`.)
      const upstream = devBypass
        ? [data.error, data.detail].find((v) => typeof v === "string" && v)
        : null;
      return res.status(502).json({
        error: upstream || "Image generation failed — no credit was used.",
      });
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
    //
    // Only relevant when the PRO engine actually ran — the LoRA path already
    // has the checker off, so it can never arrive here flagged.
    const flagged = (d) => Array.isArray(d.has_nsfw_concepts) && d.has_nsfw_concepts[0] === true;
    if (flagged(data) && activeEngine === "pro" && msLeft() > 20000) {
      try {
        const fallbackBody = { ...legacyBody, enable_safety_checker: false, guidance_scale: 3.5 };
        delete fallbackBody.safety_tolerance; // flux/dev rejects nothing, but don't send a param it ignores
        const r2 = await callFal(MODEL_ENDPOINTS.standard, fallbackBody);
        const d2 = await r2.json().catch(() => null);
        if (r2.ok && d2 && d2.images && d2.images[0] && d2.images[0].url && !flagged(d2)) {
          data = d2;
          activeEngine = "standard";
        }
      } catch (e) {
        // `e && e.message`, not `e.message`: this catch runs AFTER a paid image
        // may already exist, so a non-Error throw here would raise a second
        // TypeError inside the catch, escape to the outer handler, and turn a
        // recoverable situation into a 500 on an image fal already billed for.
        console.warn("safety fallback failed:", e && e.message);
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
      // Which engine actually produced this image. Purely informational, but
      // it is what makes the A/B readable without guessing from the artwork.
      engine: activeEngine,
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
