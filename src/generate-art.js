// Generates character art via fal.ai (FLUX) with PER-MASCOT regeneration
// allowances by plan tier:
//   starter: 10 regens per mascot · platinum: 33 · elite: 100
// Dev emails (DEV_EMAILS env) bypass limits entirely.
// Usage is tracked in the art_usage table (email + mascot_id -> regens).
// Env vars: FAL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, DEV_EMAILS
//
// ART VARIETY ENGINE (new): every generation gets a random SHOT RECIPE
// (camera + pose + backdrop + palette + framing) injected server-side, plus a
// random seed sent to FLUX — so regenerating the same mascot produces a
// genuinely different image every time instead of the same converged
// composition. Western Comic prompts also get a heavy 90s-comics style boost,
// because the client's short style lock alone doesn't pull FLUX far enough
// away from its glossy-render default.
const MODEL_ENDPOINTS = {
  standard: "https://fal.run/fal-ai/flux/dev",
  pro: "https://fal.run/fal-ai/flux-pro/v1.1",
};

// Per-mascot regen allowance by plan. Old plan names map to their nearest tier.
const REGEN_LIMITS = {
  starter: 10,
  pass: 10,            // legacy one-month pass
  platinum: 33,
  platinum_pass: 33,   // legacy all-access pass
  elite: 100,
};

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

const sbHeaders = {
  "Content-Type": "application/json",
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
};

async function getSubscriber(email) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=plan,status,mints_used`,
    { headers: sbHeaders }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// Credit-territory regen limit: once a user has exhausted their plan's mint
// allowance, NEW mascots only get this many image generations (the "credit
// mint" allowance). A mascot locks in its limit on its FIRST art generation,
// so earlier mascots keep the full allowance they started with.
const CREDIT_REGEN_LIMIT = 5;
const PLAN_MINTS = { starter: 1, pass: 1, platinum: 6, platinum_pass: 6, elite: 20 };

async function getUsage(email, mascotId) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/art_usage?email=eq.${encodeURIComponent(email.toLowerCase())}&mascot_id=eq.${encodeURIComponent(mascotId)}&select=regens,regen_limit`,
    { headers: sbHeaders }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function bumpRegens(email, mascotId, next, lockLimit) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/art_usage`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      email: email.toLowerCase(),
      mascot_id: mascotId,
      regens: next,
      regen_limit: lockLimit,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Failed to record art usage: ${await res.text()}`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, prompt, mascotId } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email required — set it in the Studio to generate art." });
  if (!prompt) return res.status(400).json({ error: "Missing art prompt" });
  if (!mascotId) return res.status(400).json({ error: "Missing mascotId" });

  try {
    const devBypass = isDevEmail(email);
    let used = 0;
    let limit = Infinity;

    if (!devBypass) {
      const sub = await getSubscriber(email);
      if (!sub || sub.status !== "active" || !REGEN_LIMITS[sub.plan]) {
        return res.status(402).json({
          error: "Art generation needs an active plan — see Pricing.",
          needsPlan: true,
        });
      }
      const usage = await getUsage(email, mascotId);
      used = usage ? usage.regens : 0;
      if (usage && usage.regen_limit) {
        // Mascot already locked its limit on first generation — honor it.
        limit = usage.regen_limit;
      } else {
        // First generation for this mascot: full plan allowance if plan mints
        // remain, credit allowance (5) if the user is in credit territory.
        const inCreditTerritory = (sub.mints_used || 0) >= (PLAN_MINTS[sub.plan] || 0);
        limit = inCreditTerritory ? CREDIT_REGEN_LIMIT : REGEN_LIMITS[sub.plan];
      }
      if (used >= limit) {
        return res.status(402).json({
          error: `This mascot has used all ${limit} image generations it comes with.`,
          regenLimitReached: true,
        });
      }
    }

    // Elite (and dev testers) get the Pro engine; everyone else the standard.
    const usePro = devBypass || (typeof limit === "number" && limit >= 100);
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
    const recipe = shotRecipe();
    const isWestern = prompt.includes(WESTERN_MARKER);
    const isAnime = !isWestern && prompt.includes(ANIME_MARKER);
    const finalPrompt =
      prompt +
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
    };
    if (!usePro) falBody.guidance_scale = 3.5;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(falBody),
    });
    const data = await response.json();
    if (!response.ok || !data.images || !data.images[0]) {
      return res.status(502).json({ error: data.error || data.detail || "Image generation failed" });
    }

    // Only count the regen after a SUCCESSFUL generation. Dev emails never counted.
    if (!devBypass) {
      await bumpRegens(email, mascotId, used + 1, limit);
    }

    return res.status(200).json({
      imageUrl: data.images[0].url,
      regensUsed: devBypass ? 0 : used + 1,
      regenLimit: devBypass ? "∞ (dev)" : limit,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
