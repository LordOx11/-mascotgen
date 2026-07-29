// Generates character art via fal.ai (FLUX) with PER-MASCOT regeneration
// allowances by plan tier:
//   starter: 10 regens per mascot · platinum: 33 · elite: 100
// Dev emails (DEV_EMAILS env) bypass limits entirely.
// Usage is tracked in the art_usage table (email + mascot_id -> regens).
// Env vars: FAL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, DEV_EMAILS
// Tiered art engines: Elite gets FLUX Pro (better hands, object placement,
// coherence); everyone else gets flux/dev. Dev emails get Pro so you can test
// the premium engine. Both run on the same fal.ai account + FAL_KEY.
const MODEL_ENDPOINTS = {
  standard: "https://fal.run/fal-ai/flux/dev",
  pro: "https://fal.run/fal-ai/flux-pro/v1.1",
  // Character-consistent generation: takes a REFERENCE IMAGE + instruction and
  // keeps the exact character while changing the scene. Used for comic panels.
  kontext: "https://fal.run/fal-ai/flux-pro/kontext",
};

// Per-mascot regen allowance by plan. Old plan names map to their nearest tier.
const REGEN_LIMITS = {
  starter: 10,
  pass: 10,            // legacy one-month pass
  platinum: 33,
  platinum_pass: 33,   // legacy all-access pass
  elite: 100,
};

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

  const { email, prompt, mascotId, referenceImageUrl } = req.body || {};
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
    // A referenceImageUrl switches to Kontext: character-consistent generation
    // that keeps the exact character from the reference while changing scenes.
    const usePro = devBypass || (typeof limit === "number" && limit >= 100);
    const endpoint = referenceImageUrl
      ? MODEL_ENDPOINTS.kontext
      : usePro
      ? MODEL_ENDPOINTS.pro
      : MODEL_ENDPOINTS.standard;

    // Server-side quality guard appended to every prompt — targets the classic
    // diffusion failure modes (hands, merged/misplaced accessories).
    const qualitySuffix =
      " Correct anatomy, exactly five fingers per hand, all accessories clearly separated, correctly sized and placed where they belong on the body, clean coherent composition, no floating or merged objects.";

    const falBody = referenceImageUrl
      ? { prompt: prompt + qualitySuffix, image_url: referenceImageUrl }
      : { prompt: prompt + qualitySuffix, image_size: "square_hd", num_images: 1 };

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
