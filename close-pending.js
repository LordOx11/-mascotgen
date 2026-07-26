// api/close-pending.js — SERVER-SIDE. Marks a locked pending_mints row as
// 'minted' once the on-chain mint succeeds. Runs with service_role so the
// browser can't flip statuses on its own.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { pendingId, mintAddress } = req.body || {};
  if (!pendingId || !mintAddress) {
    return res.status(400).json({ error: "Missing pendingId or mintAddress" });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  try {
    // Only flip rows that are still 'unminted' — prevents double-processing.
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/pending_mints?id=eq.${encodeURIComponent(pendingId)}&status=eq.unminted`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          status: "minted",
          mint_address: mintAddress,
          minted_at: new Date().toISOString(),
        }),
      }
    );
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(502).json({ error: text });
    }
    const rows = await resp.json();
    return res.status(200).json({ updated: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
