// Returns the current art credit balance for an email, without spending anything.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ credits: 0 });

  try {
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=art_credits`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const rows = await r.json();
    const credits = Array.isArray(rows) && rows[0] ? rows[0].art_credits || 0 : 0;
    return res.status(200).json({ credits });
  } catch (err) {
    return res.status(200).json({ credits: 0 });
  }
}
