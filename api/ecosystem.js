// 📊 Public ecosystem stats — the numbers behind the Pentaverse.
// Aggregates everything server-side so the browser gets one small payload and
// nobody's raw wallet/email data is ever exposed. No auth: these are public
// figures by design (scarcity you can watch is marketing).
//
// POST {} -> { totals, founding, rarity, universes, elements, archetypes,
//              vibes, thrones, leaderboard, battles }
const sbHeaders = {
  "Content-Type": "application/json",
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
};

const FOUNDING_TARGET = 111;
const PANTHEON = 12;

async function sbGet(path, extraHeaders = {}) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...sbHeaders, ...extraHeaders },
  });
  if (!r.ok) throw new Error(`${path.split("?")[0]}: ${await r.text()}`);
  return r.json();
}

// Counts occurrences across an array-of-arrays trait field.
function tally(rows, pick) {
  const counts = {};
  for (const row of rows) {
    const vals = pick(row);
    if (!Array.isArray(vals)) continue;
    for (const v of vals) {
      if (!v || typeof v !== "string") continue;
      counts[v] = (counts[v] || 0) + 1;
    }
  }
  return counts;
}

function topN(counts, n, total) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({
      name,
      count,
      pct: total ? Math.round((count / total) * 1000) / 10 : 0,
    }));
}

export default async function handler(req, res) {
  try {
    // Everything we need about mints, in one pull.
    const mints = await sbGet(
      "mints?select=character_name,rarity,card_tier,universe,element,traits,god_number,legendary_season,owner_wallet,created_at&limit=5000&order=created_at.asc"
    );
    const rows = Array.isArray(mints) ? mints : [];
    const total = rows.length;

    // Rarity / universe / element splits.
    const bucket = (key) => {
      const c = {};
      for (const r of rows) {
        const v = r[key] || "Unknown";
        c[v] = (c[v] || 0) + 1;
      }
      return c;
    };
    const rarityCounts = bucket("rarity");
    const universeCounts = bucket("universe");
    const elementCounts = bucket("element");

    const asList = (counts) =>
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          name,
          count,
          pct: total ? Math.round((count / total) * 1000) / 10 : 0,
        }));

    // Trait popularity — the percentage bubbles.
    const archetypes = topN(tally(rows, (r) => (r.traits || {}).archetypes), 12, total);
    const vibes = topN(tally(rows, (r) => (r.traits || {}).vibes), 10, total);
    const worlds = topN(tally(rows, (r) => (r.traits || {}).worlds), 8, total);

    // The pantheon.
    const thrones = rows
      .filter((r) => r.god_number)
      .sort((a, b) => a.god_number - b.god_number)
      .map((r) => ({
        n: r.god_number,
        name: r.character_name,
        universe: r.universe || null,
        element: r.element || null,
      }));

    const owners = new Set(rows.map((r) => r.owner_wallet).filter(Boolean));

    // Battles + leaderboard (wallets only — never emails).
    let leaderboard = [];
    let battleCount = 0;
    try {
      leaderboard = await sbGet("battle_ratings?select=wallet,rating,wins,losses&order=rating.desc&limit=10");
    } catch (e) {}
    try {
      const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/battles?select=id&limit=1`, {
        headers: { ...sbHeaders, Prefer: "count=exact", Range: "0-0" },
      });
      const range = r.headers.get("content-range") || "";
      battleCount = parseInt(range.split("/")[1], 10) || 0;
    } catch (e) {}

    return res.status(200).json({
      totals: {
        mints: total,
        holders: owners.size,
        battles: battleCount,
        thronesSeated: thrones.length,
        thronesTotal: PANTHEON,
      },
      founding: {
        target: FOUNDING_TARGET,
        claimed: Math.min(total, FOUNDING_TARGET),
        remaining: Math.max(0, FOUNDING_TARGET - total),
        complete: total >= FOUNDING_TARGET,
      },
      rarity: asList(rarityCounts),
      universes: asList(universeCounts),
      elements: asList(elementCounts),
      archetypes,
      vibes,
      worlds,
      thrones,
      leaderboard: (leaderboard || []).map((r) => ({
        wallet: r.wallet,
        rating: r.rating,
        wins: r.wins,
        losses: r.losses,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
