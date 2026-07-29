// Records a completed mint into the mints table — including the FULL character
// data (result_data jsonb: bio, origin story, tagline, launch package, viral
// moment) so wallet-sync can restore a mascot COMPLETELY on any device.
// Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY.
// Schema (run once in Supabase if columns are missing):
//   alter table public.mints add column if not exists result_data jsonb;
//   alter table public.mints add column if not exists universe text;
//   alter table public.mints add column if not exists god_number int;
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    mintAddress,
    characterName,
    tokenName,
    ticker,
    ownerWallet,
    traits,
    tier,
    rarity,
    element,
    legendarySeason,
    universe,   // Pentaverse birth universe, rolled by open-pack
    godNumber,  // throne number, set only for Super Legendary pulls
    imageUrl,
    resultData, // the entry's full result object (bio, story, launch package…)
  } = req.body || {};

  if (!mintAddress || !characterName) {
    return res.status(400).json({ error: "Missing mintAddress or characterName" });
  }

  try {
    const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/mints`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify([
        {
          mint_address: mintAddress,
          character_name: characterName,
          token_name: tokenName || null,
          ticker: ticker || null,
          owner_wallet: ownerWallet || null,
          traits: traits || null,
          card_tier: tier || rarity || null,
          rarity: rarity || tier || null,
          element: element || null,
          legendary_season: legendarySeason || null,
          universe: universe || null,
          god_number: godNumber || null,
          image_url: imageUrl || null,
          result_data: resultData || null,
        },
      ]),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(502).json({ error: text });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
