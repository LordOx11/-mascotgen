// Wallet Sync — the ownership bridge.
// The frontend scans the connected wallet's token accounts and sends the list
// of NFT mint addresses here. We match them against our `mints` table and
// return the full mascot record for every match — INCLUDING mascots the wallet
// received via trade and never minted itself. Ownership = the wallet holds it.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ---- action: "close-pending" — folded in from the old close-pending.js ----
  if (req.body && req.body.action === "close-pending") {
    const { pendingId, mintAddress } = req.body;
    if (!pendingId || !mintAddress) return res.status(400).json({ error: "Missing pendingId or mintAddress" });
    try {
      const resp = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/pending_mints?id=eq.${encodeURIComponent(pendingId)}&status=eq.unminted`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify({ status: "minted", mint_address: mintAddress, minted_at: new Date().toISOString() }),
        }
      );
      if (!resp.ok) return res.status(502).json({ error: await resp.text() });
      const rows = await resp.json();
      return res.status(200).json({ updated: rows.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const { mints } = req.body || {};
  if (!Array.isArray(mints) || mints.length === 0) {
    return res.status(400).json({ error: "Send { mints: [addresses] }" });
  }
  const list = mints.slice(0, 500).filter((m) => typeof m === "string" && m.length > 20);
  if (list.length === 0) return res.status(200).json({ mascots: [] });

  try {
    const filter = `(${list.map((m) => `"${m}"`).join(",")})`;
    const url = `${process.env.SUPABASE_URL}/rest/v1/mints?mint_address=in.${encodeURIComponent(filter)}&select=*`;
    const r = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!r.ok) throw new Error(`Supabase query failed: ${await r.text()}`);
    const rows = await r.json();

    const mascots = (Array.isArray(rows) ? rows : []).map((row) => ({
      mintAddress: row.mint_address,
      characterName: row.character_name,
      tokenName: row.token_name,
      ticker: row.ticker,
      traits: row.traits || null,
      tier: row.card_tier || row.tier || row.rarity || null,
      element: row.element || null,
      legendarySeason: row.legendary_season || null,
      universe: row.universe || null,       // Pentaverse birth universe
      godNumber: row.god_number || null,    // throne number (Super Legendary only)
      markNumber: row.mark_number || null,  // ✋ God-Marked seat (1-777)
      markedBy: row.marked_by || null,      // which throne reached down (1-12)
      ageCard: row.age_card || null,        // ⏳ champion_s1/s2 · demon · archangel
      ageNumber: row.age_number || null,    // their number within the age's supply
      tokenAddress: row.token_address || null,   // 🚀 linked pump.fun token
      tokenUrl: row.token_url || null,
      tokenTelegram: row.token_telegram || null,
      imageUrl: row.image_url || null,
      resultData: row.result_data || null,
      mintedAt: row.created_at || null,
    }));

    return res.status(200).json({ mascots });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
