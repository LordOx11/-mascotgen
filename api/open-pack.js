// api/open-pack.js — SERVER-SIDE ONLY. The heart of the rarity engine.
//
// This is where tier is decided. It runs on the server with the service_role
// key, so the user can NEVER see or tamper with the roll. The browser calls
// this ONCE per mint (the Studio mints one crafted character at a time). The
// tier it returns is locked into pending_mints and cannot be re-rolled.
//
// Called at the moment the user commits to minting their crafted character:
//   1. Looks up the buyer's plan (starter/platinum/elite) to get the odds.
//   2. Rolls the single card's tier against those odds, boosted by the wallet's
//      current pity (capped at 33%). On a Legendary hit, atomically claims a
//      slot from the platform cap via claim_legendary(); if the cap is
//      exhausted, downgrades to the fallback tier.
//   3. Writes the one card to pending_mints (status 'unminted') and returns it
//      so the Battle Card can play the tier-reveal animation.
//
// WHY THIS SEALS THE EXPLOIT: the tier is rolled and LOCKED the instant the
// user commits a mint (spends an allowance), before they see the result. They
// can't cancel-and-reroll for free, because the allowance is already spent and
// the tier is already written.
//
// SECURITY NOTE: the buyer's mint allowance must be verified/decremented here,
// server-side, BEFORE rolling. Before Stripe is wired, gate this behind your
// dev bypass / free-credit check. Once Stripe is live, verify the plan +
// remaining allowance here — never trust the client to say "I paid."

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ---- Mint definitions ------------------------------------------------------
// The Studio mints ONE crafted character at a time, so every "pack" here is a
// SINGLE card. The tier for that one card is rolled at mint time. Which
// definition applies depends on the buyer's active plan (their remaining mint
// allowance is tracked/consumed elsewhere — see the entitlement TODO below).
//
//   starter  ($11) : Common only — no Legendary chance (keeps cheap tier from
//                    diluting the Legendary supply).
//   platinum ($33) : each mint has a 3% Legendary-chance roll.
//   elite    ($77) : each mint has a 7% Legendary-chance roll.
//
// hasChanceSlot=false means the single card is always the fixed tier.
// hasChanceSlot=true means the single card IS the Legendary-chance slot.
const PACKS = {
  starter: {
    // $11 one-time: a single Common card, no Legendary chance.
    fixedSlots: [], // the one card is the chance slot below? no — see hasChanceSlot
    singleTier: "Common",
    hasChanceSlot: false,
    legendaryChance: 0,
  },
  platinum: {
    // $33/mo: one crafted card, rolled with a 3% Legendary chance.
    fixedSlots: [],
    singleTier: null, // decided by the roll
    hasChanceSlot: true,
    legendaryChance: 0.03,
  },
  elite: {
    // $77: one crafted card, rolled with a 7% Legendary chance.
    fixedSlots: [],
    singleTier: null,
    hasChanceSlot: true,
    legendaryChance: 0.07,
  },
};

const PITY_STEP = 0.03;   // odds climb per miss
const PITY_CEILING = 0.33; // hard cap — never guaranteed
const CHANCE_FALLBACK = "Epic"; // what the chance slot becomes on a miss (or when cap exhausted)

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
  // Some calls (like RPC returning a scalar) may have a body; others don't.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function getMisses(wallet) {
  const rows = await sb(`pity_state?owner_wallet=eq.${encodeURIComponent(wallet)}&select=misses`);
  return rows && rows.length ? rows[0].misses : 0;
}

async function setMisses(wallet, misses) {
  // Upsert the pity row.
  await sb(`pity_state?on_conflict=owner_wallet`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ owner_wallet: wallet, misses }),
  });
}

async function claimLegendarySeason() {
  // Calls the atomic season-based claim. Returns the parsed result:
  //   { claimed: true, season: N } | { claimed: false, reason: '...' }
  const result = await sb(`rpc/claim_legendary_season`, { method: "POST", body: "{}" });
  // supabase RPC returns the jsonb directly
  return result || { claimed: false, reason: "error" };
}

// ---- The roll ---------------------------------------------------------------
function rollChanceSlot(baseOdds, misses) {
  const odds = Math.min(baseOdds + PITY_STEP * misses, PITY_CEILING);
  return { hit: Math.random() < odds, oddsUsed: odds };
}

// ---- Entitlements -----------------------------------------------------------
// Server-side allowance check. The client sends email; we derive the plan and
// remaining mints HERE — never trusting the client's claimed tier.
//   starter: 1 mint total · platinum: 6 per month (resets) · elite: 20 total
// After the allowance: consume mint_credits (which EXPIRE at month's end).
const PLAN_ALLOWANCE = { starter: 1, platinum: 6, elite: 20 };

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

// Returns { ok, plan, viaCredit } or { ok:false, error, status }.
async function checkAndConsumeMint(email) {
  if (isDevEmail(email)) return { ok: true, plan: "elite", viaCredit: false };

  const sub = await getSubscriber(email);
  if (!sub || sub.status !== "active" || !PLAN_ALLOWANCE[sub.plan]) {
    return { ok: false, status: 402, error: "An active plan is required to mint. See Pricing." };
  }

  let used = sub.mints_used || 0;
  // Platinum monthly reset.
  if (sub.plan === "platinum" && sub.mints_reset_at && new Date(sub.mints_reset_at) < new Date()) {
    used = 0;
  }

  const allowance = PLAN_ALLOWANCE[sub.plan];
  if (used < allowance) {
    await sb(`subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
      method: "PATCH",
      body: JSON.stringify({
        mints_used: used + 1,
        ...(sub.plan === "platinum" && (!sub.mints_reset_at || new Date(sub.mints_reset_at) < new Date())
          ? { mints_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }
          : {}),
        updated_at: new Date().toISOString(),
      }),
    });
    return { ok: true, plan: sub.plan, viaCredit: false };
  }

  // Allowance exhausted — try mint credits (valid only until month end).
  const creditsValid = sub.credits_expire_at && new Date(sub.credits_expire_at) > new Date();
  if (creditsValid && (sub.mint_credits || 0) > 0) {
    await sb(`subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
      method: "PATCH",
      body: JSON.stringify({ mint_credits: sub.mint_credits - 1, updated_at: new Date().toISOString() }),
    });
    return { ok: true, plan: sub.plan, viaCredit: true };
  }

  return {
    ok: false,
    status: 402,
    error:
      sub.plan === "platinum"
        ? "Monthly mints used up. Buy mint credits ($2/mint) or wait for your renewal."
        : "Plan mints used up. Buy mint credits to keep minting.",
  };
}

// ---- Handler ----------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { ownerWallet, email } = req.body || {};
  if (!ownerWallet) return res.status(400).json({ error: "Missing ownerWallet" });
  if (!email) return res.status(400).json({ error: "Enter your email (top of the Studio) before minting." });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  // Verify + consume one mint from the buyer's allowance/credits — server-side.
  const entitlement = await checkAndConsumeMint(email);
  if (!entitlement.ok) {
    return res.status(entitlement.status || 402).json({ error: entitlement.error });
  }
  // Odds come from the VERIFIED plan, not anything the client claimed.
  const pack = PACKS[entitlement.plan];
  if (!pack) return res.status(400).json({ error: "Unknown plan" });

  try {
    const packId = crypto.randomUUID();
    let tier;
    let legendarySeason = null;

    if (pack.hasChanceSlot) {
      // Single card, rolled with this plan's Legendary chance + pity.
      const misses = await getMisses(ownerWallet);
      const { hit } = rollChanceSlot(pack.legendaryChance, misses);

      if (hit) {
        // Atomically claim a Legendary slot in the ACTIVE season.
        const result = await claimLegendarySeason();
        if (result && result.claimed) {
          tier = "Legendary";
          legendarySeason = result.season; // stamp which season it belongs to
          await setMisses(ownerWallet, 0);  // reset pity on a real Legendary
        } else {
          // Season full with no next season defined (paused), or none active —
          // downgrade, but DON'T reset pity (they didn't actually get one).
          tier = CHANCE_FALLBACK;
          await setMisses(ownerWallet, misses + 1);
        }
      } else {
        tier = CHANCE_FALLBACK;
        await setMisses(ownerWallet, misses + 1); // miss -> pity climbs
      }
    } else {
      // Fixed-tier plan (starter): always the defined tier, no roll, no pity.
      tier = pack.singleTier;
    }

    // Persist the single card as a locked, unminted row (with season if Legendary).
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
          status: "unminted",
        },
      ]),
    });

    const card = inserted[0];

    // Return the locked card for the reveal animation on the Battle Card.
    return res.status(200).json({
      packId,
      packType: entitlement.plan,
      card: { id: card.id, tier: card.tier, season: legendarySeason },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
