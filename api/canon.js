// Portable canon — story chapters that travel WITH the NFT.
// GET-style (POST action:"get"): fetch all chapters for a list of mint addresses.
// POST action:"add": append a chapter to a mint's canon.
// Option C rules: original-creator chapters (is_original) are permanent; current
// owners add their own chapters on top. Ownership is asserted by the client's
// connected wallet for now (pre-launch); on-chain verification can be added
// later without changing this schema.
const sbHeaders = {
  "Content-Type": "application/json",
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { action } = req.body || {};

  try {
    if (action === "get") {
      const { mints } = req.body;
      if (!Array.isArray(mints) || mints.length === 0) {
        return res.status(400).json({ error: "Send { action:'get', mints: [addresses] }" });
      }
      const list = mints.slice(0, 200).filter((m) => typeof m === "string" && m.length > 20);
      const filter = `(${list.map((m) => `"${m}"`).join(",")})`;
      const r = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/canon_entries?mint_address=in.${encodeURIComponent(filter)}&select=*&order=created_at.asc`,
        { headers: sbHeaders }
      );
      if (!r.ok) throw new Error(await r.text());
      const rows = await r.json();
      return res.status(200).json({ entries: rows });
    }

    if (action === "add") {
      const { mintAddress, authorWallet, title, panels, isOriginal } = req.body;
      if (!mintAddress || !Array.isArray(panels) || panels.length === 0) {
        return res.status(400).json({ error: "Need mintAddress and panels[]" });
      }
      const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/canon_entries`, {
        method: "POST",
        headers: { ...sbHeaders, Prefer: "return=representation" },
        body: JSON.stringify([
          {
            mint_address: mintAddress,
            author_wallet: authorWallet || null,
            title: title || null,
            panels,
            is_original: !!isOriginal,
          },
        ]),
      });
      if (!r.ok) throw new Error(await r.text());
      const rows = await r.json();
      return res.status(200).json({ entry: rows[0] });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
