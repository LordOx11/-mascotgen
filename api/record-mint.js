// Records a completed mint into the mints table — including the FULL character
// data (result_data jsonb: bio, origin story, tagline, launch package, viral
// moment) so wallet-sync can restore a mascot COMPLETELY on any device.
// Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY.
// Schema (run once in Supabase if columns are missing):
//   alter table public.mints add column if not exists result_data jsonb;
//   alter table public.mints add column if not exists universe text;
//   alter table public.mints add column if not exists god_number int;
//   alter table public.mints add column if not exists mark_number int;
//   alter table public.mints add column if not exists marked_by int;
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ---- action: "update-profile" — the REBUILD PROFILE repair path ----------
  if (req.body && req.body.action === "update-profile") {
    const { mintAddress, resultData, imageUrl } = req.body;
    if (!mintAddress || !resultData) return res.status(400).json({ error: "Missing mintAddress or resultData" });
    try {
      const payload = { result_data: resultData };
      if (imageUrl) payload.image_url = imageUrl;
      const resp = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/mints?mint_address=eq.${encodeURIComponent(mintAddress)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        }
      );
      if (!resp.ok) return res.status(502).json({ error: await resp.text() });
      const rows = await resp.json();
      return res.status(200).json({ updated: rows.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

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
    markNumber, // ✋ God-Marked seat (1-777), rolled by open-pack
    markedBy,   // which of the Twelve reached down (1-12)
    ageCard,    // ⏳ age overlay: champion_s1/s2 · demon · archangel
    ageNumber,  // number within that age's capped supply
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
          mark_number: markNumber || null,
          marked_by: markedBy || null,
          ...(ageCard ? { age_card: ageCard, age_number: ageNumber || null } : {}),
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
