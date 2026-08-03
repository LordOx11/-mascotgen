// Generates character art via fal.ai (FLUX) with PER-MASCOT regeneration
// allowances by plan tier:
//   starter: 10 regens per mascot · platinum: 33 · elite: 100
// PLUS purchased ART CREDITS ($2.99 → +10, never expire, any tier including
// free): plan allowance spends first, credits are the fallback pool. Credits
// are EMAIL-level, not per-mascot.
// Dev emails (DEV_EMAILS env) bypass limits entirely.
// Usage is tracked in art_usage (email + mascot_id -> regens); purchased
// credits live in subscribers.art_credits.
// Env vars: FAL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, DEV_EMAILS
const MODEL_ENDPOINTS = {
  standard: "https://fal.run/fal-ai/flux/dev",
  pro: "https://fal.run/fal-ai/flux-pro/v1.1",
  // Character-consistent generation: takes a REFERENCE IMAGE + instruction and
  // keeps the exact character while changing the scene. Used for comic panels.
  kontext: "https://fal.run/fal-ai/flux-pro/kontext",
};
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
    `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=plan,status,mints_used,art_credits`,
    { headers: sbHeaders }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
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
// Spends one purchased art credit. Called only AFTER a successful generation.
async function spendArtCredit(email, current) {
  await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}`,
    {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify({ art_credits: Math.max(0, current - 1), updated_at: new Date().toISOString() }),
    }
  );
}
const PACK_HINT = " Grab +10 art credits for $2.99 on the Pricing page — no subscription needed, they never expire.";
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
    let creditMode = false;      // this generation spends a purchased credit
    let artCredits = 0;
    if (!devBypass) {
      const sub = await getSubscriber(email);
      artCredits = (sub && sub.art_credits) || 0;
      const hasPlan = sub && sub.status === "active" && REGEN_LIMITS[sub.plan];
      if (!hasPlan) {
        // No active plan: purchased credits are the ONLY pool — and they're
        // enough. This is the free-tier art-pack path.
        if (artCredits > 0) {
          creditMode = true;
        } else {
          return res.status(402).json({
            error: "Art generation needs an active plan — or just art credits." + PACK_HINT,
            needsPlan: true,
          });
        }
      } else {
        const usage = await getUsage(email, mascotId);
        used = usage ? usage.regens : 0;
        if (usage && usage.regen_limit) {
          limit = usage.regen_limit;
        } else {
          const inCreditTerritory = (sub.mints_used || 0) >= (PLAN_MINTS[sub.plan] || 0);
          limit = inCreditTerritory ? CREDIT_REGEN_LIMIT : REGEN_LIMITS[sub.plan];
        }
        if (used >= limit) {
          // Plan allowance for this mascot exhausted → purchased credits are
          // the fallback pool.
          if (artCredits > 0) {
            creditMode = true;
          } else {
            return res.status(402).json({
              error: `This mascot has used all ${limit} image generations it comes with.` + PACK_HINT,
              regenLimitReached: true,
            });
          }
        }
      }
    }
    // Elite (and dev testers) get the Pro engine; credit-mode and everyone
    // else get standard. Reference images always use Kontext.
    const usePro = devBypass || (!creditMode && typeof limit === "number" && limit >= 100);
    const endpoint = referenceImageUrl
      ? MODEL_ENDPOINTS.kontext
      : usePro
      ? MODEL_ENDPOINTS.pro
      : MODEL_ENDPOINTS.standard;
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
    // Record the spend only AFTER success. Credit mode debits the purchased
    // pool; plan mode bumps the per-mascot counter. Dev never counts.
    if (!devBypass) {
      if (creditMode) {
        await spendArtCredit(email, artCredits);
      } else {
        await bumpRegens(email, mascotId, used + 1, limit);
      }
    }
    return res.status(200).json({
      imageUrl: data.images[0].url,
      regensUsed: devBypass ? 0 : creditMode ? used : used + 1,
      regenLimit: devBypass ? "∞ (dev)" : creditMode ? "credits" : limit,
      artCreditsLeft: devBypass ? null : creditMode ? artCredits - 1 : artCredits,
      usedCredit: creditMode,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
