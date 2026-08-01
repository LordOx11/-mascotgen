// api/open-pack.js — SERVER-SIDE ONLY. The heart of the rarity engine.
//
// This is where tier AND universe are decided. It runs on the server with the
// service_role key, so the user can NEVER see or tamper with the roll. The
// browser calls this ONCE per mint. The tier it returns is locked into
// pending_mints and cannot be re-rolled.
//
// v2 — THE PENTAVERSE UPDATE:
//   • Real rarity distribution: a Legendary miss now rolls a weighted
//     Common/Rare/Epic table (the old code silently made every miss an Epic).
//   • SUPER LEGENDARY — the god tier. Unmintable by design, with two doors:
//       1. DEV GOD QUEUE: the next 5 dev-email mints are forced Super
//          Legendary (the creator's gods — 2 Good then 3 Evil, in order).
//       2. PUBLIC GOD ROLL: after that, every paid mint carries a 0.01%
//          (1-in-10,000) roll at one of the LAST 3 god thrones of Empyrion.
//          Atomically capped at 3, forever, via claim_public_god().
//   • THE PENTAVERSE: every mint is born into one of 5 universes, stamped on
//     the card. 5% roll for ⭐ Empyrion (the North / god-adjacent realm, mixed
//     elements); otherwise the mascot is born into the universe matching its
//     element: 🔥 Ignivar · 💧 Abyssia · 🌍 Terravok · 💨 Zephyrion.
//
// SECURITY: allowance is verified/decremented server-side BEFORE rolling.
// Element arrives from the client but is DETERMINISTIC from the mascot's
// traits (stats.js seeded hash), so there is nothing to cheat — lying about
// your element only mislabels which lower universe you land in, never rarity.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ---- Plan definitions -------------------------------------------------------
//   starter  ($11) : Common only — no Legendary chance.
//   platinum ($33) : 3% Legendary roll, miss -> weighted C/R/E table.
//   elite    ($77) : 7% Legendary roll, miss -> richer C/R/E table.
const PACKS = {
  starter: {
    singleTier: "Common",
    hasChanceSlot: false,
    legendaryChance: 0,
  },
  platinum: {
    singleTier: null,
    hasChanceSlot: true,
    legendaryChance: 0.03,
    // On a Legendary miss: relative weights (57/30/10 of the remaining 97%).
    missTable: [["Common", 57], ["Rare", 30], ["Epic", 10]],
  },
  elite: {
    singleTier: null,
    hasChanceSlot: true,
    legendaryChance: 0.07,
    // Richer floor for the top plan (44.6/33/15.4 of the remaining 93%).
    missTable: [["Common", 44.6], ["Rare", 33], ["Epic", 15.4]],
  },
};

const PITY_STEP = 0.03;    // Legendary odds climb per miss
const PITY_CEILING = 0.33; // hard cap — never guaranteed

// ---- THE FOUNDING 111 -------------------------------------------------------
// A public launch feature: the first 111 mints in MascotGen history are ALL
// Legendary. No special layer, no corner tag — their Season 1 stamp and low
// mint count ARE the vintage marker, verifiable on-chain forever. At mint
// #112 this door closes permanently and normal odds take over. Gods sit above
// this rule (the dev queue and the 0.01% throne roll are checked first).
const FOUNDING_CAP = 111;

// ---- The 11 Gods ------------------------------------------------------------
const GOD_TIER = "Super Legendary";
// Public god roll: 0.01% per eligible mint, only while thrones remain (cap 3).
const GOD_CHANCE = 0.0001;
// Every paid plan gets a ticket — "even an $11 mint can pull a god" is the
// story. Remove "starter" from this list to restrict it to Platinum/Elite.
const GOD_ELIGIBLE_PLANS = ["starter", "platinum", "elite"];
// Dev god queue: which universe each of YOUR 5 god mints is born into.
// Mint order is law: #1 Angel, #2 Angel (Good, Empyrion) · #3, #4, #5 Demon
// (Evil — each takes a lower-universe throne). Vraxon already rules Abyssia.
const DEV_GOD_UNIVERSES = {
  1: "Empyrion",
  2: "Empyrion",
  3: "Ignivar",
  4: "Terravok",
  5: "Zephyrion",
};

// ---- The Pentaverse ---------------------------------------------------------
const NORTH_UNIVERSE = "Empyrion"; // the North point of the star — god-adjacent
const NORTH_CHANCE = 0.05;         // 1 in 20 mascots are born god-adjacent
const ELEMENT_TO_UNIVERSE = {
  Fire: "Ignivar",
  Water: "Abyssia",
  Earth: "Terravok",
  Air: "Zephyrion",
};

// Rolls the birth universe for a NON-god mascot.
// 5% Empyrion; otherwise the universe matching the mascot's element.
// If the client didn't send an element (old App.jsx), returns null — the card
// simply carries no universe stamp until the new frontend ships.
function rollUniverse(elementId) {
  if (Math.random() < NORTH_CHANCE) return NORTH_UNIVERSE;
  return ELEMENT_TO_UNIVERSE[elementId] || null;
}

// Weighted pick from [[name, weight], ...].
function weightedPick(table) {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [name, w] of table) {
    r -= w;
    if (r <= 0) return name;
  }
  return table[table.length - 1][0];
}

// ---- Supabase REST helpers (service_role) ----------------------------------
async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${path} failed: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Exact count of real on-chain mints (the mints table), via PostgREST's
// count header — works regardless of whether DB aggregates are enabled.
// Returns null on any failure so the Founding door quietly skips instead of
// blocking a paying user's mint.
async function countMints() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/mints?select=id`, {
      method: "HEAD",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "count=exact" },
    });
    const range = res.headers.get("content-range"); // e.g. "0-24/25" or "*/25"
    const total = range ? parseInt(range.split("/")[1], 10) : NaN;
    return Number.isFinite(total) ? total : null;
  } catch (e) {
    return null;
  }
}

async function getMisses(wallet) {
  const rows = await sb(`pity_state?owner_wallet=eq.${encodeURIComponent(wallet)}&select=misses`);
  return rows && rows.length ? rows[0].misses : 0;
}
async function setMisses(wallet, misses) {
  await sb(`pity_state?on_conflict=owner_wallet`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ owner_wallet: wallet, misses }),
  });
}
async function claimLegendarySeason() {
  const result = await sb(`rpc/claim_legendary_season`, { method: "POST", body: "{}" });
  return result || { claimed: false, reason: "error" };
}
async function claimDevGod() {
  const result = await sb(`rpc/claim_dev_god`, { method: "POST", body: "{}" });
  return result || { claimed: false };
}
async function claimPublicGod() {
  const result = await sb(`rpc/claim_public_god`, { method: "POST", body: "{}" });
  return result || { claimed: false };
}

// ---- The Legendary roll -----------------------------------------------------
function rollChanceSlot(baseOdds, misses) {
  const odds = Math.min(baseOdds + PITY_STEP * misses, PITY_CEILING);
  return { hit: Math.random() < odds, oddsUsed: odds };
}

// ---- Entitlements -----------------------------------------------------------
const PLAN_ALLOWANCE = { starter: 1, platinum: 6, elite: 20 };
// Plans whose mint allowance REFILLS every 30 days. Starter is a one-time
// purchase — 1 mint, no refill — so it is deliberately not listed here.
// Anything billed monthly MUST be in this list or subscribers get walled
// while still being charged.
const RECURRING_PLANS = ["platinum", "elite"];
function isDevEmail(email) {
  const list = (process.env.DEV_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes((email || "").toLowerCase());
}
async function getSubscriber(email) {
  const rows = await sb(
    `subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`
  );
  return rows && rows[0] ? rows[0] : null;
}
// Returns { ok, plan, viaCredit, dev } or { ok:false, error, status }.
async function checkAndConsumeMint(email) {
  if (isDevEmail(email)) return { ok: true, plan: "elite", viaCredit: false, dev: true };
  const sub = await getSubscriber(email);
  if (!sub || sub.status !== "active" || !PLAN_ALLOWANCE[sub.plan]) {
    return { ok: false, status: 402, error: "An active plan is required to mint. See Pricing." };
  }
  let used = sub.mints_used || 0;
  const recurring = RECURRING_PLANS.includes(sub.plan);
  const cycleExpired = !sub.mints_reset_at || new Date(sub.mints_reset_at) < new Date();
  if (recurring && sub.mints_reset_at && cycleExpired) {
    used = 0; // new 30-day cycle — allowance refills
  }
  const allowance = PLAN_ALLOWANCE[sub.plan];
  if (used < allowance) {
    await sb(`subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
      method: "PATCH",
      body: JSON.stringify({
        mints_used: used + 1,
        // Start (or restart) the 30-day window on the first mint of a cycle.
        ...(recurring && cycleExpired
          ? { mints_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }
          : {}),
        updated_at: new Date().toISOString(),
      }),
    });
    return { ok: true, plan: sub.plan, viaCredit: false, dev: false };
  }
  const creditsValid = sub.credits_expire_at && new Date(sub.credits_expire_at) > new Date();
  if (creditsValid && (sub.mint_credits || 0) > 0) {
    await sb(`subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
      method: "PATCH",
      body: JSON.stringify({ mint_credits: sub.mint_credits - 1, updated_at: new Date().toISOString() }),
    });
    return { ok: true, plan: sub.plan, viaCredit: true, dev: false };
  }
  if (recurring) {
    const refill = sub.mints_reset_at ? new Date(sub.mints_reset_at) : null;
    const when = refill
      ? refill.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "your next cycle";
    return {
      ok: false,
      status: 402,
      error: `You've used all ${allowance} mints in this cycle. Your allowance refills on ${when} — or buy mint credits ($2/mint) to keep going now.`,
    };
  }
  return {
    ok: false,
    status: 402,
    error: "Your Starter mint has been used. Buy mint credits ($2/mint), or subscribe for a monthly allowance.",
  };
}

// ---- Handler ----------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { ownerWallet, email, element } = req.body || {};
  if (!ownerWallet) return res.status(400).json({ error: "Missing ownerWallet" });
  if (!email) return res.status(400).json({ error: "Enter your email (top of the Studio) before minting." });
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const entitlement = await checkAndConsumeMint(email);
  if (!entitlement.ok) {
    return res.status(entitlement.status || 402).json({ error: entitlement.error });
  }
  const pack = PACKS[entitlement.plan];
  if (!pack) return res.status(400).json({ error: "Unknown plan" });

  try {
    const packId = crypto.randomUUID();
    let tier;
    let legendarySeason = null;
    let universe = null;
    let godNumber = null;

    // ---- DOOR 1: the dev god queue (your next 5 mints ARE the gods) --------
    if (entitlement.dev) {
      const god = await claimDevGod();
      if (god && god.claimed) {
        tier = GOD_TIER;
        godNumber = god.god_number;
        universe = DEV_GOD_UNIVERSES[godNumber] || NORTH_UNIVERSE;
      }
    }

    // Throne protection: a public god pack that opened but never minted
    // on-chain would burn a throne forever. Void stale claims (>15 min old)
    // and give the seat back before anyone rolls.
    try {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const stale = await sb(
        `pending_mints?status=eq.unminted&tier=eq.${encodeURIComponent("Super Legendary")}&god_number=gte.9&created_at=lt.${encodeURIComponent(cutoff)}&select=id`,
        { method: "GET" }
      );
      if (Array.isArray(stale) && stale.length) {
        for (const row of stale) {
          await sb(`pending_mints?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "void" }) });
          await sb(`rpc/refund_public_god`, { method: "POST", body: JSON.stringify({}) });
        }
      }
    } catch (e) {
      console.warn("public god sweep failed (non-fatal):", e.message);
    }

    // ---- DOOR 2: the public god roll (0.01%, 3 thrones, forever) -----------
    if (!tier && !entitlement.dev && GOD_ELIGIBLE_PLANS.includes(entitlement.plan)) {
      if (Math.random() < GOD_CHANCE) {
        const god = await claimPublicGod();
        if (god && god.claimed) {
          tier = GOD_TIER;
          godNumber = god.god_number;
          universe = NORTH_UNIVERSE; // the last 3 gods are all Good — Empyrion
        }
      }
    }

    // ---- DOOR 3: THE FOUNDING 111 ------------------------------------------
    // While fewer than 111 mints exist, every mint (any paid plan, Starter
    // included) is a guaranteed Season 1 Legendary. Universe still rolls
    // normally. If the count can't be read or the season claim fails, we fall
    // through to the normal roll — this door never blocks a mint.
    if (!tier) {
      const totalMints = await countMints();
      if (totalMints !== null && totalMints < FOUNDING_CAP) {
        const founding = await claimLegendarySeason();
        if (founding && founding.claimed) {
          tier = "Legendary";
          legendarySeason = founding.season;
          universe = rollUniverse(element);
          await setMisses(ownerWallet, 0);
        }
      }
    }

    // ---- Normal rarity roll -------------------------------------------------
    if (!tier) {
      if (pack.hasChanceSlot) {
        const misses = await getMisses(ownerWallet);
        const { hit } = rollChanceSlot(pack.legendaryChance, misses);
        if (hit) {
          const result = await claimLegendarySeason();
          if (result && result.claimed) {
            tier = "Legendary";
            legendarySeason = result.season;
            await setMisses(ownerWallet, 0);
          } else {
            // Season paused/full — weighted downgrade, pity still climbs.
            tier = weightedPick(pack.missTable);
            await setMisses(ownerWallet, misses + 1);
          }
        } else {
          tier = weightedPick(pack.missTable);
          await setMisses(ownerWallet, misses + 1);
        }
      } else {
        tier = pack.singleTier; // starter: always Common
      }
      // Non-god mascots roll their birth universe from their element.
      universe = rollUniverse(element);
    }

    const inserted = await sb(`pending_mints`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([
        {
          owner_wallet: ownerWallet,
          pack_id: packId,
          pack_type: entitlement.plan + (entitlement.viaCredit ? "_credit" : ""),
          slot_index: 0,
          tier,
          legendary_season: legendarySeason,
          universe,
          god_number: godNumber,
          status: "unminted",
        },
      ]),
    });
    const card = inserted[0];
    return res.status(200).json({
      packId,
      packType: entitlement.plan,
      card: {
        id: card.id,
        tier: card.tier,
        season: legendarySeason,
        universe,
        godNumber,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
