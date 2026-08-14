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

// ---- PITY ------------------------------------------------------------------
// A miss makes your NEXT roll better. Tuned so Legendary stays rare:
//   • GRACE — the first 5 misses do not move the needle. Without this the
//     step compounds immediately and the effective rate runs 2-5x the headline.
//   • STEP  — +1% per miss after the grace window.
//   • CEIL  — hard stop at 25%. A Legendary is never guaranteed.
// A Legendary hit resets misses to 0.
// EFFECTIVE RATES under this curve: Platinum 7.3% (1 in ~14), Elite 10.0%
// (1 in 10). Worst realistic dry streak: 26 mints on Platinum, 22 on Elite
// (95th percentile). These are the numbers the Pricing page publishes.
const PITY_STEP = 0.01;
const PITY_CEILING = 0.25;
const PITY_GRACE = 5;

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

// ---- ⏳ THE AGES ------------------------------------------------------------
// Automatic circulation. Once the LIFETIME mint count crosses an age's
// milestone, every paid mint (dev excluded) rolls the published odds at a card
// from that age's remaining supply — capped atomically by claim_age_card(), so
// the moment #666 of the demons is claimed the door shuts itself. The
// threshold check runs on every pack open — NO manual step is needed on
// milestone day. Champions reserve
// numbers 1-33 for the snapshot cut; the public pool hands out #34-333.
// One age card max per mint; when several ages are live at once the OLDEST
// unexhausted age rolls first (its supply is closest to gone).
const AGES = [
  { key: "champion_s1", at: 11111,  chance: 0.015, snapshotSeason: 1 },
  { key: "champion_s2", at: 33333,  chance: 0.015, snapshotSeason: 2 },
  { key: "demon",       at: 66666,  chance: 0.02 },
  { key: "archangel",   at: 111111, chance: 0.02 },
];
const AGE_ELIGIBLE_PLANS = ["starter", "platinum", "elite"];

// ---- The Pentaverse ---------------------------------------------------------
const NORTH_UNIVERSE = "Empyrion";
const NORTH_CHANCE = 0.05;   // 5% — Empyrion, the north point. 1 in 20. The four
                             // lower universes split the remaining 95% evenly
                             // (~23.75% each): element is a uniform hash roll, so
                             // no trait choice can tilt which realm you land in.
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
// ⏳ Atomically claims one card from an age's capped supply.
async function claimAgeCard(key) {
  try {
    const result = await sb(`rpc/claim_age_card`, { method: "POST", body: JSON.stringify({ p_key: key }) });
    return result || { claimed: false };
  } catch (e) {
    return { claimed: false };
  }
}
// ⚜️ Fires the champion snapshot the MOMENT the counter crosses the line.
// Idempotent and advisory-locked in SQL: a thousand simultaneous mints can
// all call this and exactly one snapshot happens.
async function snapshotChampions(season) {
  try {
    await sb(`rpc/snapshot_champions`, { method: "POST", body: JSON.stringify({ p_season: season }) });
  } catch (e) {
    console.warn("champion snapshot call failed (will retry on next mint):", e.message);
  }
}

function rollChanceSlot(baseOdds, misses) {
  const earned = Math.max(0, (misses || 0) - PITY_GRACE);
  const odds = Math.min(baseOdds + PITY_STEP * earned, PITY_CEILING);
  return { hit: Math.random() < odds, oddsUsed: odds };
}

// ---- Entitlements -----------------------------------------------------------
const PLAN_ALLOWANCE = { starter: 1, platinum: 5, elite: 10 };
const RECURRING_PLANS = ["platinum", "elite"];
function isDevEmail(email) {
  const list = (process.env.DEV_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes((email || "").toLowerCase());
}
// 🔐 THE DEV GATE — gods + free mints are the crown jewels, so dev status is
// now gated on the WALLET, not the email. An email string is guessable and
// arrives from the browser; before this, anyone who knew the dev email could
// type it in, connect THEIR OWN wallet, and mint the 5 gods to themselves.
// Now the connected wallet must be in DEV_WALLETS (comma-separated addresses).
// Since minting signs client-side with the connected wallet, an attacker can't
// even use your wallet address — they can't sign for it. Set DEV_WALLETS to
// your dev address before you mint the god queue.
function isDevWallet(wallet) {
  const list = (process.env.DEV_WALLETS || "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
  return list.includes((wallet || "").trim());
}
// Dev only when BOTH match if DEV_WALLETS is set (the secure path). If
// DEV_WALLETS is unset, we FAIL CLOSED — no dev bypass at all — because an
// email-only gate is not safe to ship. (You'll set DEV_WALLETS in Vercel.)
function isDev(email, wallet) {
  const walletList = (process.env.DEV_WALLETS || "").trim();
  if (!walletList) return false;            // fail closed: no allowlist, no gods
  return isDevWallet(wallet) && (isDevEmail(email) || !process.env.DEV_EMAILS);
}
async function getSubscriber(email) {
  const rows = await sb(
    `subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`
  );
  return rows && rows[0] ? rows[0] : null;
}
async function checkAndConsumeMint(email, ownerWallet) {
  if (isDev(email, ownerWallet)) return { ok: true, plan: "elite", viaCredit: false, dev: true };

  // ATOMIC PATH (load fix): consume_mint() locks the subscriber row so N
  // parallel requests can never all pass the same allowance check. Falls
  // through to the legacy read-then-patch ONLY if the SQL function isn't
  // installed yet — so deploying this file before running the SQL is safe.
  try {
    const r = await sb(`rpc/consume_mint`, { method: "POST", body: JSON.stringify({ p_email: email }) });
    if (r && typeof r.ok === "boolean") {
      if (r.ok) return { ok: true, plan: r.plan, viaCredit: !!r.via_credit, dev: false };
      if (r.reason === "no_plan") {
        return { ok: false, status: 402, error: "An active plan is required to mint. See Pricing." };
      }
      if (r.reason === "cycle_used") {
        const when = r.refill_at
          ? new Date(r.refill_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "your next cycle";
        return { ok: false, status: 402, error: `You've used all ${r.allowance} mints in this cycle. Your allowance refills on ${when} — or grab an extra-mint pack ($19.99) from the Pricing page to keep going now.` };
      }
      return { ok: false, status: 402, error: "Your Starter mint has been used. Grab an extra-mint pack from the Pricing page, or subscribe for a monthly allowance." };
    }
  } catch (e) {
    // Function missing or transient error — legacy path below.
  }

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
  // NULL expiry = credits never expire (the current policy). A date in the
  // future is also valid — legacy rows bought under the old month-end rule.
  const creditsValid = !sub.credits_expire_at || new Date(sub.credits_expire_at) > new Date();
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
      error: `You've used all ${allowance} mints in this cycle. Your allowance refills on ${when} — or grab an extra-mint pack ($19.99) from the Pricing page to keep going now.`,
    };
  }
  return {
    ok: false,
    status: 402,
    error: "Your Starter mint has been used. Grab an extra-mint pack from the Pricing page, or subscribe for a monthly allowance.",
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

  const entitlement = await checkAndConsumeMint(email, ownerWallet);
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
    let ageCard = null;
    let ageNumber = null;

    // One count, used everywhere below (Founding door, age gates, snapshot).
    const totalMints = await countMints();

    // ⚜️ CHAMPION SNAPSHOTS — the moment the counter is at/past a milestone,
    // make sure that season's snapshot exists. Runs on EVERY mint past the
    // line, so even if the crossing mint's call failed, the very next mint
    // repairs it. The SQL side is idempotent — this can never double-take.
    if (totalMints !== null) {
      for (const a of AGES) {
        if (a.snapshotSeason && totalMints >= a.at) await snapshotChampions(a.snapshotSeason);
      }
    }

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
    // ⏳ Stale AGE-CARD sweep — same 15-minute rule. Abandoned checkouts give
    // their number back to the pool. EXCEPTION: champion numbers 1-33 are the
    // snapshot cut's personal grants — void the stale row but never refund the
    // seat into the public pool; the champion just claims again.
    try {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const staleAges = await sb(
        `pending_mints?status=eq.unminted&age_card=not.is.null&created_at=lt.${encodeURIComponent(cutoff)}&select=id,age_card,age_number`,
        { method: "GET" }
      );
      if (Array.isArray(staleAges) && staleAges.length) {
        for (const row of staleAges) {
          const reserved = String(row.age_card || "").startsWith("champion") && row.age_number <= 33;
          await sb(`pending_mints?id=eq.${row.id}`, {
            method: "PATCH",
            body: JSON.stringify(reserved ? { status: "void" } : { status: "void", age_card: null, age_number: null }),
          });
          if (!reserved) {
            await sb(`rpc/refund_age_card`, { method: "POST", body: JSON.stringify({ p_key: row.age_card }) });
          }
        }
      }
    } catch (e) {
      console.warn("age card sweep failed (non-fatal):", e.message);
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

    // ---- ⏳ THE AGE ROLL — automatic circulation, no manual release ---------
    // For every age whose milestone the LIFETIME count has crossed, roll the
    // published odds at a card from its remaining supply. First hit wins (one
    // age card per mint); the atomic counter closes each age at its cap
    // forever. Never on a god, never on a dev mint.
    if (!godNumber && !entitlement.dev && totalMints !== null && AGE_ELIGIBLE_PLANS.includes(entitlement.plan)) {
      for (const a of AGES) {
        if (totalMints < a.at) continue;
        if (Math.random() >= a.chance) continue;
        const got = await claimAgeCard(a.key);
        if (got && got.claimed) {
          ageCard = a.key;
          ageNumber = got.number;
          break;
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
          // Only sent when an age card actually rolled — so deploying this
          // file BEFORE running ages-champions-pvp.sql can't break minting
          // (PostgREST rejects unknown columns even when null).
          ...(ageCard ? { age_card: ageCard, age_number: ageNumber } : {}),
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
        ageCard,
        ageNumber,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
