// record-mint.js — writes a completed mint into the `mints` table in Supabase.
// This is the foundation for all ecosystem stats, holder tracking, and leaderboards.
// Called by the frontend right after a successful on-chain mint.
//
// The blockchain remains the source of truth for ownership; this table is just a
// fast, queryable index so we don't have to scan the chain for every stats page.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { mintAddress, characterName, tokenName, ticker, ownerWallet, traits, stats, rarity, imageUrl } =
    req.body || {};

  if (!mintAddress) return res.status(400).json({ error: "Missing mint address" });

  // If Supabase isn't configured, don't hard-fail the mint — just skip recording.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(200).json({ recorded: false, reason: "Supabase not configured" });
  }

  try {
    const row = {
      mint_address: mintAddress,
      character_name: characterName || null,
      token_name: tokenName || null,
      ticker: ticker || null,
      owner_wallet: ownerWallet || null,
      traits: traits || null,
      stats: stats || null,
      rarity: rarity || null,
      card_tier: stats?.tier || null,
      power: stats?.power ?? null,
      hp: stats?.hp ?? null,
      speed: stats?.speed ?? null,
      special: stats?.special ?? null,
      image_url: imageUrl || null,
    };

    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/mints`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        Prefer: "resolution=merge-duplicates", // idempotent on mint_address
      },
      body: JSON.stringify(row),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ recorded: false, error: text });
    }

    return res.status(200).json({ recorded: true });
  } catch (err) {
    return res.status(500).json({ recorded: false, error: err.message });
  }
}
