// api/open-pack.js — SERVER-SIDE ONLY. The heart of the rarity engine.
//
// This is where tier AND universe are decided. It runs on the server with the
// service_role key, so the user can NEVER see or tamper with the roll. The
// browser calls this ONCE per mint. The tier it returns is locked into
// pending_mints and cannot be re-rolled.
//
// v3 — THE GOD-MARKED UPDATE (adds to v2's Pentaverse engine):
//   • ✋ THE GOD-MARKED: every paid mint rolls a separate 0.1% (1-in-1,000)
//     chance that one of the Twelve reaches down. 777 marks will EVER exist,
//     enforced atomically via claim_god_mark(). The mark is an OVERLAY, not a
//     tier — it lands on any rarity (a Common can be marked). Gods cannot be
//     marked. Which throne marked you (1-12) is rolled server-side and
//     determines the Borrowed Power the card carries.
//   • Mark seats get the same stale-claim protection as god thrones: a marked
//     pack that never mints on-chain is voided after 15 minutes and the seat
//     refunded, so abandoned checkouts can't burn the 777.
//
// (v2 notes preserved: real rarity distribution · SUPER LEGENDARY dev queue +
//  0.01% public throne roll capped at 3 · the Pentaverse birth-universe roll.)
//
// SECURITY: allowance is verified/decremented server-side BEFORE rolling.
// Element arrives from the client but is DETERMINISTIC from the mascot's
// traits (stats.js seeded hash), so there is nothing to cheat — lying about
// your element only mislabels which lower universe you land in, never rarity.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ---- Plan definitions -------------------------------------------------------
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
    missTable: [["Common", 57], ["Rare", 30], ["Epic", 10]],
  },
  elite: {
    singleTier: null,
    hasChanceSlot: true,
    legendaryChance: 0.07,
    missTable: [["Common", 44.6], ["Rare", 33], ["Epic", 15.4]],
  },
};

const PITY_STEP = 0.03;
const PITY_CEILING = 0.33;

// ---- THE FOUNDING 333 -------------------------------------------------------
const FOUNDING_CAP = 333;

// ---- The Gods ---------------------------------------------------------------
const GOD_TIER = "Super Legendary";
const GOD_CHANCE = 0.0001; // 0.01% — the last 3 thrones
const GOD_ELIGIBLE_PLANS = ["starter", "platinum", "elite"];
const DEV_GOD_UNIVERSES = {
  1: "Empyrion",
  2: "Empyrion",
  3: "Ignivar",
  4: "Terravok",
  5: "Zephyrion",
};

// ---- ✋ THE GOD-MARKED ------------------------------------------------------
// 777 forever. 0.1% per paid mint. An overlay on any tier — never on a god.
// Dev mints are EXCLUDED: marks belong to the community's paid rolls, and dev
// bypass minting must not be able to drain the 777. (To mark a story
// character, set mark_number/marked_by directly in the DB — the seat still
// counts via the same counter, just claim it first with claim_god_mark.)
const MARK_CHANCE = 0.001;
const MARK_ELIGIBLE_PLANS = ["starter", "platinum", "elite"];

// ---- The Pentaverse ---------------------------------------------------------
const NORTH_UNIVERSE = "Empyrion";
const NORTH_CHANCE = 0.05;
const ELEMENT_TO_UNIVERSE = {
  Fire: "Ignivar",
  Water: "Abyssia",
  Earth: "Terravok",
  Air: "Zephyrion",
};

function rollUniverse(elementId) {
  if (Math.random() < NORTH_CHANCE) return NORTH_UNIVERSE;
  return ELEMENT_TO_UNIVERSE[elementId] || null;
}

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

async function countMints() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/mints?select=id`, {
      method: "HEAD",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "count=exact" },
    });
    const range = res.headers.get("content-range");
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
// ✋ Atomically claims one of the 777 mark seats. Returns
// { claimed, mark_number, marked_by } — marked_by (throne 1-12) is rolled in
// the database so the seat and the throne are decided in one transaction.
async function claimGodMark() {
  const result = await sb(`rpc/claim_god_mark`, { method: "POST", body: "{}" });
  return result || { claimed: false };
}

function rollChanceSlot(baseOdds, misses) {
  const odds = Math.min(baseOdds + PITY_STEP * misses, PITY_CEILING);
  return { hit: Math.random() < odds, oddsUsed: odds };
}

// ---- Entitlements -----------------------------------------------------------
const PLAN_ALLOWANCE = { starter: 1, platinum: 6, elite: 20 };
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
    used = 0;
  }
  const allowance = PLAN_ALLOWANCE[sub.plan];
  if (used < allowance) {
    await sb(`subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
      method: "PATCH",
      body: JSON.stringify({
        mints_used: used + 1,
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
    let markNumber = null;
    let markedBy = null;

    // ---- DOOR 1: the dev god queue -----------------------------------------
    if (entitlement.dev) {
      const god = await claimDevGod();
      if (god && god.claimed) {
        tier = GOD_TIER;
        godNumber = god.god_number;
        universe = DEV_GOD_UNIVERSES[godNumber] || NORTH_UNIVERSE;
      }
    }

    // Stale-claim sweeps: god thrones AND mark seats. A pack that opened but
    // never minted on-chain would burn its seat forever — void anything older
    // than 15 minutes and give the seat back before anyone rolls.
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
    try {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const staleMarks = await sb(
        `pending_mints?status=eq.unminted&mark_number=not.is.null&created_at=lt.${encodeURIComponent(cutoff)}&select=id`,
        { method: "GET" }
      );
      if (Array.isArray(staleMarks) && staleMarks.length) {
        for (const row of staleMarks) {
          await sb(`pending_mints?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "void", mark_number: null, marked_by: null }) });
          await sb(`rpc/refund_god_mark`, { method: "POST", body: JSON.stringify({}) });
        }
      }
    } catch (e) {
      console.warn("god mark sweep failed (non-fatal):", e.message);
    }

    // ---- DOOR 2: the public god roll (0.01%, 3 thrones, forever) -----------
    if (!tier && !entitlement.dev && GOD_ELIGIBLE_PLANS.includes(entitlement.plan)) {
      if (Math.random() < GOD_CHANCE) {
        const god = await claimPublicGod();
        if (god && god.claimed) {
          tier = GOD_TIER;
          godNumber = god.god_number;
          universe = NORTH_UNIVERSE;
        }
      }
    }

    // ---- DOOR 3: THE FOUNDING 333 ------------------------------------------
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
            tier = weightedPick(pack.missTable);
            await setMisses(ownerWallet, misses + 1);
          }
        } else {
          tier = weightedPick(pack.missTable);
          await setMisses(ownerWallet, misses + 1);
        }
      } else {
        tier = pack.singleTier;
      }
      universe = rollUniverse(element);
    }

    // ---- ✋ THE GOD-MARK ROLL (0.1%, 777 forever) ---------------------------
    // Independent of tier — an overlay on whatever was rolled above. Never on
    // a god (nobody lends power to something that has more of it), never on a
    // dev mint (marks belong to the community's paid rolls).
    if (!godNumber && !entitlement.dev && MARK_ELIGIBLE_PLANS.includes(entitlement.plan)) {
      if (Math.random() < MARK_CHANCE) {
        const mark = await claimGodMark();
        if (mark && mark.claimed) {
          markNumber = mark.mark_number;
          markedBy = mark.marked_by;
        }
      }
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
          mark_number: markNumber,
          marked_by: markedBy,
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
        markNumber,
        markedBy,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
