// Checks whether an email has an active subscription and returns their plan.
// The frontend calls this after the user enters their email to unlock their tier.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Missing email" });

  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(
      email.toLowerCase()
    )}&select=plan,status,updated_at`;
    const r = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    });
    const rows = await r.json();
    const sub = Array.isArray(rows) && rows[0];
    if (sub && sub.status === "active") {
      // one-time passes expire 30 days after purchase
      if (sub.plan === "pass" || sub.plan === "platinum_pass") {
        const updated = new Date(sub.updated_at || 0).getTime();
        const expired = Date.now() - updated > 30 * 24 * 60 * 60 * 1000;
        if (expired) return res.status(200).json({ active: false, plan: null, expired: true });
      }
      return res.status(200).json({ active: true, plan: sub.plan });
    }
    return res.status(200).json({ active: false, plan: null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
