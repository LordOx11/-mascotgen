// Generates character art via fal.ai (FLUX) with PER-MASCOT regeneration
// allowances by plan tier:
//   starter: 10 regens per mascot · platinum: 33 · elite: 100
// Dev emails (DEV_EMAILS env) bypass limits entirely.
// Usage is tracked in the art_usage table (email + mascot_id -> regens).
// Env vars: FAL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, DEV_EMAILS
const MODEL_ENDPOINT = "https://fal.run/fal-ai/flux/dev";

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

    const response = await fetch(MODEL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size: "square_hd",
        num_images: 1,
      }),
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
