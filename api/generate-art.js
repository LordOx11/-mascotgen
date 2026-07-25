// Generates character art via fal.ai (FLUX models) and deducts one art credit.
// Env vars needed: FAL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
//
// fal.ai: sign up at https://fal.ai, create a key under Dashboard -> Keys.
// Verify the current endpoint/pricing against fal.ai's docs before going live —
// this uses their FLUX "schnell" model, their fastest/cheapest tier, good for
// stylized character art. Swap the MODEL_ENDPOINT below for a different Flux
// tier (e.g. flux/dev or flux-pro) if you want higher quality at a bit more cost.

const MODEL_ENDPOINT = "https://fal.run/fal-ai/flux/schnell";

// Dev testing bypass: emails listed in DEV_EMAILS (comma-separated env var)
// skip the credit check entirely so you can test real fal.ai generation
// without needing a real Stripe purchase or Supabase credit balance.
// This is server-side and tied to specific emails you control — NOT the
// public ?dev=1 URL flag, so it can't be triggered by anyone else.
function isDevEmail(email) {
  const list = (process.env.DEV_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes((email || "").toLowerCase());
}

async function getCredits(email) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=art_credits,plan,status`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : { art_credits: 0, plan: "free", status: "none" };
}

async function spendCredit(email, currentCredits) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ art_credits: currentCredits - 1, updated_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) throw new Error(`Failed to update credit balance: ${await res.text()}`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, prompt } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email required — connect your account to use art credits." });
  if (!prompt) return res.status(400).json({ error: "Missing art prompt" });

  try {
    const devBypass = isDevEmail(email);
    const subscriber = devBypass ? { art_credits: Infinity } : await getCredits(email);
    const credits = subscriber.art_credits || 0;

    if (!devBypass && credits < 1) {
      return res.status(402).json({ error: "No art credits remaining", needsCredits: true });
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

    // Only spend the credit after a successful generation. Dev emails never get charged.
    if (!devBypass) {
      await spendCredit(email, credits);
    }

    return res.status(200).json({
      imageUrl: data.images[0].url,
      creditsRemaining: devBypass ? "∞ (dev)" : credits - 1,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
