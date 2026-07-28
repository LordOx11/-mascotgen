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
    `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=plan,status`,
    { headers: sbHeaders }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getRegens(email, mascotId) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/art_usage?email=eq.${encodeURIComponent(email.toLowerCase())}&mascot_id=eq.${encodeURIComponent(mascotId)}&select=regens`,
    { headers: sbHeaders }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].regens : 0;
}

async function bumpRegens(email, mascotId, next) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/art_usage`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      email: email.toLowerCase(),
      mascot_id: mascotId,
      regens: next,
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
      limit = REGEN_LIMITS[sub.plan];
      used = await getRegens(email, mascotId);
      if (used >= limit) {
        return res.status(402).json({
          error: `This mascot has used all ${limit} image generations included with your plan.`,
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
      await bumpRegens(email, mascotId, used + 1);
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
