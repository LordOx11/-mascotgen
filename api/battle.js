// ⚔️ THE BATTLE ARENA (Phase 1: Ghost Battles)
// Simulates a full 3v3 auto-battle server-side using each card's REAL stats —
// the same deterministic engine that prints the cards (imported from
// src/stats.js) — so nothing can be faked from the browser.
//
// Actions:
//   "simulate"    { challengerWallet, teamMints:[up to 3], opponentWallet? }
//                 -> runs the fight, stores the replay, updates ratings
//   "leaderboard" -> top 20 by rating
//
// Rules implemented: SPD turn order (+Momentum), element triangle (1.25x/0.8x),
// PWR damage scaling, shields, heals, drains, stuns, Double Strike, Reflect,
// Lifesteal, Element Flip, Regeneration, Thorns, Void Send (banishes a benched
// fighter), Undying (survive lethal once) — and all 8 God abilities.
//
// If the Vercel build can't resolve the src import below, copy src/stats.js to
// api/stats-engine.js and change the import path to "./stats-engine.js".
import { computeStats } from "../src/stats.js";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// 🔐 WALLET-SIGNATURE AUTH
// Any action that ASSERTS a wallet identity ("I am wallet X, publish/battle/
// claim as me") must PROVE it. Without this, anyone could send someone else's
// wallet string and: tank their Elo with deliberate losses before the champion
// snapshot, burn their daily caps, unpublish their chapters, overwrite their
// Writer's Bible, move for them in PvP, or hijack their champion claim.
// The client signs `mascotgen-auth:{wallet}:{bucket}` (10-minute buckets, so
// ONE wallet popup per 10 minutes, reused across actions). Verified here with
// Node's built-in ed25519 — zero new dependencies.
// Escape hatch during rollout: set WALLET_AUTH_OPTIONAL=1 in Vercel to
// log-and-allow instead of reject (remove it once the new client is live).
// ---------------------------------------------------------------------------
const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(str) {
  let n = 0n;
  for (const c of String(str)) {
    const i = B58_ALPHABET.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const c of String(str)) { if (c === "1") bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}

const AUTH_WINDOW_MS = 10 * 60 * 1000;
function verifyWalletAuth(wallet, auth) {
  try {
    if (!wallet || !auth || !auth.signature || typeof auth.bucket !== "number") return false;
    const nowBucket = Math.floor(Date.now() / AUTH_WINDOW_MS);
    if (auth.bucket !== nowBucket && auth.bucket !== nowBucket - 1) return false;
    const pub = b58decode(wallet);
    if (!pub || pub.length !== 32) return false;
    const sig = Buffer.from(String(auth.signature), "base64");
    if (sig.length !== 64) return false;
    const msg = Buffer.from(`mascotgen-auth:${wallet}:${auth.bucket}`);
    const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pub)]);
    const key = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
    return crypto.verify(null, msg, key, sig);
  } catch (e) {
    return false;
  }
}

function requireAuth(wallet, auth) {
  if (verifyWalletAuth(wallet, auth)) return null;
  if (process.env.WALLET_AUTH_OPTIONAL === "1") {
    console.warn("wallet auth missing/invalid (allowed by WALLET_AUTH_OPTIONAL):", wallet);
    return null;
  }
  return "This action requires a wallet signature. Refresh the page and approve the signature prompt when it appears.";
}

// 📡 VERSE NEWS — the official broadcast. Only the studio posts here, and the
// gate is the WALLET (signature-verified), never an email or a client flag.
// Set DEV_WALLETS in Vercel — the same allowlist that guards the god queue and
// the studio reserve. Fails CLOSED: no allowlist, nobody can post.
function isOwnerWallet(wallet) {
  const list = (process.env.DEV_WALLETS || "").split(",").map((w) => w.trim()).filter(Boolean);
  if (!list.length) return false;
  return list.includes(String(wallet || "").trim());
}

// Thrones whose occupant is not public yet. Identity is withheld SERVER-SIDE
// in every endpoint — stats, gallery, anything future — so the secret can't be
// read out of a network response. Reveal day = remove the number from this list.
const SEALED_THRONES = [12];

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const sbHeaders = {
  "Content-Type": "application/json",
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
};

async function sb(path, options = {}, _retry = 0) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    ...options,
    headers: { ...sbHeaders, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    // ⏰ PGRST303 "JWT issued at future" is a CLOCK-SKEW error, not a broken
    // key: PostgREST compares the token's issued-at against the database
    // server's clock with zero leeway, so a second or two of drift between
    // Supabase's auth issuer and its database makes a perfectly valid service
    // key bounce — intermittently, on some calls and not others, which is
    // exactly how it looks in the wild. It clears itself within seconds, so
    // one short retry turns a scary red error into nothing the user ever sees.
    if (res.status === 401 && /PGRST303|issued at future/i.test(body) && _retry < 2) {
      await new Promise((r) => setTimeout(r, 900));
      return sb(path, options, _retry + 1);
    }
    throw new Error(`Supabase ${path.split("?")[0]} failed: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const BEATS = { Fire: "Earth", Earth: "Air", Air: "Water", Water: "Fire" };

function makeFighter(row) {
  const traits = row.traits || {};
  // Consistency fix: the arena must honor EVERYTHING the card carries — the
  // God-Mark (+77 HP, Borrowed Power) and any age card (333/666/777 HP + age
  // ability). Before this, a marked card fought as if unmarked.
  const stats = computeStats(
    { ...traits, characterName: row.character_name, element: row.element || undefined },
    row.card_tier || row.rarity || null,
    row.marked_by || null,
    row.age_card || null,
    row.age_number || null,     // the Watchers pick their power BY number
    // ⏳ GENESIS ERA: minted, but before the Pentaverse existed — so it carries
    // no universe. The oldest beings alive, and no more can ever be made.
    !!row.mint_address && !row.universe,
    // ⚜️ THE FOUNDING 333 — the founder's seat is the MINT NUMBER (the global
    // counter: first 333 mints, Legendaries only). NOT legendary_season: that
    // column is the season cohort and reads "1" on every first-season card,
    // which is how every founder briefly showed "FOUNDER #1".
    (row.card_tier || row.rarity) === "Legendary" && row.mint_number >= 1 && row.mint_number <= 333 ? row.mint_number : null
  );
  return {
    name: row.character_name,
    mint: row.mint_address,
    image: row.image_url || null,
    tier: row.card_tier || row.rarity || "Common",
    isGod: (row.card_tier || row.rarity) === "Super Legendary",
    element: stats.element ? stats.element.id : "Fire",
    hp: stats.hpPoints,
    maxHp: stats.hpPoints,
    shield: 0,
    power: stats.power,
    speed: stats.speed,
    special: stats.special,
    sigs: stats.signatures || [],
    abilities: stats.abilities || [],
    ageCard: row.age_card || null,   // ⚜️/😈/🕊️/⚔️/👁️/🕳️ — drives the age mechanics
    ageNumber: row.age_number || null,
    genesis: !!row.mint_address && !row.universe,
    debuffs: [],                     // { stat, amount, rounds } — ticked each round
    // The one age ability this card actually rolled, pre-resolved so the
    // damage / round hooks don't re-scan the ability list every swing.
    ageOp: ((stats.abilities || []).find((x) => x && x.op) || {}).op || null,
    ageName: ((stats.abilities || []).find((x) => x && x.op) || {}).name || "",
    ageIcon: ((stats.abilities || []).find((x) => x && x.op) || {}).icon || "",
    used: {}, // once-per-battle trackers
    hitsTaken: 0,
    momentum: 0,
  };
}

// simulate() MUTATES its fighters — hp drops, once-per-battle flags get set. A
// clan war runs several bouts in a row, so each one needs a clean copy or the
// second fight starts with the first fight's wounds.
function makeFighter0(f) {
  return { ...f, hp: f.maxHp, shield: 0, used: {}, debuffs: [], hitsTaken: 0, momentum: 0, stunned: false, banished: false };
}

const has = (f, id) => (f.abilities || []).some((a) => a.id === id || a.kind === id);
const god = (f, name) => f.isGod && f.name === name;

// ---- ⏳ THE AGES — a data-driven ability engine ----------------------------
// Age abilities used to be hand-written branches here, which capped every age
// at 3-4 shared powers: with 666 demons that meant ~166 cards to a name. They
// are DATA now (see stats.js). Each ability carries an `op` this engine knows
// how to execute, so growing a pool to nine or twelve distinct powers costs
// one array entry and no engine work at all.
// Balance knobs — measured over thousands of simulated battles.
// CHAMP_GIANT_CAP is set so the Demon stays the favourite in the matchup the
// prophecy is built around (Demons win ~53/47). UNDERDOG_* exist so a Common
// facing a 666 HP Demon has a puncher's chance instead of a guaranteed loss.
const CHAMP_GIANT_CAP = 1.5;
const UNDERDOG_MIN = 1.15;
const UNDERDOG_CAP = 2;

const isChampion = (f) => String(f.ageCard || "").startsWith("champion_");

function addDebuff(f, stat, amount, rounds, rec, text, ev) {
  f.debuffs.push({ stat, amount, rounds });
  f[stat] = Math.max(1, f[stat] - amount);
  rec(text, ev);
}
// Called once per round: expires anything whose clock ran out and gives the
// stat back. Without this, "-2 Power for 3 rounds" would be a lie.
function tickDebuffs(f, rec) {
  if (!f.debuffs.length) return;
  const still = [];
  for (const d of f.debuffs) {
    d.rounds--;
    if (d.rounds > 0) still.push(d);
    else {
      f[d.stat] = f[d.stat] + d.amount;
      rec(`⏳ ${f.name} shakes it off — ${d.stat} restored.`, { t: "info" });
    }
  }
  f.debuffs = still;
}

// ---- ⚖️ WEIGHT CLASSES — the real protection for the lower tiers ----------
// Damage multipliers cannot rescue a 150 HP Common from a 666 HP Demon; no
// multiplier can. What rescues it is not being matched against one in the
// first place. Random-opponent matchmaking used to draw uniformly from every
// wallet in the table, so the day the Demon Age lands, a Common-only roster
// starts eating unwinnable fights it never opted into. Now the draw is banded:
// same class first, one class up or down if the pool is thin, open field only
// as a last resort — so the aspiration of meeting something enormous survives
// without it becoming the default Tuesday.
const CLASS_OF_AGE = {
  champion_s1: 3, champion_s2: 3, champion_s3: 3,
  demon: 4, archangel: 4,
  deep_legion: 5, watcher: 5, watcher_prime: 5,
  deep7: 5, deep7_seed: 5,
  deep6: 5, deep5: 5, deep4: 5, deep3: 5, deep2: 5, deep1: 5,
};
function weightClass(row) {
  if (row.age_card && CLASS_OF_AGE[row.age_card]) return CLASS_OF_AGE[row.age_card];
  const t = row.card_tier || row.rarity;
  if (t === "Super Legendary") return 4;   // gods fight in the age-card band
  if (t === "Legendary" || t === "Epic") return 2;
  return 1;
}
// A roster fights at the weight of its heaviest card.
const rosterClass = (rows) => rows.reduce((m, r) => Math.max(m, weightClass(r)), 1);

// Picks an opponent wallet from `all`, banded against the challenger's class.
function pickBandedOpponent(all, myClass) {
  const byWallet = new Map();
  for (const r of all) {
    if (!r.owner_wallet) continue;
    if (!byWallet.has(r.owner_wallet)) byWallet.set(r.owner_wallet, []);
    byWallet.get(r.owner_wallet).push(r);
  }
  const wallets = [...byWallet.keys()];
  if (!wallets.length) return null;
  const inBand = (span) => wallets.filter((w) => Math.abs(rosterClass(byWallet.get(w)) - myClass) <= span);
  const pool = (inBand(0).length ? inBand(0) : inBand(1).length ? inBand(1) : wallets);
  const w = pool[Math.floor(Math.random() * pool.length)];
  return { wallet: w, rows: byWallet.get(w) };
}


// Event recorder: every log line gets a structured twin the stage can animate.
function makeRec() {
  const events = [];
  const rec = (text, ev) => events.push({ text, ...(ev || { t: "info" }) });
  return { events, rec };
}

function elemMult(att, def) {
  // ⏳ ELDER — the Genesis Era predates the elements being sorted into a wheel,
  // so the wheel does not apply to them. They still gain an advantage when they
  // hold one; they simply never suffer one. Applies to attack AND defence.
  const attElder = att.genesis, defElder = def.genesis;
  if (BEATS[att.element] === def.element) return defElder ? 1.0 : 1.25;
  if (BEATS[def.element] === att.element) return attElder ? 1.0 : 0.8;
  return 1.0;
}

function dealDamage(att, def, raw, rec, tag) {
  // Corvaxis — Void Waltz: every 3rd attack against him misses entirely.
  def.hitsTaken++;
  if (god(def, "Corvaxis") && def.hitsTaken % 3 === 0) {
    rec(`🌀 ${def.name} waltzes into the void — ${att.name}'s attack touches NOTHING!`, { t: "miss", attacker: att.name, target: def.name, god: "Void Waltz" });
    return 0;
  }
  let dmg = Math.round(raw * elemMult(att, def) * (1 + (att.power - 5) * 0.03) * (0.9 + Math.random() * 0.2));
  // Gravel Mortis — The House Always Wins: incoming hits always roll minimum.
  if (god(def, "Gravel Mortis")) dmg = Math.round(raw * elemMult(att, def) * (1 + (att.power - 5) * 0.03) * 0.9);
  // Aethon — Heaven's Bulwark: ALL damage halved.
  if (god(def, "Aethon Ironveil")) dmg = Math.ceil(dmg / 2);

  // ⚜️/🕊️/⚔️ RESOLVE — "below X% HP, damage +Y%". Cornered, and it shows.
  const ao = att.ageOp;
  if (ao && ao.t === "resolve" && att.hp < att.maxHp * ao.below) dmg = Math.round(dmg * ao.mult);
  // EXECUTE — "+Y% against a target already under X%". The killer instinct.
  if (ao && ao.t === "execute" && def.hp < def.maxHp * ao.below) dmg = Math.round(dmg * ao.mult);

  // ⚜️ GIANT-SLAYER — intrinsic to EVERY Champion card, no roll required.
  // Damage scales by how much bigger the target is, hard-capped at 1.5x. A
  // 333 HP Champion therefore hits a 666 HP Demon half again as hard, which is
  // what lets 666 Champions stand in front of 666 Demons at all. Against a
  // 150 HP Common the ratio is below 1 and this does NOTHING, so Champions can
  // never become a problem for the lower tiers. The prophecy assembles
  // Champions rather than minting more gods for exactly this reason.
  if (isChampion(att) && def.maxHp > att.maxHp) {
    dmg = Math.round(dmg * Math.min(def.maxHp / att.maxHp, CHAMP_GIANT_CAP));
  }
  // 🐜 UNDERDOG — universal, everyone gets it. Anything facing an opponent more
  // than 1.15x its size hits harder, scaling with the gap. Same-weight
  // matchups are untouched; this exists only so a Common is never pure food.
  else if (def.maxHp > att.maxHp * UNDERDOG_MIN) {
    dmg = Math.round(dmg * Math.min(def.maxHp / att.maxHp, UNDERDOG_CAP));
  }

  // Reflect (once): bounce a big hit back.
  if (!def.used.reflect && has(def, "reflect") && dmg >= 55 && !god(att, "Seraphine Valdur")) {
    def.used.reflect = true;
    att.hp -= dmg;
    rec(`👥 ${def.name} REFLECTS the attack — ${dmg} damage bounces back at ${att.name}!`, { t: "reflect", attacker: att.name, target: def.name, dmg, hpAfter: Math.max(0, att.hp) });
    return 0;
  }
  // Shields absorb first — Toro pierces them.
  if (def.shield > 0 && !god(att, "Toro Maximus")) {
    const absorbed = Math.min(def.shield, dmg);
    def.shield -= absorbed;
    dmg -= absorbed;
    if (absorbed > 0) rec(`🛡 ${def.name}'s shield absorbs ${absorbed}.`, { t: "shieldAbsorb", target: def.name, absorbed, shieldAfter: def.shield });
  } else if (def.shield > 0 && god(att, "Toro Maximus")) {
    rec(`🐂 ${att.name}'s blessed horns PIERCE straight through the shield!`, { t: "pierce", attacker: att.name, target: def.name, god: "Blessed Horizon" });
  }
  if (dmg > 0) {
    def.hp -= dmg;
    rec(`${tag} ${att.name} hits ${def.name} for ${dmg}! (${Math.max(0, def.hp)} HP left)`, { t: "hit", attacker: att.name, target: def.name, dmg, hpAfter: Math.max(0, def.hp) });
    // LEECH — the attacker drinks a share of whatever it just opened.
    if (ao && ao.t === "leech") {
      const drank = Math.max(1, Math.round(dmg * ao.pct));
      att.hp = Math.min(att.maxHp, att.hp + drank);
      rec(`${att.ageIcon || "🩸"} ${att.name} drinks ${drank} back through ${att.ageName}. (${att.hp} HP)`, { t: "heal", name: att.name, amount: drank, hpAfter: att.hp, lifesteal: true });
    }
    // COUNTER — answer instantly for a % of the ATTACKER's max HP. The bigger
    // they are, the more their own weight costs them.
    const dof = def.ageOp;
    if (dof && dof.t === "counter" && def.hp > 0) {
      const counter = Math.max(8, Math.round(att.maxHp * dof.pct));
      att.hp -= counter;
      rec(`${def.ageIcon || "🥊"} ${def.name} answers with ${def.ageName} for ${counter}!`, { t: "hit", attacker: def.name, target: att.name, dmg: counter, hpAfter: Math.max(0, att.hp), counter: true });
    }
    // BELL — once, the moment they're driven under the line, the exchange is
    // cut short and health comes back in the corner.
    if (dof && dof.t === "bell" && !def.used.bell && def.hp > 0 && def.hp < def.maxHp * dof.below) {
      def.used.bell = true;
      def.hp = Math.min(def.maxHp, def.hp + dof.heal);
      rec(`🔔 ${def.ageName.toUpperCase()} — the round is cut short and ${def.name} recovers ${dof.heal}! (${def.hp} HP)`, { t: "heal", name: def.name, amount: dof.heal, hpAfter: def.hp, bell: true });
    }
    // Thorns passive.
    if (has(def, "thorns")) {
      att.hp -= 10;
      rec(`🌵 ${def.name}'s thorns sting ${att.name} for 10.`, { t: "hit", attacker: def.name, target: att.name, dmg: 10, hpAfter: Math.max(0, att.hp), thorns: true });
    }
    // Lifesteal (once, on a solid hit).
    if (!att.used.lifesteal && has(att, "lifesteal") && dmg >= 40) {
      att.used.lifesteal = true;
      const healed = Math.round(dmg * 0.5);
      att.hp = Math.min(att.maxHp, att.hp + healed);
      rec(`🔗 ${att.name} drains ${healed} HP from the wound!`, { t: "heal", name: att.name, amount: healed, hpAfter: att.hp, lifesteal: true });
    }
  }
  return dmg;
}

function checkDown(f, rec) {
  if (f.hp > 0) return false;
  if (f.banished) return true; // banished fighters are simply gone — no double KO
  // Undying: survive lethal once (gods have it too).
  if (!f.used.undying && (has(f, "revive") || f.isGod)) {
    f.used.undying = true;
    f.hp = 1;
    rec(`♾️ ${f.name} refuses to fall — UNDYING holds them at 1 HP!`, { t: "undying", name: f.name });
    return false;
  }
  rec(`💥 ${f.name} is KNOCKED OUT!`, { t: "ko", name: f.name });
  return true;
}

// ACTIVE AGE MOVES — one dispatcher for every age, every ability. Returns true
// if the age ability consumed the turn. Ordered before the generic action
// picker so an age card always leads with what makes it an age card.
function ageTurn(att, def, rec) {
  const op = att.ageOp;
  if (!op) return false;
  const icon = att.ageIcon || "⏳";
  const name = att.ageName || "its power";

  switch (op.t) {
    case "hit": {
      if (op.once && att.used.ageHit) return false;
      if (att.hp <= (op.selfCost || 0) + 1) return false;   // never suicide
      if (Math.random() >= (op.freq != null ? op.freq : 0.4)) return false;
      att.used.ageHit = true;
      if (op.selfCost) {
        att.hp -= op.selfCost;
        rec(`${icon} ${att.name} pays ${op.selfCost} of its own to fuel ${name}!`, { t: "info" });
      } else {
        rec(`${icon} ${att.name} calls ${name}!`, { t: "info" });
      }
      const swings = op.times || 1;
      for (let n = 0; n < swings && def.hp > 0; n++) {
        if (op.unavoidable) {
          // Bypasses shields, evasion and every mitigation in the game.
          def.hp -= op.dmg;
          rec(`${icon} ${name.toUpperCase()} lands on ${def.name} for ${op.dmg} — unavoidable. (${Math.max(0, def.hp)} HP left)`, { t: "hit", attacker: att.name, target: def.name, dmg: op.dmg, hpAfter: Math.max(0, def.hp), unavoidable: true });
        } else if (op.pierce) {
          const held = def.shield; def.shield = 0;     // ignores shields outright
          dealDamage(att, def, op.dmg, rec, icon);
          def.shield = held > 0 ? held : 0;
        } else {
          dealDamage(att, def, op.dmg, rec, icon);
        }
      }
      if (op.healOnKo && def.hp <= 0) {
        att.hp = Math.min(att.maxHp, att.hp + op.healOnKo);
        rec(`${icon} ${att.name} feasts and recovers ${op.healOnKo} HP! (${att.hp} HP)`, { t: "heal", name: att.name, amount: op.healOnKo, hpAfter: att.hp });
      }
      return true;
    }
    case "heal": {
      if (att.used.ageHeal) return false;
      if (att.hp >= att.maxHp * (op.when != null ? op.when : 0.5)) return false;
      att.used.ageHeal = true;
      const before = att.hp;
      att.hp = Math.min(att.maxHp, att.hp + op.amount);
      rec(`${icon} ${att.name} uses ${name} and recovers ${Math.round(att.hp - before)} HP! (${att.hp} HP)`, { t: "heal", name: att.name, amount: Math.round(att.hp - before), hpAfter: att.hp });
      return true;
    }
    case "shield": {
      if (att.used.ageShield || att.shield > 0) return false;
      if (att.hp >= att.maxHp * (op.when != null ? op.when : 0.7)) return false;
      att.used.ageShield = true;
      att.shield += op.amount;
      rec(`${icon} ${att.name} raises ${name} — ${op.amount} points of it!`, { t: "shield", name: att.name, amount: op.amount });
      return true;
    }
    case "drain": {
      if (att.used.ageDrain) return false;
      att.used.ageDrain = true;
      addDebuff(def, op.stat, op.amount, op.rounds, rec,
        `${icon} ${att.name} lands ${name} — ${def.name} loses ${op.amount} ${op.stat} for ${op.rounds} rounds!`,
        { t: "drain", name: att.name, target: def.name });
      return true;
    }
    case "stun": {
      if (att.used.ageStun) return false;
      if (Math.random() >= (op.when != null ? op.when : 0.4)) return false;
      att.used.ageStun = true;
      def.stunned = true;
      rec(`${icon} ${att.name} lands ${name} — ${def.name} will lose their next turn!`, { t: "stun", name: att.name, target: def.name });
      return true;
    }
    case "cleanse": {
      if (att.used.ageCleanse) return false;
      if (!att.debuffs.length && !att.stunned && att.hp > att.maxHp * 0.5) return false;
      att.used.ageCleanse = true;
      for (const d of att.debuffs) att[d.stat] = att[d.stat] + d.amount;
      att.debuffs = [];
      att.stunned = false;
      att.hp = Math.min(att.maxHp, att.hp + (op.heal || 0));
      rec(`${icon} ${name.toUpperCase()} — everything the war stuck to ${att.name} comes off, and ${op.heal} HP returns. (${att.hp} HP)`, { t: "heal", name: att.name, amount: op.heal || 0, hpAfter: att.hp });
      return true;
    }
    default:
      return false;   // resolve / execute / counter / bell / leech / tick are
                      // passive — they fire from the damage and round hooks.
  }
}

function takeTurn(att, def, attTeam, defTeam, rec) {
  if (att.stunned) {
    att.stunned = false;
    rec(`⏭ ${att.name} is stunned and loses the turn!`, { t: "stunned", name: att.name });
    return;
  }
  // Element Flip (once): flip to counter when disadvantaged.
  if (!att.used.flip && has(att, "flip") && BEATS[def.element] === att.element) {
    att.used.flip = true;
    const counter = Object.keys(BEATS).find((e) => BEATS[e] === def.element);
    rec(`🔥 ${att.name} FLIPS their element from ${att.element} to ${counter}!`, { t: "flip", name: att.name, from: att.element, to: counter });
    att.element = counter;
  }
  // Kaelion — Sovereign Edict (once): cancel the enemy's next action outright.
  if (god(att, "Kaelion Voss") && !att.used.edict && def.hp > def.maxHp * 0.5) {
    att.used.edict = true;
    def.stunned = true;
    rec(`⚔️ ${att.name} issues the SOVEREIGN EDICT — ${def.name}'s next action is erased from existence!`, { t: "godBanner", god: "SOVEREIGN EDICT", name: att.name, target: def.name, icon: "⚔️" });
  }
  // Seraphine — Judgment Flame (once): 111 unavoidable, ignores everything.
  if (god(att, "Seraphine Valdur") && !att.used.judgment && def.hp <= def.maxHp * 0.6) {
    att.used.judgment = true;
    def.hp -= 111;
    rec(`🔥 JUDGMENT FLAME! The Eternal Fist of Heaven falls on ${def.name} for 111 unavoidable damage! (${Math.max(0, def.hp)} HP left)`, { t: "godBanner", god: "JUDGMENT FLAME", name: att.name, target: def.name, dmg: 111, hpAfter: Math.max(0, def.hp), icon: "🔥" });
    return;
  }
  // Void Send (once): banish the opponent's strongest BENCHED fighter.
  const bench = defTeam.filter((f) => f.hp > 0 && f !== def);
  if (!att.used.void && has(att, "banish") && bench.length > 0 && !bench.every((b) => god(b, "Toro Maximus"))) {
    att.used.void = true;
    const target = bench.filter((b) => !god(b, "Toro Maximus")).sort((a, b) => b.hp - a.hp)[0];
    if (target) {
      target.hp = 0;
      target.banished = true;
      rec(`💀 VOID SEND! ${att.name} rips a hole in reality — ${target.name} is BANISHED from the battlefield!`, { t: "godBanner", god: "VOID SEND", name: att.name, target: target.name, banish: true, icon: "💀" });
      return;
    }
  }
  // ⏳ Age moves lead — a Demon acts like a Demon before it acts like a card.
  if (ageTurn(att, def, rec)) return;
  // Pick an action: heal low, shield sometimes, stun once, otherwise attack.
  const healSig = att.sigs.find((s) => s.kind === "heal");
  const shieldSig = att.sigs.find((s) => s.kind === "shield");
  const stunSig = att.sigs.find((s) => s.kind === "stun");
  const drainSig = att.sigs.find((s) => s.kind === "drain");
  const dmgMoves = [...att.sigs, ...att.abilities].filter((s) => s.kind === "damage" && s.id !== "double");

  if (healSig && att.hp < att.maxHp * 0.35 && !att.used.bigHeal) {
    att.used.bigHeal = true;
    const amt = healSig.value || 40;
    att.hp = Math.min(att.maxHp, att.hp + amt);
    rec(`💚 ${att.name} uses ${healSig.name} and recovers ${amt} HP! (${att.hp} HP)`, { t: "heal", name: att.name, amount: amt, hpAfter: att.hp });
    return;
  }
  if (shieldSig && att.shield === 0 && att.hp < att.maxHp * 0.6 && Math.random() < 0.5) {
    att.shield = shieldSig.value || 40;
    rec(`🛡 ${att.name} raises ${shieldSig.name} (+${att.shield} shield)!`, { t: "shield", name: att.name, amount: att.shield });
    return;
  }
  if (stunSig && !att.used.stun && Math.random() < 0.3) {
    att.used.stun = true;
    def.stunned = true;
    rec(`⏭ ${att.name} lands ${stunSig.name} — ${def.name} will lose their next turn!`, { t: "stun", name: att.name, target: def.name });
    return;
  }
  if (drainSig && !att.used.drain && Math.random() < 0.3) {
    att.used.drain = true;
    def.power = Math.max(1, def.power - 2);
    rec(`🌀 ${att.name} saps ${def.name}'s strength — Power drops by 2!`, { t: "drain", name: att.name, target: def.name });
    return;
  }
  // Double Strike (once): two hits in one turn.
  const dbl = [...att.sigs, ...att.abilities].find((s) => s.id === "double");
  if (dbl && !att.used.double && Math.random() < 0.35) {
    att.used.double = true;
    rec(`⚔️ ${att.name} unleashes DOUBLE STRIKE!`, { t: "double", name: att.name });
    dealDamage(att, def, dbl.value || 45, rec, "⚔️");
    if (def.hp > 0) dealDamage(att, def, dbl.value || 45, rec, "⚔️");
    return;
  }
  const move = dmgMoves.length ? dmgMoves[Math.floor(Math.random() * dmgMoves.length)] : null;
  dealDamage(att, def, move ? move.value || 60 : 40 + att.power * 3, rec, move ? `⚡` : "👊");
}

function simulate(teamA, teamB, nameA, nameB) {
  const { events, rec } = makeRec();
  rec(`⚔️ GHOST BATTLE — ${nameA} vs ${nameB}`, { t: "start", nameA, nameB });
  rec(`${teamA.map((f) => f.name).join(" · ")}  VS  ${teamB.map((f) => f.name).join(" · ")}`, { t: "rosters" });
  // Skip past dead/banished fighters silently — the fallen don't re-enter.
  const nextAlive = (team, from) => { let i = from; while (i < team.length && team[i].hp <= 0) i++; return i; };
  let ai = nextAlive(teamA, 0), bi = nextAlive(teamB, 0), round = 0;
  rec(`➡️ ${teamA[ai].name} leads for ${nameA}!`, { t: "enter", side: "a", name: teamA[ai].name });
  rec(`➡️ ${teamB[bi].name} leads for ${nameB}!`, { t: "enter", side: "b", name: teamB[bi].name });
  while (ai < teamA.length && bi < teamB.length && round < 200) {
    round++;
    const a = teamA[ai], b = teamB[bi];
    rec(`— Round ${round}: ${a.name} (${Math.max(0, a.hp)} HP) vs ${b.name} (${Math.max(0, b.hp)} HP) —`, { t: "round", n: round, aName: a.name, aHp: Math.max(0, a.hp), bName: b.name, bHp: Math.max(0, b.hp) });
    // Blaze — Throne of Cinders: the whole enemy side burns each round he stands.
    for (const side of [[a, b], [b, a]]) {
      if (god(side[0], "Blaze Malpherion") && side[0].hp > 0) {
        side[1].hp -= 11;
        rec(`👑 Throne of Cinders — ${side[1].name} burns for 11!`, { t: "hit", attacker: side[0].name, target: side[1].name, dmg: 11, hpAfter: Math.max(0, side[1].hp), burn: true });
      }
    }
    // TICK — passive per-round ops. Positive damages the opponent (Pressure,
    // Brand of the Pit, Siege Weight); negative heals the holder (Standing
    // Vigil, First Vigil).
    for (const [self, foe] of [[a, b], [b, a]]) {
      const op = self.ageOp;
      if (!op || op.t !== "tick" || self.hp <= 0) continue;
      if (op.dmg > 0) {
        foe.hp -= op.dmg;
        rec(`${self.ageIcon || "⏳"} ${self.ageName} — ${foe.name} takes ${op.dmg}.`, { t: "hit", attacker: self.name, target: foe.name, dmg: op.dmg, hpAfter: Math.max(0, foe.hp), burn: true });
      } else if (op.dmg < 0 && self.hp < self.maxHp) {
        const before = self.hp;
        self.hp = Math.min(self.maxHp, self.hp - op.dmg);
        rec(`${self.ageIcon || "⏳"} ${self.ageName} — ${self.name} recovers ${Math.round(self.hp - before)}.`, { t: "heal", name: self.name, amount: Math.round(self.hp - before), hpAfter: self.hp });
      }
    }
    // ⏳ Age debuff clocks tick down and expire here — so "-2 Power for 3
    // rounds" means exactly three rounds, not the rest of the battle.
    for (const f of [a, b]) tickDebuffs(f, rec);
    // Momentum passive: speed climbs each round.
    for (const f of [a, b]) if (has(f, "momentum")) f.momentum++;
    const first = a.speed + a.momentum + Math.random() >= b.speed + b.momentum + Math.random() ? a : b;
    const second = first === a ? b : a;
    if (first.hp > 0 && second.hp > 0) takeTurn(first, second, first === a ? teamA : teamB, first === a ? teamB : teamA, rec);
    if (first.hp > 0 && second.hp > 0) takeTurn(second, first, second === a ? teamA : teamB, second === a ? teamB : teamA, rec);
    // Regeneration passives at end of round.
    for (const f of [a, b]) {
      if (f.hp > 0 && has(f, "regen")) {
        f.hp = Math.min(f.maxHp, f.hp + 8);
      }
    }
    // Aurelia — Eternal Refrain: the harp never stops, +55 HP every round.
    for (const f of [a, b]) {
      if (f.hp > 0 && god(f, "Aurelia the Eternal Bull") && f.hp < f.maxHp) {
        const before = f.hp;
        f.hp = Math.min(f.maxHp, f.hp + 55);
        rec(`🎼 Eternal Refrain — the harp plays on and ${f.name} recovers ${Math.round(f.hp - before)} HP!`, { t: "heal", name: f.name, amount: Math.round(f.hp - before), hpAfter: f.hp, god: "Eternal Refrain" });
      }
    }
    // KOs & next fighters step in (banished/dead bench members are skipped).
    if (checkDown(a, rec)) {
      ai = nextAlive(teamA, ai + 1);
      if (ai < teamA.length) rec(`➡️ ${teamA[ai].name} steps onto the battlefield for ${nameA}!`, { t: "enter", side: "a", name: teamA[ai].name });
    }
    if (checkDown(b, rec)) {
      bi = nextAlive(teamB, bi + 1);
      if (bi < teamB.length) rec(`➡️ ${teamB[bi].name} steps onto the battlefield for ${nameB}!`, { t: "enter", side: "b", name: teamB[bi].name });
    }
  }
  let winner;
  if (ai >= teamA.length && bi >= teamB.length) winner = Math.random() < 0.5 ? "challenger" : "opponent";
  else if (ai >= teamA.length) winner = "opponent";
  else if (bi >= teamB.length) winner = "challenger";
  else {
    const aLeft = teamA.reduce((s, f) => s + Math.max(0, f.hp) / f.maxHp, 0);
    const bLeft = teamB.reduce((s, f) => s + Math.max(0, f.hp) / f.maxHp, 0);
    winner = aLeft >= bLeft ? "challenger" : "opponent";
    rec(`⏱ The battle rages past the limit — judges call it on remaining strength.`, { t: "timeout" });
  }
  rec(winner === "challenger" ? `🏆 ${nameA} WINS THE BATTLE!` : `🏆 ${nameB} WINS THE BATTLE!`, { t: "win", side: winner });
  return { winner, events, log: events.map((e) => e.text) };
}

// ---- RATINGS: Elo + anti-farm ----------------------------------------------
// Flat ±25 was farmable: any two wallets could trade wins forever and both
// climb, and beating a fresh burner paid the same as beating the #1 seed.
// Now: K=32 Elo (beating a weak opponent is worth ~0), and every repeat of the
// SAME pairing in the SAME day halves the stakes after the 3rd meeting. Both
// safeguards run in the DB so a script can't route around them. If the SQL
// isn't installed yet, everything degrades to plain Elo — never a crash.
async function pairMeetingsToday(wallet, opponent) {
  try {
    const r = await sb(`rpc/bump_pair`, { method: "POST", body: JSON.stringify({ p_wallet: wallet, p_opponent: opponent }) });
    return (r && r.count) || 1;
  } catch (e) {
    return 1;
  }
}

async function dailyAllowed(wallet, kind, cap) {
  try {
    const r = await sb(`rpc/bump_daily`, { method: "POST", body: JSON.stringify({ p_wallet: wallet, p_kind: kind, p_cap: cap }) });
    return !r || r.allowed !== false;
  } catch (e) {
    return true; // counters not installed yet — never block play
  }
}

async function getRating(table, wallet) {
  const rows = await sb(`${table}?wallet=eq.${encodeURIComponent(wallet)}&select=*`, { method: "GET" });
  return rows && rows[0] ? rows[0] : { wallet, rating: 1000, wins: 0, losses: 0 };
}

async function putRating(table, wallet, rating, won, cur) {
  await sb(table, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      wallet,
      rating: Math.max(0, Math.round(rating)),
      wins: (cur.wins || 0) + (won ? 1 : 0),
      losses: (cur.losses || 0) + (won ? 0 : 1),
      updated_at: new Date().toISOString(),
    }),
  });
}

// Applies one rated result to BOTH wallets. Returns the challenger's new rating.
async function applyElo(table, challenger, opponent, challengerWon) {
  const [me, op] = await Promise.all([getRating(table, challenger), getRating(table, opponent)]);
  const expected = 1 / (1 + Math.pow(10, (op.rating - me.rating) / 400));
  let delta = 32 * ((challengerWon ? 1 : 0) - expected);
  // Diminishing returns: 4th+ meeting of the same pair today halves each time.
  const meetings = await pairMeetingsToday(challenger, opponent);
  if (meetings > 3) delta = delta / Math.pow(2, meetings - 3);
  delta = Math.round(delta);
  const myNew = me.rating + delta;
  const opNew = op.rating - delta;
  await Promise.all([
    putRating(table, challenger, myNew, challengerWon, me),
    putRating(table, opponent, opNew, !challengerWon, op),
  ]);
  return Math.max(0, myNew);
}



// ============================================================================
// 🏁 THE GRAND CIRCUIT — combat racing on the same cards, same stats engine.
// SPD = top speed · PWR = weapon damage · HP = vehicle armor · SPC = ability
// charge. Sports Car mascots race in true form with their mods; everyone else
// drives a Battle Kart. Losing NEVER touches the NFT — no wagering, no stakes.
// ============================================================================
const CAR_MODS = ["Spoiler Wing", "Body Kit", "Underglow Neon", "Fog Lights", "Supercharger", "Nitro Boost", "Machine Gun Turret", "Chrome Rims", "Racing Stripes", "Butterfly Doors", "Turbo Exhaust", "Rocket Launcher", "Oil Slick Dropper", "Ramming Bumper", "Reactive Armor", "Ejector Seat", "Smoke Screen", "Hydraulics"];

// Circuits reuse the worlds that already exist. Favored element gets +6% speed
// and +20% armor; the weak element loses 6% speed.
const TRACKS = [
  { id: "Racetrack", favor: null, weak: null, hazard: null, weight: 20, blurb: "Clean asphalt. No excuses." },
  { id: "Volcano", favor: "Fire", weak: "Water", hazard: "lava", weight: 14, blurb: "Lava breaches the track on the fourth segment." },
  { id: "Snow Peaks", favor: "Water", weak: "Fire", hazard: "fog", weight: 14, blurb: "Whiteout conditions — Fog Lights earn their keep." },
  { id: "Desert", favor: "Earth", weak: "Air", hazard: "sandstorm", weight: 14, blurb: "A sandstorm swallows the second segment." },
  { id: "Wild West", favor: "Earth", weak: null, hazard: "cattle", weight: 12, blurb: "Livestock does not check for traffic." },
  { id: "Cyberpunk", favor: "Air", weak: "Earth", hazard: "shortcut", weight: 12, blurb: "A neon alley shortcut opens for the quick-witted." },
  { id: "Space", favor: "Air", weak: "Water", hazard: "zerog", weight: 10, blurb: "Zero-G straight — raw speed counts double." },
  { id: "Post-Apocalyptic", favor: null, weak: null, hazard: "grandcircuit", weight: 4, blurb: "☠ THE GRAND CIRCUIT. All damage up. No respawns. Ever." },
];

function rollTrack() {
  const total = TRACKS.reduce((n, t) => n + t.weight, 0);
  let r = Math.random() * total;
  for (const t of TRACKS) { r -= t.weight; if (r <= 0) return t; }
  return TRACKS[0];
}

function makeRacer(row) {
  const traits = row.traits || {};
  const stats = computeStats(
    { ...traits, characterName: row.character_name, element: row.element || undefined },
    row.card_tier || row.rarity || null,
    row.marked_by || null,
    row.age_card || null
  );
  const accessories = Array.isArray(traits.accessories) ? traits.accessories : [];
  const archetypes = Array.isArray(traits.archetypes) ? traits.archetypes : [];
  const isCar = archetypes.includes("Sports Car");
  // Only true car mascots run mods; karts run the baseline frame.
  const mods = isCar ? accessories.filter((a) => CAR_MODS.includes(a)).slice(0, 3) : [];
  const m = (id) => mods.includes(id);
  const isGod = (row.card_tier || row.rarity) === "Super Legendary";
  // Battle Karts are standard-issue: no mods, so they get a reinforced stock
  // frame to compensate. Without this, a modded car annihilates an equal-stat
  // kart ~98% of the time and every non-car mascot is dead weight on the grid.
  // With it, the car keeps a real but fair edge — roughly 60/40.
  let armor = stats.hpPoints + (m("Body Kit") ? 40 : 0) + (isCar ? 0 : 22);
  // God armor is capped in races only — the card itself is untouched. A race is
  // one lane wide; a 333-armor god can't shield teammates the way it can in a
  // battle, so the cap keeps the grid competitive without nerfing the NFT.
  if (isGod) armor = Math.min(armor, 200);
  return {
    name: row.character_name,
    mint: row.mint_address,
    image: row.image_url || null,
    tier: row.card_tier || row.rarity || "Common",
    isGod,
    element: stats.element ? stats.element.id : "Fire",
    isCar,
    mods,
    speed: stats.speed + (m("Racing Stripes") ? 1 : 0),
    power: stats.power,
    special: stats.special,
    armor,
    maxArmor: armor,
    progress: 0,
    lap: 1,
    nitroLeft: m("Nitro Boost") ? 2 : 0,
    used: {},
    wrecked: false,
    respawnIn: 0,
    spinIn: 0,
    smokeIn: 0,
    finishedTick: null,
    place: null,
    // Rolled fresh each race: how the car is running TODAY. Keeps identical
    // cards from producing identical results race after race.
    form: (Math.random() - 0.5) * 1.6,
    // Same identity-locked variance the battle engine uses: no two cards drive
    // identically even on matching stat lines.
    variance: ((row.character_name || "").split("").reduce((n, c) => n + c.charCodeAt(0), 0) % 13) / 100,
  };
}

function simulateRace(racers, track, sideOf) {
  const events = [];
  const log = [];
  const rec = (text, ev) => { log.push(text); events.push({ text, ...(ev || { t: "info" }) }); };
  const TICKS = 18, PER_LAP = 6;
  const has = (r, id) => r.mods.includes(id);
  const deathRace = track.hazard === "grandcircuit";

  rec(`🏁 ${racers.length} cars on the grid at ${track.id.toUpperCase()} — ${track.blurb}`, { t: "start", track: track.id, blurb: track.blurb });
  racers.forEach((r) => {
    rec(`${r.isCar ? "🏎️" : "🛺"} ${r.name} (${r.tier}, ${r.element}${r.mods.length ? ` · ${r.mods.join(", ")}` : ""}) rolls out.`, {
      t: "grid", name: r.name, isCar: r.isCar, tier: r.tier, element: r.element, mods: r.mods,
    });
  });
  if (deathRace) rec("☠ THE GRAND CIRCUIT. Damage is up 25% and nobody respawns. Good luck.", { t: "godBanner", god: "THE GRAND CIRCUIT", icon: "☠" });

  const standings = () => [...racers].sort((a, b) => {
    if (a.place && b.place) return a.place - b.place;
    if (a.place) return -1;
    if (b.place) return 1;
    return b.progress - a.progress;
  });

  const speedOf = (r, tick, lap, lead) => {
    if (r.wrecked || r.spinIn > 0) return 0;
    let sp = 20 + r.speed * 1.35 + r.variance * 3 + (r.form || 0);
    if (track.favor && r.element === track.favor) sp *= 1.06;
    if (track.weak && r.element === track.weak) sp *= 0.94;
    if (tick % PER_LAP === 0 && has(r, "Supercharger")) sp += 2;          // launch
    if (has(r, "Chrome Rims") && ["Racetrack", "City"].includes(track.id)) sp *= 1.05;
    if (r.isCar) sp *= 1.05; // purpose-built for this — karts are improvising
    if (lap === 3 && has(r, "Turbo Exhaust")) sp *= 1.10;
    if (track.hazard === "zerog" && tick % PER_LAP === 3) sp += r.speed * 1.5;
    if (r.respawnIn > 0) sp *= 0.55;
    // RUBBER-BANDING — trailing cars get a slipstream tow. Without this, the
    // highest-SPD car wins essentially every race (18 ticks average the noise
    // away) and results become foregone. Capped so a Legendary still beats a
    // Common most days — it makes races contested, not random.
    if (lead > 0) {
      const gap = lead - r.progress;
      if (gap > 0) sp *= 1 + Math.min(0.35, gap / 220);
    }
    return sp * (0.80 + Math.random() * 0.40);
  };

  const damage = (att, def, raw, tag, evExtra) => {
    let dmg = raw * (1 + (att.power - 5) * 0.05);
    if (has(att, "Machine Gun Turret")) dmg *= 1.3;
    if (has(def, "Reactive Armor")) dmg *= 0.85;
    if (!def.isCar) dmg *= 0.93; // stock frame soaks a little better
    if (deathRace || att.lap === 3) dmg *= 1.25;
    dmg = Math.round(dmg);
    def.armor -= dmg;
    rec(`${tag} ${att.name} hits ${def.name} for ${dmg}! (${Math.max(0, def.armor)} armor left)`, {
      t: "hit", attacker: att.name, target: def.name, dmg, armorAfter: Math.max(0, def.armor), ...(evExtra || {}),
    });
    if (def.armor <= 0 && !def.wrecked) wreck(def, att);
  };

  const wreck = (r, by) => {
    if (has(r, "Ejector Seat") && !r.used.eject) {
      r.used.eject = true;
      r.armor = Math.round(r.maxArmor * 0.35);
      r.progress = Math.max(0, r.progress - 14);
      rec(`💺 EJECTOR SEAT! ${r.name} punches out, hits the tarmac rolling and gets back in — two positions down.`, { t: "eject", name: r.name, armorAfter: r.armor });
      return;
    }
    r.wrecked = true;
    r.armor = 0;
    const permanent = deathRace || r.lap === 3;
    rec(`💥 ${r.name} is WRECKED${by ? ` by ${by.name}` : ""}!${permanent ? " No coming back from this one." : ""}`, {
      t: "wreck", name: r.name, by: by ? by.name : null, permanent,
    });
    if (!permanent) {
      r.respawnIn = has(r, "Butterfly Doors") ? 1 : 2;
    }
  };

  for (let tick = 1; tick <= TICKS; tick++) {
    const lap = Math.min(3, Math.ceil(tick / PER_LAP));
    racers.forEach((r) => { if (!r.place) r.lap = lap; });
    if (tick % PER_LAP === 1 && tick > 1) {
      rec(lap === 3 ? "🚨 FINAL LAP — wrecks are permanent from here." : `🔁 LAP ${lap}${lap === 2 ? " — WEAPONS ARE LIVE." : ""}`, { t: lap === 3 ? "finalLap" : "lap", lap });
    }

    // Respawns and spin recovery.
    racers.forEach((r) => {
      if (r.wrecked && r.respawnIn > 0) {
        r.respawnIn--;
        if (r.respawnIn === 0) {
          r.wrecked = false;
          r.armor = Math.round(r.maxArmor * 0.4);
          rec(`♻️ ${r.name} rejoins the race — 1,000 years in Purgatory, one minute out here.`, { t: "respawn", name: r.name, armorAfter: r.armor });
        }
      }
      if (r.spinIn > 0) r.spinIn--;
      if (r.smokeIn > 0) r.smokeIn--;
    });

    // Movement.
    const before = standings().map((r) => r.name);
    const lead = Math.max(...racers.map((r) => r.progress));
    racers.forEach((r) => {
      if (r.place) return;
      // Nitro: spend on the final lap or when trailing.
      const pos = standings().findIndex((x) => x.name === r.name);
      if (r.nitroLeft > 0 && !r.wrecked && (lap === 3 || pos > racers.length / 2) && Math.random() > 0.5) {
        r.nitroLeft--;
        r.progress += speedOf(r, tick, lap, lead) * 0.4;
        rec(`💨 ${r.name} hits the NITRO!`, { t: "nitro", name: r.name });
      }
      r.progress += speedOf(r, tick, lap, lead);
    });

    // Track hazards.
    if (track.hazard === "lava" && tick % PER_LAP === 4) {
      rec("🌋 Lava breaches the track!", { t: "hazard", hazard: "lava" });
      racers.forEach((r) => {
        if (r.place || r.wrecked) return;
        if (has(r, "Hydraulics")) { rec(`⬆️ ${r.name} hops the flow on hydraulics.`, { t: "hazardDodge", name: r.name }); return; }
        r.armor -= 18;
        rec(`🔥 ${r.name} takes 18 from the lava.`, { t: "hit", target: r.name, dmg: 18, armorAfter: Math.max(0, r.armor), hazard: true });
        if (r.armor <= 0) wreck(r, null);
      });
    }
    if (track.hazard === "fog" && tick % PER_LAP === 2) {
      rec("🌫 Whiteout — visibility gone.", { t: "hazard", hazard: "fog" });
      racers.forEach((r) => {
        if (r.place || r.wrecked || has(r, "Fog Lights")) return;
        r.progress -= 6;
      });
    }
    if (track.hazard === "sandstorm" && tick % PER_LAP === 2) {
      rec("🏜 Sandstorm across the second sector.", { t: "hazard", hazard: "sandstorm" });
      racers.forEach((r) => { if (!r.place && !r.wrecked) r.progress -= 5; });
    }
    if (track.hazard === "cattle" && tick === 8) {
      const unlucky = racers.filter((r) => !r.place && !r.wrecked)[Math.floor(Math.random() * Math.max(1, racers.filter((r) => !r.place && !r.wrecked).length))];
      if (unlucky) {
        unlucky.spinIn = 1;
        rec(`🐄 Cattle on the road — ${unlucky.name} stands on the brakes!`, { t: "hazard", hazard: "cattle", name: unlucky.name });
      }
    }
    if (track.hazard === "shortcut" && tick === 9) {
      const smart = racers.filter((r) => !r.place && !r.wrecked && r.special >= 7);
      smart.forEach((r) => { r.progress += 12; rec(`🌃 ${r.name} takes the neon alley shortcut!`, { t: "shortcut", name: r.name }); });
    }

    // Combat — live from lap 2.
    if (lap >= 2) {
      const order = standings().filter((r) => !r.place && !r.wrecked);
      order.forEach((att, i) => {
        if (att.smokeIn > 0) return;
        const reach = has(att, "Machine Gun Turret") ? 2 : 1;
        const targets = order.slice(Math.max(0, i - reach), i).filter((t) => t !== att && t.smokeIn === 0);
        const def = targets[targets.length - 1];
        if (!def) return;
        // Fire rate is SPC-gated.
        if (Math.random() > 0.28 + att.special * 0.045) return;

        // Smoke Screen — defensive, once.
        if (has(def, "Smoke Screen") && !def.used.smoke && def.armor < def.maxArmor * 0.45) {
          def.used.smoke = true;
          def.smokeIn = 2;
          rec(`💨 ${def.name} drops a SMOKE SCREEN and vanishes from the crosshairs!`, { t: "smoke", name: def.name });
          return;
        }
        // Rocket Launcher — once per lap, double damage.
        if (has(att, "Rocket Launcher") && att.used.rocketLap !== lap) {
          att.used.rocketLap = lap;
          damage(att, def, 44, "🚀 ROCKET!", { rocket: true });
          return;
        }
        // Ramming Bumper — sideswipe.
        if (has(att, "Ramming Bumper") && Math.random() > 0.72) {
          damage(att, def, 26 * 1.25, "💢 RAM!", { ram: true });
          return;
        }
        damage(att, def, 22, "🔫");
      });

      // Oil Slick — drop behind you, chasers may spin.
      order.forEach((r, i) => {
        if (!has(r, "Oil Slick Dropper") || r.used.oilLap === lap) return;
        const chaser = order[i + 1];
        if (!chaser) return;
        r.used.oilLap = lap;
        if (has(chaser, "Hydraulics")) {
          rec(`⬆️ ${chaser.name} hops ${r.name}'s oil slick.`, { t: "hazardDodge", name: chaser.name });
        } else if (Math.random() < 0.4) {
          chaser.spinIn = 1;
          rec(`🛢 ${r.name} drops oil — ${chaser.name} SPINS OUT!`, { t: "spin", name: chaser.name, by: r.name });
        } else {
          rec(`🛢 ${r.name} drops an oil slick — ${chaser.name} skates through it.`, { t: "oil", name: r.name });
        }
      });
    }

    // Overtake callouts.
    const after = standings().map((r) => r.name);
    if (after[0] !== before[0] && !racers.find((r) => r.name === after[0]).place) {
      rec(`⚡ ${after[0]} TAKES THE LEAD!`, { t: "overtake", name: after[0] });
    }

    // Finish line. PHOTO FINISH: when several cars cross on the same tick,
    // place them by how far PAST the line they got — never by array order,
    // which silently handed every tie to the challenger's side.
    const FINISH = 3 * PER_LAP * 26;
    racers
      .filter((r) => !r.place && r.progress >= FINISH)
      .sort((a, b) => b.progress - a.progress)
      .forEach((r) => {
        const placed = racers.filter((x) => x.place).length;
        r.place = placed + 1;
        r.finishedTick = tick;
        rec(`🏁 P${r.place} — ${r.name} crosses the line!`, { t: "finish", name: r.name, place: r.place });
      });

    events.push({
      t: "tick", tick, lap,
      positions: standings().map((r) => ({
        name: r.name, progress: Math.round(r.progress), armor: Math.max(0, Math.round(r.armor)),
        maxArmor: r.maxArmor, wrecked: r.wrecked, place: r.place, side: sideOf(r.name),
      })),
    });

    if (racers.every((r) => r.place || (r.wrecked && r.respawnIn === 0 && (deathRace || r.lap === 3)))) break;
  }

  // Anyone still running when the flag drops is placed by distance.
  standings().filter((r) => !r.place).sort((a, b) => b.progress - a.progress).forEach((r) => {
    {
      const placed = racers.filter((x) => x.place).length;
      r.place = placed + 1;
      if (r.wrecked) rec(`🔧 ${r.name} finishes P${r.place} — as wreckage.`, { t: "finish", name: r.name, place: r.place, wrecked: true });
      else rec(`🏁 P${r.place} — ${r.name}.`, { t: "finish", name: r.name, place: r.place });
    }
  });

  const POINTS = { 1: 10, 2: 7, 3: 5, 4: 3, 5: 2 };
  const podium = standings().map((r) => ({
    name: r.name, place: r.place, points: POINTS[r.place] || 1, side: sideOf(r.name),
    tier: r.tier, element: r.element, image: r.image, isCar: r.isCar, wrecked: r.wrecked,
  }));
  rec(`🏆 ${podium[0].name} WINS at ${track.id}.`, { t: "podium", winner: podium[0].name, podium });
  return { events, log, podium };
}

// Racing keeps its own ladder — a great fighter isn't automatically a great
// driver. Same Elo + anti-farm rules as the arena, separate board.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { action } = req.body || {};

  try {
    if (action === "leaderboard") {
      const rows = await sb(`battle_ratings?select=*&order=rating.desc&limit=20`, { method: "GET" });
      return res.status(200).json({ leaderboard: rows || [] });
    }

    if (action === "simulate") {
      const { challengerWallet, teamMints, opponentWallet } = req.body;
      if (!challengerWallet || !Array.isArray(teamMints) || teamMints.length < 1 || teamMints.length > 7) {
        return res.status(400).json({ error: "Send challengerWallet and 1-3 teamMints." });
      }
      const authErr = requireAuth(challengerWallet, req.body.auth);
      if (authErr) return res.status(401).json({ error: authErr });
      // Load + farm ceiling: 60 battles per wallet per day. Plenty for a
      // human, a wall for a script.
      if (!(await dailyAllowed(challengerWallet, "battle", 60))) {
        return res.status(429).json({ error: "The arena closes after 60 battles a day. Rest your squad — it resets at midnight UTC." });
      }
      // Challenger's team, in picked order.
      const filter = `(${teamMints.map((m) => `"${m}"`).join(",")})`;
      const mine = await sb(`mints?mint_address=in.${encodeURIComponent(filter)}&select=*`, { method: "GET" });
      if (!mine || mine.length === 0) return res.status(400).json({ error: "Team mascots not found." });
      // Your squad fights in the ORDER YOU PICKED — first pick leads, the rest
      // step in as each falls. Team order is a real tactical decision.
      const teamA = teamMints.map((m) => mine.find((r) => r.mint_address === m)).filter(Boolean).map(makeFighter);

      // Opponent: a named wallet, or a random other roster.
      let oppWallet = (opponentWallet || "").trim();
      let oppRows;
      if (oppWallet) {
        oppRows = await sb(`mints?owner_wallet=eq.${encodeURIComponent(oppWallet)}&select=*&limit=20`, { method: "GET" });
        if (!oppRows || oppRows.length === 0) return res.status(400).json({ error: "That wallet has no MascotGen mascots." });
      } else {
        const all = await sb(`mints?select=*&owner_wallet=neq.${encodeURIComponent(challengerWallet)}&limit=200`, { method: "GET" });
        // 👻 THIN WORLD. Pre-launch, and for the first stretch after it, there
        // may be only one or two other wallets in existence — so every "random
        // rival" lands on the same mascot every single time, and the game looks
        // broken when it is merely empty. Below three distinct opponent wallets
        // we flip a coin between the real pool and the MIRROR REALM, which
        // fields the challenger's own roster as doppelgangers. Instant variety
        // from mascots that already exist, no rating at stake against your own
        // reflection, and it stops applying by itself once the world fills up.
        const distinctWallets = new Set((all || []).map((r) => r.owner_wallet).filter(Boolean)).size;
        const thinWorld = distinctWallets > 0 && distinctWallets < 3 && Math.random() < 0.5;
        if (all && all.length > 0 && !thinWorld) {
          // ⚖️ Banded by weight class — see pickBandedOpponent above.
          const picked = pickBandedOpponent(all, rosterClass(mine));
          oppWallet = picked ? picked.wallet : "the-void";
          oppRows = picked ? picked.rows : all;
          if (!oppRows || oppRows.length === 0) oppRows = all;
        } else {
          // 👥 MIRROR REALM — no other wallets exist yet, so the void answers
          // with doppelgangers of the challenger's own roster. No rating at
          // stake against your own reflection.
          oppWallet = challengerWallet;
          oppRows = await sb(`mints?owner_wallet=eq.${encodeURIComponent(challengerWallet)}&select=*&limit=50`, { method: "GET" });
          if (!oppRows || oppRows.length === 0) return res.status(400).json({ error: "No opponents exist yet — mint a mascot first." });
        }
      }
      const mirror = oppWallet === challengerWallet;
      let oppPool = mirror ? oppRows.filter((r) => !teamMints.includes(r.mint_address)) : oppRows;
      if (oppPool.length === 0) oppPool = oppRows;
      // Opponent fields a squad matching the challenger's size (up to what they own).
      const teamB = [...oppPool].sort(() => Math.random() - 0.5).slice(0, Math.min(teamMints.length, 7, oppPool.length)).map(makeFighter);

      const shortA = `${challengerWallet.slice(0, 4)}..${challengerWallet.slice(-4)}`;
      const shortB = mirror ? "👥 THE MIRROR REALM" : `${oppWallet.slice(0, 4)}..${oppWallet.slice(-4)}`;
      const { winner, events, log } = simulate(teamA, teamB, shortA, shortB);
      const displayTeam = (t) => t.map((f) => ({ name: f.name, tier: f.tier, element: f.element, maxHp: f.maxHp, image: f.image, isGod: f.isGod }));

      // ---- Lifecycle: fighting is proof of life ---------------------------
      // Every mascot that took the field is marked active. Any that had already
      // drifted into the Graveyard (dormant 30+ days) is RESURRECTED — its
      // return counter ticks up so the card can wear the badge.
      try {
        const GRAVE_DAYS = 30;
        const cutoff = new Date(Date.now() - GRAVE_DAYS * 24 * 60 * 60 * 1000);
        const fought = [...teamA, ...teamB].map((f) => f.mint).filter(Boolean);
        for (const row of [...(mine || []), ...(oppRows || [])]) {
          if (!fought.includes(row.mint_address)) continue;
          const wasDormant = row.last_active && new Date(row.last_active) < cutoff;
          await sb(`mints?mint_address=eq.${encodeURIComponent(row.mint_address)}`, {
            method: "PATCH",
            body: JSON.stringify({
              last_active: new Date().toISOString(),
              ...(wasDormant ? { resurrections: (row.resurrections || 0) + 1 } : {}),
            }),
          });
        }
      } catch (e) {
        // Lifecycle bookkeeping must never fail a completed battle.
      }

      // Wrapped, to match the race path. If the `mirror` column has not been
      // added to the battles table this insert throws, and unwrapped it fell
      // through to the outer catch as a 500 — killing a battle that had already
      // been fought and resolved. Losing the history row is a bad outcome;
      // losing the whole match is a worse one.
      try {
        await sb(`battles`, {
          method: "POST",
          body: JSON.stringify([
            {
              challenger_wallet: challengerWallet,
              opponent_wallet: oppWallet,
              challenger_team: teamA.map((f) => ({ mint: f.mint, name: f.name, tier: f.tier })),
              opponent_team: teamB.map((f) => ({ mint: f.mint, name: f.name, tier: f.tier })),
              winner,
              log,
              // 👥 The Mirror Realm is an EVENT, not a fallback — flag it so the
              // Stats page can count every crossing into the reflection.
              ...(mirror ? { mirror: true } : {}),
            },
          ]),
        });
      } catch (e) {
        console.warn("battle record insert failed (non-fatal):", e.message);
      }
      let newRating = null;
      if (!mirror) {
        // Wrapped like the race path. A missing battle_ratings table used to
        // 500 a battle that had already been fought and resolved.
        try {
          newRating = await applyElo("battle_ratings", challengerWallet, oppWallet, winner === "challenger");
        } catch (e) {
          console.warn("battle elo failed (non-fatal):", e.message);
        }
      }

      if (mirror) {
        log.push("👥 Mirror match — no rating at stake against your own reflection.");
        events.push({ text: "👥 Mirror match — no rating at stake against your own reflection.", t: "info" });
      }
      return res.status(200).json({
        winner,
        log,
        events,
        mirror,
        rating: newRating,
        yourTeam: displayTeam(teamA),
        theirTeam: displayTeam(teamB),
        opponentWallet: oppWallet,
      });
    }



    if (action === "race") {
      // 🏁 THE GRAND CIRCUIT — same squad-picking model as battles.
      const { challengerWallet, teamMints, opponentWallet } = req.body;
      if (!challengerWallet || !Array.isArray(teamMints) || teamMints.length < 1 || teamMints.length > 3) {
        return res.status(400).json({ error: "Send challengerWallet and 1-3 teamMints." });
      }
      const authErr = requireAuth(challengerWallet, req.body.auth);
      if (authErr) return res.status(401).json({ error: authErr });
      if (!(await dailyAllowed(challengerWallet, "race", 60))) {
        return res.status(429).json({ error: "The paddock closes after 60 races a day. Resets at midnight UTC." });
      }
      const filter = `(${teamMints.map((m) => `"${m}"`).join(",")})`;
      const mine = await sb(`mints?mint_address=in.${encodeURIComponent(filter)}&select=*`, { method: "GET" });
      if (!mine || mine.length === 0) return res.status(400).json({ error: "Your racers weren't found." });
      const teamA = teamMints.map((m) => mine.find((r) => r.mint_address === m)).filter(Boolean).map(makeRacer);

      let oppWallet = (opponentWallet || "").trim();
      let oppRows;
      if (oppWallet) {
        oppRows = await sb(`mints?owner_wallet=eq.${encodeURIComponent(oppWallet)}&select=*&limit=20`, { method: "GET" });
        if (!oppRows || oppRows.length === 0) return res.status(400).json({ error: "That wallet has no MascotGen mascots." });
      } else {
        const all = await sb(`mints?select=*&owner_wallet=neq.${encodeURIComponent(challengerWallet)}&limit=200`, { method: "GET" });
        // 👻 THIN WORLD. Pre-launch, and for the first stretch after it, there
        // may be only one or two other wallets in existence — so every "random
        // rival" lands on the same mascot every single time, and the game looks
        // broken when it is merely empty. Below three distinct opponent wallets
        // we flip a coin between the real pool and the MIRROR REALM, which
        // fields the challenger's own roster as doppelgangers. Instant variety
        // from mascots that already exist, no rating at stake against your own
        // reflection, and it stops applying by itself once the world fills up.
        const distinctWallets = new Set((all || []).map((r) => r.owner_wallet).filter(Boolean)).size;
        const thinWorld = distinctWallets > 0 && distinctWallets < 3 && Math.random() < 0.5;
        if (all && all.length > 0 && !thinWorld) {
          // ⚖️ Banded by weight class — see pickBandedOpponent above.
          const picked = pickBandedOpponent(all, rosterClass(mine));
          oppWallet = picked ? picked.wallet : "the-void";
          oppRows = picked ? picked.rows : all;
          if (!oppRows || oppRows.length === 0) oppRows = all;
        } else {
          // 👥 Mirror grid — the void fields your own reflections. No rating.
          oppWallet = challengerWallet;
          oppRows = await sb(`mints?owner_wallet=eq.${encodeURIComponent(challengerWallet)}&select=*&limit=50`, { method: "GET" });
          if (!oppRows || oppRows.length === 0) return res.status(400).json({ error: "No opponents exist yet — mint a mascot first." });
        }
      }
      const mirror = oppWallet === challengerWallet;
      let oppPool = mirror ? oppRows.filter((r) => !teamMints.includes(r.mint_address)) : oppRows;
      if (oppPool.length === 0) oppPool = oppRows;
      const teamB = [...oppPool].sort(() => Math.random() - 0.5).slice(0, Math.min(teamMints.length, 3, oppPool.length)).map(makeRacer);

      // Name collisions across sides would confuse the stage — tag duplicates.
      const seen = new Set(teamA.map((r) => r.name));
      teamB.forEach((r) => { if (seen.has(r.name)) r.name = `${r.name} (rival)`; });

      const track = rollTrack();
      const sideNames = new Set(teamA.map((r) => r.name));
      const sideOf = (n) => (sideNames.has(n) ? "a" : "b");
      const { events, log, podium } = simulateRace([...teamA, ...teamB], track, sideOf);

      const scoreA = podium.filter((p) => p.side === "a").reduce((n, p) => n + p.points, 0);
      const scoreB = podium.filter((p) => p.side === "b").reduce((n, p) => n + p.points, 0);
      const winner = scoreA >= scoreB ? "challenger" : "opponent";

      // Racing is proof of life — same resurrection rule as the Arena.
      try {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const raced = [...teamA, ...teamB].map((f) => f.mint).filter(Boolean);
        for (const row of [...(mine || []), ...(oppRows || [])]) {
          if (!raced.includes(row.mint_address)) continue;
          const wasDormant = row.last_active && new Date(row.last_active) < cutoff;
          await sb(`mints?mint_address=eq.${encodeURIComponent(row.mint_address)}`, {
            method: "PATCH",
            body: JSON.stringify({
              last_active: new Date().toISOString(),
              ...(wasDormant ? { resurrections: (row.resurrections || 0) + 1 } : {}),
            }),
          });
        }
      } catch (e) {}

      // Storage + ratings are best-effort: a completed race is never lost to a
      // missing table, so you can test before running the SQL.
      let newRating = null;
      try {
        await sb(`races`, {
          method: "POST",
          body: JSON.stringify([{
            challenger_wallet: challengerWallet,
            opponent_wallet: oppWallet,
            track: track.id,
            challenger_team: teamA.map((f) => ({ mint: f.mint, name: f.name, tier: f.tier })),
            opponent_team: teamB.map((f) => ({ mint: f.mint, name: f.name, tier: f.tier })),
            winner,
            log,
            ...(mirror ? { mirror: true } : {}),
          }]),
        });
      } catch (e) {}
      if (!mirror) {
        try {
          newRating = await applyElo("race_ratings", challengerWallet, oppWallet, winner === "challenger");
        } catch (e) {}
      } else {
        log.push("👥 Mirror grid — no rating at stake against your own reflection.");
        events.push({ text: "👥 Mirror grid — no rating at stake against your own reflection.", t: "info" });
      }

      const displayRacer = (t) => t.map((f) => ({
        name: f.name, tier: f.tier, element: f.element, maxArmor: f.maxArmor,
        image: f.image, isGod: f.isGod, isCar: f.isCar, mods: f.mods,
      }));
      return res.status(200).json({
        winner, track: { id: track.id, blurb: track.blurb, favor: track.favor, weak: track.weak },
        log, events, podium, mirror,
        scores: { yours: scoreA, theirs: scoreB },
        rating: newRating,
        yourTeam: displayRacer(teamA),
        theirTeam: displayRacer(teamB),
        opponentWallet: oppWallet,
      });
    }

    if (action === "race-leaderboard") {
      let rows = [];
      try { rows = await sb(`race_ratings?select=*&order=rating.desc&limit=20`, { method: "GET" }); } catch (e) {}
      return res.status(200).json({ leaderboard: rows || [] });
    }



    // ================= ⚜️ CHAMPIONS =================
    if (action === "champion-status") {
      // Is this wallet in a champion snapshot, and where does its claim stand?
      const { wallet } = req.body;
      if (!wallet) return res.status(400).json({ error: "wallet required" });
      let rows = [];
      try {
        rows = (await sb(`champion_snapshot?wallet=eq.${encodeURIComponent(wallet)}&select=*`, { method: "GET" })) || [];
      } catch (e) {
        return res.status(200).json({ champion: null }); // table not created yet
      }
      if (!rows.length) return res.status(200).json({ champion: null });
      const snap = rows[0];
      const key = `champion_s${snap.season}`;
      // Already minted?
      const minted = await sb(
        `mints?age_card=eq.${encodeURIComponent(key)}&age_number=eq.${snap.slot}&select=mint_address,character_name`,
        { method: "GET" }
      );
      if (minted && minted.length) {
        return res.status(200).json({ champion: { ...snap, key, minted: true, mintAddress: minted[0].mint_address } });
      }
      // A live pending claim?
      const pend = await sb(
        `pending_mints?age_card=eq.${encodeURIComponent(key)}&age_number=eq.${snap.slot}&status=eq.unminted&select=id,tier`,
        { method: "GET" }
      );
      return res.status(200).json({
        champion: { ...snap, key, minted: false, pending: pend && pend[0] ? { id: pend[0].id, tier: pend[0].tier } : null },
      });
    }

    if (action === "champion-claim") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      // ⚜️ Self-serve, on the house. The snapshot IS the entitlement — no
      // allowance is consumed, no payment path is touched, nothing manual.
      // Idempotent: claiming again returns the same live pending mint, and a
      // voided/stale claim just issues a fresh one (the seat number is theirs
      // forever, so nothing is ever burned).
      const { wallet } = req.body;
      if (!wallet) return res.status(400).json({ error: "wallet required" });
      let rows = [];
      try {
        rows = (await sb(`champion_snapshot?wallet=eq.${encodeURIComponent(wallet)}&select=*`, { method: "GET" })) || [];
      } catch (e) {
        return res.status(400).json({ error: "The champion ledger isn't open yet." });
      }
      if (!rows.length) return res.status(403).json({ error: "This wallet is not in the champion cut." });
      const snap = rows[0];
      const key = `champion_s${snap.season}`;
      const minted = await sb(
        `mints?age_card=eq.${encodeURIComponent(key)}&age_number=eq.${snap.slot}&select=mint_address`,
        { method: "GET" }
      );
      if (minted && minted.length) {
        return res.status(409).json({ error: "Your Champion is already minted.", mintAddress: minted[0].mint_address });
      }
      const pend = await sb(
        `pending_mints?age_card=eq.${encodeURIComponent(key)}&age_number=eq.${snap.slot}&status=eq.unminted&select=id,tier`,
        { method: "GET" }
      );
      if (pend && pend.length) {
        return res.status(200).json({ pending: { id: pend[0].id, tier: pend[0].tier, ageCard: key, ageNumber: snap.slot } });
      }
      const inserted = await sb(`pending_mints`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify([{
          owner_wallet: wallet,
          pack_id: `champion-${snap.season}-${snap.slot}`,
          pack_type: "champion_grant",
          slot_index: 0,
          tier: "Legendary",
          universe: null,
          age_card: key,
          age_number: snap.slot,
          status: "unminted",
        }]),
      });
      return res.status(200).json({ pending: { id: inserted[0].id, tier: "Legendary", ageCard: key, ageNumber: snap.slot } });
    }

    // ================= 🥊 MANUAL PVP (BETA) =================
    // Turn-by-turn 1v1 on real cards. Unrated while in beta — deliberately:
    // manual play is the easiest thing to farm, so it touches no ladder the
    // Champion cut reads. State lives server-side; each move is validated
    // against whose turn it is, with an atomic turn-guard on the update.
    const pvpFighter = (row) => {
      const f = makeFighter(row);
      return {
        name: f.name, mint: f.mint, image: f.image, tier: f.tier, isGod: f.isGod,
        element: f.element, hp: f.hp, maxHp: f.maxHp, shield: 0,
        power: f.power, speed: f.speed, special: f.special,
        moves: [
          { id: "attack", name: "Strike", icon: "👊", kind: "damage", value: 40 + f.power * 3, once: false },
          ...[...f.sigs, ...f.abilities]
            .filter((a) => ["damage", "heal", "shield", "stun"].includes(a.kind))
            .slice(0, 5)
            .map((a) => ({ id: a.id, name: a.name, icon: a.icon, kind: a.kind, value: a.value || 40, once: true })),
        ],
        used: {},
        undying: (f.abilities || []).some((a) => a.kind === "revive") || f.isGod,
        usedUndying: false,
      };
    };

    const pvpApply = (att, def, moveId, log) => {
      const move = att.moves.find((m) => m.id === moveId) || att.moves[0];
      if (move.once && att.used[move.id]) return { error: "That move is spent." };
      if (move.once) att.used[move.id] = true;
      if (move.kind === "heal") {
        att.hp = Math.min(att.maxHp, att.hp + move.value);
        log.push(`💚 ${att.name} uses ${move.name} (+${move.value} HP → ${att.hp}).`);
      } else if (move.kind === "shield") {
        att.shield += move.value;
        log.push(`🛡 ${att.name} raises ${move.name} (+${move.value} shield).`);
      } else if (move.kind === "stun") {
        def.stunned = true;
        log.push(`⏭ ${att.name} lands ${move.name} — ${def.name} loses their next turn.`);
      } else {
        const mult = BEATS[att.element] === def.element ? 1.25 : BEATS[def.element] === att.element ? 0.8 : 1;
        let dmg = Math.round(move.value * mult * (0.9 + Math.random() * 0.2));
        if (def.shield > 0) {
          const soak = Math.min(def.shield, dmg);
          def.shield -= soak; dmg -= soak;
          if (soak) log.push(`🛡 ${def.name}'s shield absorbs ${soak}.`);
        }
        if (dmg > 0) {
          def.hp -= dmg;
          log.push(`⚡ ${att.name} hits ${def.name} with ${move.name} for ${dmg}! (${Math.max(0, def.hp)} HP left)`);
        }
        if (def.hp <= 0 && def.undying && !def.usedUndying) {
          def.usedUndying = true; def.hp = 1;
          log.push(`♾️ ${def.name} refuses to fall — UNDYING holds them at 1 HP!`);
        }
      }
      return { ko: def.hp <= 0 };
    };

    if (action === "pvp-challenge") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      const { wallet, mint, opponentWallet } = req.body;
      if (!wallet || !mint) return res.status(400).json({ error: "wallet and mint required" });
      if (!(await dailyAllowed(wallet, "pvp", 30))) {
        return res.status(429).json({ error: "30 PvP matches a day is the house limit. Resets at midnight UTC." });
      }
      const mine = await sb(`mints?mint_address=eq.${encodeURIComponent(mint)}&select=*`, { method: "GET" });
      if (!mine || !mine.length) return res.status(404).json({ error: "That mascot isn't minted." });
      if (mine[0].owner_wallet && mine[0].owner_wallet !== wallet) {
        return res.status(403).json({ error: "You don't own this mascot." });
      }
      const opp = (opponentWallet || "").trim() || null;
      if (opp === wallet) return res.status(400).json({ error: "You can't challenge yourself." });
      const inserted = await sb(`pvp_matches`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify([{ challenger_wallet: wallet, opponent_wallet: opp, challenger_mint: mint, status: "open" }]),
      });
      return res.status(200).json({ match: inserted[0] });
    }

    if (action === "pvp-accept") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      const { wallet, matchId, mint } = req.body;
      if (!wallet || !matchId || !mint) return res.status(400).json({ error: "wallet, matchId and mint required" });
      const rows = await sb(`pvp_matches?id=eq.${encodeURIComponent(matchId)}&select=*`, { method: "GET" });
      if (!rows || !rows.length) return res.status(404).json({ error: "Match not found." });
      const match = rows[0];
      if (match.status !== "open") return res.status(409).json({ error: "This challenge was already taken." });
      if (match.challenger_wallet === wallet) return res.status(400).json({ error: "You can't accept your own challenge." });
      if (match.opponent_wallet && match.opponent_wallet !== wallet) {
        return res.status(403).json({ error: "This challenge is addressed to another wallet." });
      }
      const mine = await sb(`mints?mint_address=eq.${encodeURIComponent(mint)}&select=*`, { method: "GET" });
      if (!mine || !mine.length) return res.status(404).json({ error: "That mascot isn't minted." });
      if (mine[0].owner_wallet && mine[0].owner_wallet !== wallet) {
        return res.status(403).json({ error: "You don't own this mascot." });
      }
      const challRows = await sb(`mints?mint_address=eq.${encodeURIComponent(match.challenger_mint)}&select=*`, { method: "GET" });
      if (!challRows || !challRows.length) return res.status(410).json({ error: "The challenger's mascot vanished." });
      const a = pvpFighter(challRows[0]);
      const b = pvpFighter(mine[0]);
      const first = a.speed + Math.random() >= b.speed + Math.random() ? match.challenger_wallet : wallet;
      const log = [
        `🥊 MANUAL PVP — ${a.name} vs ${b.name}. Every move is a real decision.`,
        `➡️ ${first === match.challenger_wallet ? a.name : b.name} moves first (speed).`,
      ];
      // Atomic accept: only flips if still open — two accepts can't both land.
      const updated = await sb(
        `pvp_matches?id=eq.${encodeURIComponent(matchId)}&status=eq.open`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            opponent_wallet: wallet,
            opponent_mint: mint,
            status: "active",
            turn: first,
            state: { a, b },
            log,
            updated_at: new Date().toISOString(),
          }),
        }
      );
      if (!updated || !updated.length) return res.status(409).json({ error: "Someone accepted this challenge a moment before you." });
      return res.status(200).json({ match: updated[0] });
    }

    if (action === "pvp-move") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      const { wallet, matchId, moveId } = req.body;
      if (!wallet || !matchId || !moveId) return res.status(400).json({ error: "wallet, matchId and moveId required" });
      const rows = await sb(`pvp_matches?id=eq.${encodeURIComponent(matchId)}&select=*`, { method: "GET" });
      if (!rows || !rows.length) return res.status(404).json({ error: "Match not found." });
      const match = rows[0];
      if (match.status !== "active") return res.status(409).json({ error: "This match isn't live." });
      if (match.turn !== wallet) return res.status(403).json({ error: "Not your turn." });
      const iAmChallenger = match.challenger_wallet === wallet;
      const state = match.state || {};
      const me = iAmChallenger ? state.a : state.b;
      const them = iAmChallenger ? state.b : state.a;
      if (!me || !them) return res.status(500).json({ error: "Match state corrupted — forfeit and rematch." });
      const log = Array.isArray(match.log) ? match.log : [];

      let result;
      if (me.stunned) {
        me.stunned = false;
        log.push(`⏭ ${me.name} is stunned and loses the turn!`);
        result = { ko: false };
      } else {
        result = pvpApply(me, them, moveId, log);
        if (result.error) return res.status(400).json({ error: result.error });
      }

      const done = result.ko;
      const winner = done ? wallet : null;
      if (done) log.push(`🏆 ${me.name} WINS! (unrated beta — no ladder points move)`);
      // Turn-guard PATCH: only lands if it is STILL our turn — a double-send
      // of the same move can't apply twice.
      const updated = await sb(
        `pvp_matches?id=eq.${encodeURIComponent(matchId)}&turn=eq.${encodeURIComponent(wallet)}&status=eq.active`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            state: { a: state.a, b: state.b },
            log,
            turn: done ? null : (iAmChallenger ? match.opponent_wallet : match.challenger_wallet),
            status: done ? "done" : "active",
            winner,
            updated_at: new Date().toISOString(),
          }),
        }
      );
      if (!updated || !updated.length) return res.status(409).json({ error: "Move collision — reload the match." });
      return res.status(200).json({ match: updated[0] });
    }

    if (action === "pvp-state") {
      const { matchId } = req.body;
      if (!matchId) return res.status(400).json({ error: "matchId required" });
      const rows = await sb(`pvp_matches?id=eq.${encodeURIComponent(matchId)}&select=*`, { method: "GET" });
      if (!rows || !rows.length) return res.status(404).json({ error: "Match not found." });
      return res.status(200).json({ match: rows[0] });
    }

    if (action === "pvp-list") {
      const { wallet } = req.body;
      if (!wallet) return res.status(400).json({ error: "wallet required" });
      const w = encodeURIComponent(wallet);
      const mine = (await sb(
        `pvp_matches?or=(challenger_wallet.eq.${w},opponent_wallet.eq.${w})&status=in.(open,active)&select=*&order=updated_at.desc&limit=20`,
        { method: "GET" }
      )) || [];
      const open = (await sb(
        `pvp_matches?status=eq.open&opponent_wallet=is.null&challenger_wallet=neq.${w}&select=*&order=created_at.desc&limit=20`,
        { method: "GET" }
      )) || [];
      const recent = (await sb(
        `pvp_matches?or=(challenger_wallet.eq.${w},opponent_wallet.eq.${w})&status=eq.done&select=*&order=updated_at.desc&limit=5`,
        { method: "GET" }
      )) || [];
      return res.status(200).json({ mine, open, recent });
    }

    if (action === "pvp-forfeit") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      const { wallet, matchId } = req.body;
      if (!wallet || !matchId) return res.status(400).json({ error: "wallet and matchId required" });
      const rows = await sb(`pvp_matches?id=eq.${encodeURIComponent(matchId)}&select=*`, { method: "GET" });
      if (!rows || !rows.length) return res.status(404).json({ error: "Match not found." });
      const match = rows[0];
      const involved = match.challenger_wallet === wallet || match.opponent_wallet === wallet;
      if (!involved) return res.status(403).json({ error: "Not your match." });
      if (match.status === "open") {
        await sb(`pvp_matches?id=eq.${encodeURIComponent(matchId)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() }),
        });
        return res.status(200).json({ ok: true, cancelled: true });
      }
      if (match.status !== "active") return res.status(409).json({ error: "Match already ended." });
      const winner = match.challenger_wallet === wallet ? match.opponent_wallet : match.challenger_wallet;
      const log = Array.isArray(match.log) ? match.log : [];
      log.push(`🏳️ Forfeit — the win goes to the one still standing.`);
      await sb(`pvp_matches?id=eq.${encodeURIComponent(matchId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done", winner, log, turn: null, updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ ok: true, winner });
    }

    if (action === "pvp-timeout") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      // 24h of silence on their turn = the waiting player may take the win.
      const { wallet, matchId } = req.body;
      if (!wallet || !matchId) return res.status(400).json({ error: "wallet and matchId required" });
      const rows = await sb(`pvp_matches?id=eq.${encodeURIComponent(matchId)}&select=*`, { method: "GET" });
      if (!rows || !rows.length) return res.status(404).json({ error: "Match not found." });
      const match = rows[0];
      if (match.status !== "active") return res.status(409).json({ error: "Match isn't live." });
      const involved = match.challenger_wallet === wallet || match.opponent_wallet === wallet;
      if (!involved || match.turn === wallet) return res.status(403).json({ error: "The clock only runs on THEIR turn." });
      const idleMs = Date.now() - new Date(match.updated_at).getTime();
      if (idleMs < 24 * 60 * 60 * 1000) {
        return res.status(409).json({ error: `Not yet — ${Math.ceil((24 * 60 * 60 * 1000 - idleMs) / 3600000)}h left on their clock.` });
      }
      const log = Array.isArray(match.log) ? match.log : [];
      log.push("⏰ The clock ran out. The win goes to the one who showed up.");
      await sb(`pvp_matches?id=eq.${encodeURIComponent(matchId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done", winner: wallet, log, turn: null, updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ ok: true, winner: wallet });
    }

    // ================= 📖 PUBLISHING (Session A) =================
    if (action === "profile-claim") {
      const { wallet, username, avatarMint } = req.body;
      if (!wallet || !username) return res.status(400).json({ error: "wallet and username required" });
      const authErr = requireAuth(wallet, req.body.auth);
      if (authErr) return res.status(401).json({ error: authErr });
      const name = String(username).trim();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(name)) {
        return res.status(400).json({ error: "3-20 characters: letters, numbers, underscores." });
      }
      const RESERVED = ["mascotgen", "admin", "mod", "moderator", "support", "official", "gravel", "mortis", "toro", "aurelia", "vraxon", "system", "verse", "news"];
      const PROFANE = ["fuck", "shit", "bitch", "cunt", "nigg", "fag", "rape", "nazi", "hitler"];
      const low = name.toLowerCase();
      if (RESERVED.includes(low) || PROFANE.some((w) => low.includes(w))) {
        return res.status(400).json({ error: "That name isn't available." });
      }
      const existing = await sb(`profiles?or=(wallet.eq.${encodeURIComponent(wallet)},username.ilike.${encodeURIComponent(name)})&select=wallet,username`, { method: "GET" });
      if ((existing || []).some((p) => p.wallet !== wallet && p.username.toLowerCase() === low)) {
        return res.status(409).json({ error: "That name is taken." });
      }
      await sb(`profiles?on_conflict=wallet`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ wallet, username: name, avatar_mint: avatarMint || null }),
      });
      return res.status(200).json({ ok: true, username: name });
    }

    if (action === "profile-get") {
      const { wallet, username } = req.body;
      const filter = wallet
        ? `wallet=eq.${encodeURIComponent(wallet)}`
        : username
        ? `username=ilike.${encodeURIComponent(String(username))}`
        : null;
      if (!filter) return res.status(400).json({ error: "wallet or username required" });
      const rows = await sb(`profiles?${filter}&select=*`, { method: "GET" });
      return res.status(200).json({ profile: (rows && rows[0]) || null });
    }

    if (action === "chapter-publish") {
      const { wallet, mintAddress, title, panels, arcName, chapterNo } = req.body;
      if (!wallet || !mintAddress || !title || !Array.isArray(panels) || panels.length === 0) {
        return res.status(400).json({ error: "wallet, mintAddress, title and panels required" });
      }
      const authErr = requireAuth(wallet, req.body.auth);
      if (authErr) return res.status(401).json({ error: authErr });
      // Minted + owned: the wallet publishing must hold the mascot.
      const mintRows = await sb(`mints?mint_address=eq.${encodeURIComponent(mintAddress)}&select=owner_wallet,character_name`, { method: "GET" });
      if (!mintRows || !mintRows.length) return res.status(404).json({ error: "Only minted mascots can publish." });
      // No recorded owner = no publish. Early records (pre-owner_wallet) fix
      // themselves the moment the real holder hits Sync Wallet — safest default
      // is to refuse rather than let ANY wallet publish under an orphan mint.
      if (!mintRows[0].owner_wallet) {
        return res.status(403).json({ error: "This mascot has no recorded owner yet — hit Sync Wallet in the Legion first, then publish." });
      }
      if (mintRows[0].owner_wallet !== wallet) {
        return res.status(403).json({ error: "You don't own this mascot." });
      }
      let inserted;
      try {
        inserted = await sb(`published_chapters`, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify([{
            wallet,
            mint_address: mintAddress,
            character_name: mintRows[0].character_name || "Unknown",
            arc_name: arcName ? String(arcName).slice(0, 40) : null,
            chapter_no: Number.isFinite(Number(chapterNo)) ? Number(chapterNo) : null,
            title: String(title).slice(0, 120),
            panels: panels.slice(0, 24).map((p) => String(p).slice(0, 2500)),
          }]),
        });
      } catch (e) {
        // The (mint_address, lower(title)) unique index caught a duplicate —
        // the chapter is already live. Not an error worth showing as one.
        if (String(e.message).includes("23505") || /duplicate key/i.test(String(e.message))) {
          return res.status(409).json({ error: "This chapter is already published. Unpublish it first to replace it." });
        }
        throw e;
      }
      return res.status(200).json({ ok: true, id: inserted[0].id });
    }

    if (action === "chapter-unpublish") {
      const { wallet, chapterId } = req.body;
      if (!wallet || !chapterId) return res.status(400).json({ error: "wallet and chapterId required" });
      const authErr = requireAuth(wallet, req.body.auth);
      if (authErr) return res.status(401).json({ error: authErr });
      const rows = await sb(`published_chapters?id=eq.${encodeURIComponent(chapterId)}&select=wallet`, { method: "GET" });
      if (!rows || !rows.length) return res.status(404).json({ error: "Not found" });
      if (rows[0].wallet !== wallet) return res.status(403).json({ error: "Not yours to unpublish." });
      await sb(`published_chapters?id=eq.${encodeURIComponent(chapterId)}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    if (action === "chapters-by-author") {
      const { wallet, username, limit } = req.body;
      let target = wallet;
      if (!target && username) {
        const p = await sb(`profiles?username=ilike.${encodeURIComponent(String(username))}&select=wallet`, { method: "GET" });
        target = p && p[0] ? p[0].wallet : null;
      }
      if (!target) return res.status(400).json({ error: "wallet or username required" });
      const rows = await sb(
        `published_chapters?wallet=eq.${encodeURIComponent(target)}&select=id,mint_address,character_name,arc_name,chapter_no,title,panels,published_at&order=published_at.desc&limit=${Math.min(Number(limit) || 50, 100)}`,
        { method: "GET" }
      );
      return res.status(200).json({ chapters: rows || [] });
    }

    // ---- 🤖 TELEGRAM BATTLE — free, and deliberately so ---------------------
    // Runs the real deterministic engine and returns a COMPACT log a chat can
    // read. No AI anywhere on this path, so a thousand of these cost the same
    // as one: the words are already written by the simulator.
    //
    // Fighters are BORROWED from the public pool — Telegram players need no
    // wallet, no email, no account. That is the entire point: the barrier to a
    // first fight is zero, and desire to own one is what converts them later.
    // Nothing here touches Elo, so free play can never pollute the ladder the
    // Champions are chosen from.
    if (action === "tg-battle") {
      const pool = (await sb(
        `mints?select=mint_address,character_name,traits,card_tier,rarity,universe,element,marked_by,age_card,age_number,god_number,legendary_season,mint_number&limit=300`,
        { method: "GET" }
      )) || [];
      // Sealed thrones never appear, here or anywhere.
      const usable = pool.filter((m) => m.traits && m.character_name && !(m.god_number && SEALED_THRONES.includes(m.god_number)));
      if (usable.length < 2) return res.status(400).json({ error: "Not enough mascots exist yet." });

      const pick = () => usable[Math.floor(Math.random() * usable.length)];
      let A = pick(), B = pick(), guard = 0;
      while (B.mint_address === A.mint_address && guard++ < 20) B = pick();

      const fA = makeFighter(A), fB = makeFighter(B);
      const nameA = String(req.body.nameA || "Challenger").slice(0, 24);
      const nameB = String(req.body.nameB || "The Void").slice(0, 24);
      const result = simulate([fA], [fB], nameA, nameB);

      // Compress for a chat window: keep the beats that read as drama and drop
      // the per-swing noise. Telegram caps a message at 4096 characters.
      const keep = new Set(["ko", "godBanner", "undying", "banish", "stun", "reflect", "double", "heal", "shield"]);
      const lines = [];
      for (const e of result.events || []) {
        if (e.t === "round" && e.n % 3 === 1) lines.push(`— Round ${e.n} —`);
        else if (keep.has(e.t)) lines.push(e.text);
        else if (e.t === "hit" && e.dmg >= 55) lines.push(e.text);
        if (lines.length > 26) break;
      }
      return res.status(200).json({
        winner: result.winner,
        a: { name: fA.name, tier: fA.tier, hp: fA.maxHp, element: fA.element, left: Math.max(0, fA.hp) },
        b: { name: fB.name, tier: fB.tier, hp: fB.maxHp, element: fB.element, left: Math.max(0, fB.hp) },
        lines,
      });
    }

    // ---- 🛡 CLANS ----------------------------------------------------------
    // The feature the Deep 7 balance was always promising: one Deep 7 beats a
    // god one-on-one, but a clan beats a Deep 7. Reads are public; every write
    // is signature-gated and the hard rules (one clan per wallet, 33 members,
    // unique names) are enforced in SQL, not here, so they cannot be raced.
    if (action === "clan-ladder") {
      const rows = await sb(`rpc/clan_ladder`, { method: "POST", body: "{}" });
      return res.status(200).json({ clans: Array.isArray(rows) ? rows : [] });
    }

    if (action === "clan-mine") {
      const { wallet } = req.body || {};
      if (!wallet) return res.status(400).json({ error: "wallet required" });
      const mem = await sb(`clan_members?wallet=eq.${encodeURIComponent(wallet)}&select=clan_id,role,joined_at`, { method: "GET" });
      if (!mem || !mem.length) return res.status(200).json({ clan: null });
      const c = await sb(`clans?id=eq.${encodeURIComponent(mem[0].clan_id)}&select=*`, { method: "GET" });
      if (!c || !c.length) return res.status(200).json({ clan: null });
      // The roster, with each member's rating and author name where they have one.
      const roster = (await sb(
        `clan_members?clan_id=eq.${encodeURIComponent(mem[0].clan_id)}&select=wallet,role,joined_at&order=joined_at.asc&limit=40`,
        { method: "GET" }
      )) || [];
      const wallets = roster.map((r) => r.wallet).filter(Boolean);
      const nameOf = {}, ratingOf = {};
      if (wallets.length) {
        const f = `(${wallets.map((w) => `"${w}"`).join(",")})`;
        try {
          const profs = (await sb(`profiles?wallet=in.${encodeURIComponent(f)}&select=wallet,username`, { method: "GET" })) || [];
          for (const p of profs) nameOf[p.wallet] = p.username;
        } catch (e) {}
        try {
          const rs = (await sb(`battle_ratings?wallet=in.${encodeURIComponent(f)}&select=wallet,rating,wins,losses`, { method: "GET" })) || [];
          for (const r of rs) ratingOf[r.wallet] = r;
        } catch (e) {}
      }
      return res.status(200).json({
        clan: c[0],
        role: mem[0].role,
        roster: roster.map((r) => ({
          wallet: `${r.wallet.slice(0, 4)}..${r.wallet.slice(-4)}`,
          fullWallet: r.wallet,
          username: nameOf[r.wallet] || null,
          rating: (ratingOf[r.wallet] || {}).rating || 1000,
          wins: (ratingOf[r.wallet] || {}).wins || 0,
          role: r.role,
        })),
      });
    }

    if (action === "clan-create") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      const name = String(req.body.name || "").trim().slice(0, 28);
      const tag = String(req.body.tag || "").trim().toUpperCase().slice(0, 5);
      const motto = String(req.body.motto || "").trim().slice(0, 90);
      if (name.length < 3) return res.status(400).json({ error: "A clan name needs at least 3 characters." });
      if (!/^[A-Z0-9]{2,5}$/.test(tag)) return res.status(400).json({ error: "The tag is 2-5 letters or numbers — it rides beside every member's name." });
      const r = await sb(`rpc/clan_create`, {
        method: "POST",
        body: JSON.stringify({ p_wallet: req.body.wallet, p_name: name, p_tag: tag, p_motto: motto }),
      });
      if (!r || !r.ok) {
        const why = {
          already_in_clan: "You're already in a clan — leave it first.",
          name_taken: "That name is taken.",
          tag_taken: "That tag is taken.",
        }[r && r.reason] || "Couldn't found the clan.";
        return res.status(400).json({ error: why });
      }
      return res.status(200).json({ ok: true, id: r.id });
    }

    if (action === "clan-join") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      const r = await sb(`rpc/clan_join`, {
        method: "POST",
        body: JSON.stringify({ p_wallet: req.body.wallet, p_clan: req.body.clanId }),
      });
      if (!r || !r.ok) {
        const why = {
          already_in_clan: "You're already in a clan — leave it first.",
          no_such_clan: "That clan no longer exists.",
          clan_full: "That clan is full — 33 is the cap.",
        }[r && r.reason] || "Couldn't join.";
        return res.status(400).json({ error: why });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === "clan-leave") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      const r = await sb(`rpc/clan_leave`, { method: "POST", body: JSON.stringify({ p_wallet: req.body.wallet }) });
      if (!r || !r.ok) return res.status(400).json({ error: "You're not in a clan." });
      return res.status(200).json({ ok: true, disbanded: !!r.disbanded });
    }

    // ---- ⚔️ CLAN WARS -------------------------------------------------------
    // Five vs five, each member's BEST mascot, fought in rating order, first to
    // three. Resolves in one call — a challenge nobody answers for a week isn't
    // a feature. Costs nothing to run: same deterministic engine, no AI.
    //
    // Deliberately does NOT touch personal Elo. The Champion cut is chosen off
    // the individual ladder, so nothing optional is allowed to move it — a clan
    // can lose ten wars and no member's rating shifts by a point.
    if (action === "clan-war-list") {
      const rows = await sb(`clan_wars?select=id,a_name,b_name,a_score,b_score,winner_clan,a_clan,created_at&order=created_at.desc&limit=12`, { method: "GET" });
      return res.status(200).json({ wars: Array.isArray(rows) ? rows : [] });
    }

    if (action === "clan-war-declare") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      const { wallet, targetClanId } = req.body || {};
      if (!targetClanId) return res.status(400).json({ error: "Pick a clan to fight." });

      // Only a leader declares, and only for their own clan.
      const me = await sb(`clan_members?wallet=eq.${encodeURIComponent(wallet)}&select=clan_id,role`, { method: "GET" });
      if (!me || !me.length) return res.status(403).json({ error: "You're not in a clan." });
      if (me[0].role !== "leader") return res.status(403).json({ error: "Only the clan leader can declare war." });
      const myClan = me[0].clan_id;
      if (myClan === targetClanId) return res.status(400).json({ error: "You can't declare war on yourselves." });

      const ready = await sb(`rpc/clan_war_ready`, { method: "POST", body: JSON.stringify({ p_clan: myClan }) });
      if (ready === false) return res.status(429).json({ error: "Your clan already fought within the hour. Let them bury the dead." });

      const both = await sb(`clans?id=in.(${encodeURIComponent(`"${myClan}","${targetClanId}"`)})&select=id,name,tag`, { method: "GET" });
      const A = (both || []).find((c) => c.id === myClan);
      const B = (both || []).find((c) => c.id === targetClanId);
      if (!A || !B) return res.status(404).json({ error: "That clan no longer exists." });

      const rosterOf = async (id) =>
        (await sb(`rpc/clan_war_roster`, { method: "POST", body: JSON.stringify({ p_clan: id }) })) || [];
      const [ra, rb] = await Promise.all([rosterOf(myClan), rosterOf(targetClanId)]);
      if (!ra.length || !rb.length) return res.status(400).json({ error: "Both clans need at least one member." });

      // Each member fields their single best mascot — highest Battle HP, which
      // already folds in tier, age card and the God-Mark.
      const bestFor = async (w) => {
        const rows = (await sb(
          `mints?owner_wallet=eq.${encodeURIComponent(w)}&select=mint_address,character_name,traits,card_tier,rarity,universe,element,marked_by,age_card,age_number,god_number,legendary_season,mint_number&limit=40`,
          { method: "GET" }
        )) || [];
        const usable = rows.filter((m) => m.traits && m.character_name && !(m.god_number && SEALED_THRONES.includes(m.god_number)));
        if (!usable.length) return null;
        return usable.map(makeFighter).sort((x, y) => y.maxHp - x.maxHp)[0];
      };
      const [fa, fb] = await Promise.all([
        Promise.all(ra.map((m) => bestFor(m.wallet))),
        Promise.all(rb.map((m) => bestFor(m.wallet))),
      ]);
      const sideA = fa.filter(Boolean), sideB = fb.filter(Boolean);
      if (!sideA.length || !sideB.length) return res.status(400).json({ error: "Both clans need at least one MINTED mascot to go to war." });

      // Fight down the line. A short side simply re-fields its best — being
      // outnumbered should hurt, not hand the war over on a technicality.
      const bouts = []; let aWin = 0, bWin = 0;
      for (let i = 0; i < 5 && aWin < 3 && bWin < 3; i++) {
        const x = makeFighter0(sideA[i % sideA.length]);
        const y = makeFighter0(sideB[i % sideB.length]);
        const r = simulate([x], [y], A.name, B.name);
        const aTook = r.winner === "challenger";
        if (aTook) aWin++; else bWin++;
        bouts.push({ a: x.name, b: y.name, winner: aTook ? "a" : "b", aLeft: Math.max(0, x.hp), bLeft: Math.max(0, y.hp) });
      }

      const rec = await sb(`rpc/clan_war_record`, {
        method: "POST",
        body: JSON.stringify({
          p_a: myClan, p_b: targetClanId, p_aname: A.name, p_bname: B.name,
          p_awin: aWin, p_bwin: bWin, p_bouts: bouts,
        }),
      });
      return res.status(200).json({
        ok: true, a: A, b: B, aScore: aWin, bScore: bWin,
        winner: aWin > bWin ? A.name : bWin > aWin ? B.name : null,
        bouts, id: rec && rec.id,
      });
    }

    // ---- 📡 VERSE NEWS ----------------------------------------------------
    // The official broadcast: canon announcements, age openings, season drops.
    // Reading is public and gateless. Posting is the studio alone.
    if (action === "news-list") {
      const rows = await sb(
        `verse_news?select=id,title,body,kind,pinned,created_at&order=pinned.desc,created_at.desc&limit=${Math.min(Number(req.body.limit) || 20, 50)}`,
        { method: "GET" }
      );
      return res.status(200).json({ news: Array.isArray(rows) ? rows : [] });
    }

    if (action === "news-post") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      if (!isOwnerWallet(req.body.wallet)) {
        return res.status(403).json({ error: "Verse News is the official broadcast — only the studio posts here." });
      }
      const title = String(req.body.title || "").trim().slice(0, 140);
      const body = String(req.body.body || "").trim().slice(0, 4000);
      const kind = ["canon", "age", "season", "event", "notice"].includes(req.body.kind) ? req.body.kind : "notice";
      if (!title || !body) return res.status(400).json({ error: "A broadcast needs a headline and a body." });
      const inserted = await sb(`verse_news`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify([{ title, body, kind, pinned: !!req.body.pinned }]),
      });
      return res.status(200).json({ ok: true, post: Array.isArray(inserted) ? inserted[0] : null });
    }

    if (action === "news-delete") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      if (!isOwnerWallet(req.body.wallet)) return res.status(403).json({ error: "Not yours to take down." });
      const id = String(req.body.id || "").trim();
      if (!id) return res.status(400).json({ error: "id required" });
      await sb(`verse_news?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    if (action === "chapters-recent") {
      // 📖 THE LIBRARY FEED — the newest published chapters from everyone,
      // with author bylines resolved in one pass. Previews only: the full
      // chapter lives on the author's page, which is where a click lands.
      const { limit } = req.body || {};
      const rows = (await sb(
        `published_chapters?select=id,wallet,mint_address,character_name,arc_name,chapter_no,title,panels,published_at&order=published_at.desc&limit=${Math.min(Number(limit) || 40, 100)}`,
        { method: "GET" }
      )) || [];
      const wallets = [...new Set(rows.map((r) => r.wallet).filter(Boolean))];
      let profs = [];
      if (wallets.length) {
        const pf = `(${wallets.map((w) => `"${w}"`).join(",")})`;
        try {
          profs = (await sb(`profiles?wallet=in.${encodeURIComponent(pf)}&select=wallet,username`, { method: "GET" })) || [];
        } catch (e) {}
      }
      const nameOf = {};
      for (const p of profs) nameOf[p.wallet] = p.username;
      // The mascots behind the chapters — art + card identity, one query.
      // Sealed thrones stay sealed: their visuals are withheld server-side.
      const mascots = {};
      const mintsList = [...new Set(rows.map((r) => r.mint_address).filter(Boolean))];
      if (mintsList.length) {
        try {
          const mf = `(${mintsList.map((m) => `"${m}"`).join(",")})`;
          const mrows = (await sb(
            `mints?mint_address=in.${encodeURIComponent(mf)}&select=mint_address,image_url,card_tier,rarity,universe,element,god_number,mark_number,marked_by`,
            { method: "GET" }
          )) || [];
          for (const m of mrows) {
            if (m.god_number && SEALED_THRONES.includes(m.god_number)) continue;
            mascots[m.mint_address] = {
              image: m.image_url || null,
              tier: m.card_tier || m.rarity || "Common",
              universe: m.universe || null,
              element: m.element || null,
              god: !!m.god_number,
              markNumber: m.mark_number || null,
              markedBy: m.marked_by || null,
            };
          }
        } catch (e) {}
      }
      // 📖 Which arcs are real cross-character sagas? Group the feed by
      // arc_name and flag any arc that spans more than one mascot — those get a
      // "READ THE SAGA" entry point on the card. Cheap, in-memory, no extra
      // query, and accurate for everything inside the loaded window.
      const arcMints = {};
      for (const r of rows) {
        if (!r.arc_name) continue;
        (arcMints[r.arc_name] = arcMints[r.arc_name] || new Set()).add(r.mint_address);
      }
      const firstOfArc = {};
      for (const r of [...rows].sort((a, b) => (a.chapter_no || 0) - (b.chapter_no || 0))) {
        if (r.arc_name && firstOfArc[r.arc_name] === undefined) firstOfArc[r.arc_name] = r.id;
      }
      return res.status(200).json({
        chapters: rows.map((r) => {
          const m = mascots[r.mint_address] || {};
          const isSaga = r.arc_name && arcMints[r.arc_name] && arcMints[r.arc_name].size > 1;
          return {
            id: r.id,
            mintAddress: r.mint_address,
            character: r.character_name,
            arc: r.arc_name,
            chapterNo: r.chapter_no,
            // Set only when this chapter is part of a multi-character saga.
            sagaName: isSaga ? r.arc_name : null,
            sagaFirstId: isSaga ? firstOfArc[r.arc_name] : null,
            title: r.title,
            preview: Array.isArray(r.panels) && r.panels[0] ? String(r.panels[0]).slice(0, 220) : "",
            panelCount: Array.isArray(r.panels) ? r.panels.length : 0,
            publishedAt: r.published_at,
            author: nameOf[r.wallet] || null,
            // ✦ OFFICIAL CANON. Decided SERVER-SIDE from the publishing wallet
            // against DEV_WALLETS — never from a client flag, a username, or an
            // arc name, all of which a player could copy. Once players start
            // publishing, the main saga has to stay findable in the feed or it
            // simply gets buried under everyone else's chapters.
            official: isOwnerWallet(r.wallet),
            image: m.image || null,
            tier: m.tier || null,
            universe: m.universe || null,
            element: m.element || null,
          };
        }),
      });
    }

    if (action === "author-page") {
      // 👤 A PUBLIC AUTHOR PAGE — profile + every published chapter, by
      // username. This is the read side of profile-claim: the byline resolves
      // to a page anyone can open with /?a=username. Wallets stay truncated
      // client-side; the avatar resolves to the minted mascot's art.
      const { username } = req.body || {};
      if (!username) return res.status(400).json({ error: "username required" });
      const profs = await sb(
        `profiles?username=ilike.${encodeURIComponent(String(username))}&select=wallet,username,avatar_mint`,
        { method: "GET" }
      );
      if (!profs || !profs.length) return res.status(404).json({ error: "No author by that name." });
      const p = profs[0];
      let avatarImage = null;
      if (p.avatar_mint) {
        try {
          const m = await sb(`mints?mint_address=eq.${encodeURIComponent(p.avatar_mint)}&select=image_url`, { method: "GET" });
          avatarImage = (m && m[0] && m[0].image_url) || null;
        } catch (e) {}
      }
      const chapters = (await sb(
        `published_chapters?wallet=eq.${encodeURIComponent(p.wallet)}&select=id,mint_address,character_name,arc_name,chapter_no,title,panels,published_at&order=published_at.desc&limit=100`,
        { method: "GET" }
      )) || [];
      // The cast — full card identity for every mascot on this page, so the
      // reader sees WHO the story is about, not just their name. Sealed
      // thrones excluded server-side, as everywhere else.
      const mascots = {};
      const mintsList = [...new Set(chapters.map((c) => c.mint_address).filter(Boolean))];
      if (mintsList.length) {
        try {
          const mf = `(${mintsList.map((m) => `"${m}"`).join(",")})`;
          const mrows = (await sb(
            `mints?mint_address=in.${encodeURIComponent(mf)}&select=mint_address,image_url,card_tier,rarity,universe,element,god_number,mark_number,marked_by,legendary_season`,
            { method: "GET" }
          )) || [];
          for (const m of mrows) {
            if (m.god_number && SEALED_THRONES.includes(m.god_number)) continue;
            mascots[m.mint_address] = {
              image: m.image_url || null,
              tier: m.card_tier || m.rarity || "Common",
              universe: m.universe || null,
              element: m.element || null,
              god: !!m.god_number,
              godNumber: m.god_number || null,
              markNumber: m.mark_number || null,
              markedBy: m.marked_by || null,
              season: m.legendary_season || null,
            };
          }
        } catch (e) {}
      }
      // No chosen avatar? The author's face defaults to their first mascot.
      if (!avatarImage) {
        const first = chapters.map((c) => mascots[c.mint_address]).find((m) => m && m.image);
        if (first) avatarImage = first.image;
      }
      return res.status(200).json({
        author: { username: p.username, avatarImage, wallet: `${p.wallet.slice(0, 4)}..${p.wallet.slice(-4)}` },
        chapters,
        mascots,
      });
    }

    if (action === "chapter-get") {
      // 🔗 A CHAPTER PERMALINK — /?c=<id>. One chapter, its mascot, its author.
      // This is the unit people actually share: a single story, not a whole
      // author page. Public and gateless, like every other read endpoint.
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "id required" });
      const rows = await sb(
        `published_chapters?id=eq.${encodeURIComponent(id)}&select=id,wallet,mint_address,character_name,arc_name,chapter_no,title,panels,published_at`,
        { method: "GET" }
      );
      if (!rows || !rows.length) return res.status(404).json({ error: "That chapter doesn't exist, or it was unpublished." });
      const ch = rows[0];
      let author = null;
      try {
        const p = await sb(`profiles?wallet=eq.${encodeURIComponent(ch.wallet)}&select=username`, { method: "GET" });
        author = p && p[0] ? p[0].username : null;
      } catch (e) {}
      let mascot = null;
      if (ch.mint_address) {
        try {
          const m = await sb(
            `mints?mint_address=eq.${encodeURIComponent(ch.mint_address)}&select=image_url,card_tier,rarity,universe,element,god_number,mark_number,marked_by,legendary_season`,
            { method: "GET" }
          );
          const row = m && m[0];
          if (row && !(row.god_number && SEALED_THRONES.includes(row.god_number))) {
            mascot = {
              image: row.image_url || null,
              tier: row.card_tier || row.rarity || "Common",
              universe: row.universe || null,
              element: row.element || null,
              god: !!row.god_number,
              markNumber: row.mark_number || null,
              markedBy: row.marked_by || null,
              season: row.legendary_season || null,
            };
          }
        } catch (e) {}
      }
      // Sibling chapters for the same mascot — lets the reader keep going
      // instead of hitting a dead end at the bottom of a shared link.
      let siblings = [];
      if (ch.mint_address) {
        try {
          siblings = (await sb(
            `published_chapters?mint_address=eq.${encodeURIComponent(ch.mint_address)}&select=id,title,chapter_no,published_at&order=chapter_no.asc&limit=50`,
            { method: "GET" }
          )) || [];
        } catch (e) {}
      }
      // 📖 THE SAGA. arc_name is the book; chapter_no is the page order. When an
      // arc groups chapters from MORE THAN ONE mascot, it is a cross-character
      // saga — the main-plot case — and this is what makes it read like one
      // book instead of a pile of separate character stories. We return every
      // part in order, tagged with which character each belongs to, plus the
      // prev/next hop so a reader can walk the whole thing start to finish.
      let saga = null;
      if (ch.arc_name) {
        try {
          const arcRows = (await sb(
            `published_chapters?arc_name=eq.${encodeURIComponent(ch.arc_name)}&select=id,title,chapter_no,character_name,mint_address,published_at&order=chapter_no.asc,published_at.asc&limit=200`,
            { method: "GET" }
          )) || [];
          const distinctMints = new Set(arcRows.map((r) => r.mint_address).filter(Boolean));
          // Only surface a "saga" when it truly spans characters — a solo
          // character's own numbered chapters already ride the sibling list.
          if (arcRows.length > 1 && distinctMints.size > 1) {
            const parts = arcRows.map((r) => ({
              id: r.id,
              title: r.title,
              chapterNo: r.chapter_no,
              character: r.character_name,
            }));
            const idx = parts.findIndex((p) => p.id === ch.id);
            saga = {
              name: ch.arc_name,
              total: parts.length,
              index: idx,
              parts,
              prevId: idx > 0 ? parts[idx - 1].id : null,
              nextId: idx >= 0 && idx < parts.length - 1 ? parts[idx + 1].id : null,
            };
          }
        } catch (e) {}
      }
      return res.status(200).json({
        chapter: {
          id: ch.id,
          mintAddress: ch.mint_address,
          character: ch.character_name,
          arc: ch.arc_name,
          chapterNo: ch.chapter_no,
          title: ch.title,
          panels: ch.panels || [],
          publishedAt: ch.published_at,
        },
        author,
        mascot,
        siblings: siblings.map((s) => ({ id: s.id, title: s.title, chapterNo: s.chapter_no })),
        saga,
      });
    }

    if (action === "bible-save") {
      {
        const authErr = requireAuth(req.body.ownerWallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      // 📓 WRITER'S BIBLE — stored server-side so it follows the mascot to every
      // device instead of living only in one browser's local storage.
      const { mintAddress, notes, ownerWallet } = req.body;
      if (!mintAddress) return res.status(400).json({ error: "mintAddress required" });
      const rows = await sb(`mints?mint_address=eq.${encodeURIComponent(mintAddress)}&select=owner_wallet`, { method: "GET" });
      if (!rows || rows.length === 0) return res.status(404).json({ error: "Mascot not found" });
      // Only the current owner may write the bible for their mascot.
      if (ownerWallet && rows[0].owner_wallet && rows[0].owner_wallet !== ownerWallet) {
        return res.status(403).json({ error: "You don't own this mascot." });
      }
      await sb(`mints?mint_address=eq.${encodeURIComponent(mintAddress)}`, {
        method: "PATCH",
        body: JSON.stringify({ character_notes: String(notes || "").slice(0, 12000) }),
      });
      return res.status(200).json({ ok: true });
    }

    if (action === "bible-get") {
      const { mints } = req.body;
      if (!Array.isArray(mints) || mints.length === 0) return res.status(200).json({ bibles: {} });
      const filter = `(${mints.map((m) => `"${m}"`).join(",")})`;
      const rows = await sb(`mints?mint_address=in.${encodeURIComponent(filter)}&select=mint_address,character_notes`, { method: "GET" });
      const bibles = {};
      (rows || []).forEach((r) => { if (r.character_notes) bibles[r.mint_address] = r.character_notes; });
      return res.status(200).json({ bibles });
    }

    if (action === "ecosystem") {
      // 📊 Public ecosystem stats — aggregated server-side; wallets only,
      // never emails. Folded in here to stay under Vercel's function limit.
      const FOUNDING_TARGET = 333;
      const PANTHEON = 12;
      // NOTE: no created_at / ordering here — the mints table doesn't carry a
      // timestamp column, and none of these figures depend on order.
      const rows = (await sb(
        `mints?select=character_name,rarity,card_tier,universe,element,traits,god_number,mark_number,marked_by,legendary_season,owner_wallet&limit=5000`,
        { method: "GET" }
      )) || [];
      const total = rows.length;
      const bucket = (key) => {
        const c = {};
        for (const r of rows) { const v = r[key] || "Unknown"; c[v] = (c[v] || 0) + 1; }
        return c;
      };
      const asList = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count, pct: total ? Math.round((count / total) * 1000) / 10 : 0 }));
      const tally = (pick) => {
        const c = {};
        for (const row of rows) {
          const vals = pick(row);
          if (!Array.isArray(vals)) continue;
          for (const v of vals) { if (v && typeof v === "string") c[v] = (c[v] || 0) + 1; }
        }
        return c;
      };
      const topN = (counts, n) => Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n)
        .map(([name, count]) => ({ name, count, pct: total ? Math.round((count / total) * 1000) / 10 : 0 }));
      // THE PANTHEON — all 12 seats, every one accounted for. Thrones listed in
      // SEALED_THRONES are occupied but their occupant is not public yet: the
      // name and realm are withheld SERVER-SIDE (never sent to the browser), so
      // the secret can't be read out of a network response. Everything the page
      // shows still reconciles: 12 seats, N occupied, M awaiting a claimant.
      const seated = {};
      for (const r of rows) if (r.god_number) seated[r.god_number] = r;
      const thrones = [];
      for (let i = 1; i <= PANTHEON; i++) {
        const r = seated[i];
        if (!r) {
          thrones.push({ n: i, status: "unclaimed" });
        } else if (SEALED_THRONES.includes(i)) {
          thrones.push({ n: i, status: "sealed" });
        } else {
          thrones.push({ n: i, status: "seated", name: r.character_name, universe: r.universe || null, element: r.element || null });
        }
      }
      // ---- THE AGES ---------------------------------------------------------
      // Every milestone the whitepaper promises, computed from the SAME live
      // mint count the rest of this page uses. Ages trigger on cumulative mints
      // ever created, so this never moves backwards when Fusion burns cards.
      // Adding a future age = one line in this array; the UI renders whatever
      // it finds, so nothing can silently go missing on reveal day.
      // Keys MUST match age_counters + open-pack's AGES — they're the join.
      // ⚠️ PUBLIC AGE LADDER. This drives every counter the WORLD can see, so
      // it deliberately stops at the Archangels — the Great War and everything
      // below it stay off this list until they are meant to be known. Keep the
      // milestones in step with AGES in api/open-pack.js, which is the one that
      // actually fires them: this list drifted to 10,000 for the Champions
      // after that file moved to 11,111, and the site quietly advertised the
      // wrong countdown.
      const AGES = [
        { key: "champion_s1", at: 11111, icon: "⚜️", name: "The Champions — Season 1", supply: 333, hp: 333,
          blurb: "The top 22 fighters + top 11 drivers are raised; 300 more release to all paid tiers at 1.5% per mint." },
        { key: "champion_s2", at: 33333, icon: "⚜️", name: "The Champions — Season 2", supply: 333, hp: 333,
          blurb: "The second cut. Both ladders reshuffle and 33 more names are written." },
        { key: "demon", at: 66666, icon: "😈", name: "The Demon Age", supply: 666, hp: 666,
          blurb: "The void answers with 666 demons at 2% per mint, each bearing a named void ability. What fell with Toro did not all stay down." },
        { key: "archangel", at: 111111, icon: "🕊️", name: "The Archangels", supply: 1111, hp: 777,
          blurb: "They come down the cosmic waterfall at 2% per mint. Heaven is rarer than what the void sent first." },
      ];
      // Live issuance per age (once the SQL is installed): claimed/cap from the
      // same atomic counters open-pack draws from — so "how many demons are
      // left" is always answerable, from launch day to the last card.
      let counters = {};
      try {
        const crows = (await sb(`age_counters?select=key,claimed,cap`, { method: "GET" })) || [];
        for (const c of crows) counters[c.key] = c;
      } catch (e) {}
      let champSeasons = {};
      try {
        const srows = (await sb(`champion_snapshot?select=season`, { method: "GET" })) || [];
        for (const s of srows) champSeasons[s.season] = (champSeasons[s.season] || 0) + 1;
      } catch (e) {}
      const ages = AGES.map((a) => {
        const c = counters[a.key];
        // Champions: counter starts at 33 (reserved cut) — show true issued.
        const reserved = a.key.startsWith("champion") ? 33 : 0;
        return {
          ...a,
          reached: total >= a.at,
          remaining: Math.max(0, a.at - total),
          pct: Math.min(100, Math.round((total / a.at) * 1000) / 10),
          issued: c ? Math.max(0, c.claimed - reserved) : null,
          cardCap: c ? c.cap : a.supply,
          snapshotTaken: a.key === "champion_s1" ? !!champSeasons[1] : a.key === "champion_s2" ? !!champSeasons[2] : null,
        };
      });
      const nextAge = ages.find((a) => !a.reached) || null;

      const seatedCount = thrones.filter((t) => t.status !== "unclaimed").length;
      const unclaimedCount = thrones.filter((t) => t.status === "unclaimed").length;
      const owners = new Set(rows.map((r) => r.owner_wallet).filter(Boolean));

      // ---- The Graveyard ----------------------------------------------------
      // Dormant 30+ days. Empyrion-born rest above the cosmic waterfall; the
      // four lower universes wait in Purgatory. Nobody is deleted, ever.
      const GRAVE_DAYS = 30;
      const graveCutoff = new Date(Date.now() - GRAVE_DAYS * 24 * 60 * 60 * 1000);
      const dormant = rows.filter((r) => r.last_active && new Date(r.last_active) < graveCutoff);
      const daysSince = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
      const graveyard = {
        total: dormant.length,
        atRest: dormant.filter((r) => r.universe === "Empyrion").length,
        // Anything not Empyrion-born waits in Purgatory — including the early
        // mints whose universe was never stamped.
        inPurgatory: dormant.filter((r) => r.universe !== "Empyrion").length,
        residents: dormant
          .sort((a, b) => new Date(a.last_active) - new Date(b.last_active))
          .slice(0, 24)
          .map((r) => ({
            name: r.character_name,
            universe: r.universe || null,
            rarity: r.rarity || null,
            days: daysSince(r.last_active),
            place: r.universe === "Empyrion" ? "At Rest" : "Purgatory",
            returns: r.resurrections || 0,
          })),
        returned: rows.filter((r) => (r.resurrections || 0) > 0).length,
      };
      let lb = [];
      // Top 33 — the Champion cut. At mint #10,000 these are the wallets that
      // receive the ⚜️ CHAMPION mints, so the full cut must be visible.
      try { lb = (await sb(`battle_ratings?select=wallet,rating,wins,losses&order=rating.desc&limit=33`, { method: "GET" })) || []; } catch (e) {}
      // The racing ladder runs its own Champion cut — a great fighter isn't
      // automatically a great driver, so both boards must be visible before
      // the Champions are raised or the selection rule can't be audited.
      let raceLb = [];
      try { raceLb = (await sb(`race_ratings?select=wallet,rating,wins,losses&order=rating.desc&limit=33`, { method: "GET" })) || []; } catch (e) {}
      let battleCount = 0;
      try {
        const r = await fetch(`${SB}/rest/v1/battles?select=id&limit=1`, { headers: { ...sbHeaders, Prefer: "count=exact", Range: "0-0" } });
        battleCount = parseInt((r.headers.get("content-range") || "").split("/")[1], 10) || 0;
      } catch (e) {}
      // 👥 Mirror Realm crossings — battles + races fought against one's own
      // doppelgangers. Zero until mirror-tracking.sql is run; never fatal.
      let mirrorCount = 0;
      try {
        const mb = await fetch(`${SB}/rest/v1/battles?select=id&mirror=is.true&limit=1`, { headers: { ...sbHeaders, Prefer: "count=exact", Range: "0-0" } });
        mirrorCount += parseInt((mb.headers.get("content-range") || "").split("/")[1], 10) || 0;
        const mr = await fetch(`${SB}/rest/v1/races?select=id&mirror=is.true&limit=1`, { headers: { ...sbHeaders, Prefer: "count=exact", Range: "0-0" } });
        mirrorCount += parseInt((mr.headers.get("content-range") || "").split("/")[1], 10) || 0;
      } catch (e) {}
      return res.status(200).json({
        totals: { mints: total, holders: owners.size, battles: battleCount, mirrors: mirrorCount, thronesSeated: seatedCount, thronesUnclaimed: unclaimedCount, thronesTotal: PANTHEON },
        founding: { target: FOUNDING_TARGET, claimed: Math.min(total, FOUNDING_TARGET), remaining: Math.max(0, FOUNDING_TARGET - total), complete: total >= FOUNDING_TARGET },
        // ✋ THE GOD-MARKED — 777 forever, rolled at 0.1% of paid mints. Unlike
        // the Founding this door stays open for years, which is the point: a
        // live chase that outlasts the launch.
        marked: (() => {
          const claimed = rows.filter((r) => r.mark_number).length;
          const byThrone = {};
          for (const r of rows) if (r.marked_by) byThrone[r.marked_by] = (byThrone[r.marked_by] || 0) + 1;
          return { target: 777, claimed, remaining: Math.max(0, 777 - claimed), complete: claimed >= 777, byThrone };
        })(),
        ages,
        nextAge,
        rarity: asList(bucket("rarity")),
        universes: asList(bucket("universe")),
        elements: asList(bucket("element")),
        archetypes: topN(tally((r) => (r.traits || {}).archetypes), 12),
        vibes: topN(tally((r) => (r.traits || {}).vibes), 10),
        worlds: topN(tally((r) => (r.traits || {}).worlds), 8),
        thrones,
        graveyard,
        leaderboard: lb.map((r) => ({ wallet: r.wallet, rating: r.rating, wins: r.wins, losses: r.losses })),
        raceLeaderboard: raceLb.map((r) => ({ wallet: r.wallet, rating: r.rating, wins: r.wins, losses: r.losses })),
      });
    }

    if (action === "verify-uri") {
      // Server-side storage verification for minting. The user's DEVICE often
      // can't reach the Irys gateway (mobile networks, filtered DNS) even when
      // the upload is perfectly fine — so OUR server does the checking. Mint
      // safety without punishing phones.
      const { urls } = req.body || {};
      if (!Array.isArray(urls) || urls.length === 0 || urls.length > 4) {
        return res.status(400).json({ error: "Send { urls: [1-4 urls] }" });
      }
      const checkOne = async (u) => {
        if (typeof u !== "string" || !u.startsWith("https://")) return false;
        for (let i = 0; i < 4; i++) {
          try {
            const r = await fetch(u, { cache: "no-store" });
            if (r.ok) return true;
          } catch (e) {}
          await new Promise((r2) => setTimeout(r2, 1500));
        }
        return false;
      };
      const results = await Promise.all(urls.map(checkOne));
      return res.status(200).json({ ok: results.every(Boolean), results });
    }

    if (action === "share-save") {
      // Publish a mascot's public snapshot. The id is either a random s_… token
      // OR the mascot's Solana MINT ADDRESS (43-44 base58 chars) — the old
      // 40-char cap silently rejected every MINTED mascot's share, so those
      // links 404'd to the home page. Cap is now 80.
      const { id, data } = req.body || {};
      if (!id || !data || typeof id !== "string" || id.length > 80) {
        return res.status(400).json({ error: "Bad share payload" });
      }
      // 🔐 A share id is either a random s_/r_ token — unguessable, so its own
      // entropy is the protection, and it must stay open because a share can
      // be created before any wallet exists — or a mascot's MINT ADDRESS,
      // which is stamped on the chain for all to read. In that second case an
      // ungated upsert let anyone repoint a minted mascot's public share page
      // at any name, bio and picture they liked: the exact page X and Discord
      // unfurl. So: if the id names a recorded mascot, prove you own it.
      if (!/^[sr]_/.test(String(id))) {
        const own = (await sb(
          `mints?mint_address=eq.${encodeURIComponent(id)}&select=owner_wallet`,
          { method: "GET" }
        )) || [];
        if (own.length) {
          const authErr = requireAuth(req.body.wallet, req.body.auth);
          if (authErr) return res.status(401).json({ error: authErr });
          const holder = String(own[0].owner_wallet || "");
          if (!isOwnerWallet(req.body.wallet) && (!holder || holder !== String(req.body.wallet))) {
            return res.status(403).json({ error: "That mascot isn't yours to share." });
          }
        }
      }
      const clean = {
        name: String(data.name || "").slice(0, 80),
        ticker: String(data.ticker || "").slice(0, 12),
        tagline: String(data.tagline || "").slice(0, 200),
        bio: String(data.bio || "").slice(0, 1200),
        image: typeof data.image === "string" ? data.image.slice(0, 500) : null,
        tier: String(data.tier || "").slice(0, 30),
        universe: data.universe ? String(data.universe).slice(0, 20) : null,
        element: data.element ? String(data.element).slice(0, 10) : null,
        stats: data.stats && typeof data.stats === "object"
          ? { power: +data.stats.power || 0, hp: +data.stats.hp || 0, speed: +data.stats.speed || 0, special: +data.stats.special || 0, battleHp: +data.stats.battleHp || 0 }
          : null,
        panels: Array.isArray(data.panels) ? data.panels.slice(0, 4).map((p) => String(p).slice(0, 600)) : [],
        mintAddress: data.mintAddress ? String(data.mintAddress).slice(0, 60) : null,
        owner: data.owner ? String(data.owner).slice(0, 60) : null,
      };
      // on_conflict=id makes the upsert work whether id is the table's PK or a
      // plain unique index — the old bare merge-duplicates threw a 500 when the
      // conflict target wasn't the PK, which the client never surfaced.
      try {
        await sb(`shared_mascots?on_conflict=id`, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ id, data: clean }),
        });
      } catch (e) {
        return res.status(502).json({ error: "Couldn't save the share page. If this persists, the shared_mascots table needs its id unique index (see share-fix.sql)." });
      }
      // 📖 The chapter count rides back so the share link can carry it as a
      // cache-buster (/s/<id>?v=N) — X caches a card per-URL for up to a week,
      // so a link that CHANGES when the story grows always scrapes fresh.
      let chapterCount = 0;
      if (clean.mintAddress) {
        try {
          const ch = (await sb(`published_chapters?mint_address=eq.${encodeURIComponent(clean.mintAddress)}&select=id`, { method: "GET" })) || [];
          chapterCount = ch.length;
        } catch (e) {}
      }
      return res.status(200).json({ ok: true, id, chapterCount });
    }

    // 📱 RESUME HANDOFF — a free-tier mascot lives only in the browser's
    // localStorage. When a wallet app opens its own in-app browser, that
    // storage is EMPTY and the mascot is stranded. resume-save parks the full
    // entry server-side under an unguessable r_ id; the wallet browser opens
    // /?resume=<id>, pulls it down, and the user mints the mascot they made.
    // No auth possible here BY DEFINITION — the whole point is the user has no
    // wallet connected yet. The id is 128 bits of random, which is the same
    // privacy model as an unlisted share link.
    if (action === "resume-save") {
      const { id, entry } = req.body || {};
      if (!id || typeof id !== "string" || !/^r_[a-z0-9]{8,40}$/i.test(id)) {
        return res.status(400).json({ error: "Bad resume id" });
      }
      if (!entry || typeof entry !== "object") return res.status(400).json({ error: "Nothing to hand off" });
      let blob;
      try { blob = JSON.stringify(entry); } catch (e) { return res.status(400).json({ error: "Bad entry" }); }
      if (blob.length > 2_000_000) {
        return res.status(413).json({ error: "This mascot's art is stored inside the browser and is too large to hand off. Generate the art again, then retry." });
      }
      try {
        await sb(`shared_mascots?on_conflict=id`, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ id, data: { __resume: true, entry: JSON.parse(blob) } }),
        });
      } catch (e) {
        return res.status(502).json({ error: "Couldn't park the mascot for handoff — try again." });
      }
      return res.status(200).json({ ok: true, id });
    }

    if (action === "mascot") {
      // Public profile fetch for a share link.
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "Need id" });
      const rows = (await sb(`shared_mascots?id=eq.${encodeURIComponent(id)}&select=data`, { method: "GET" })) || [];
      if (!rows[0]) return res.status(404).json({ error: "This mascot page doesn't exist (or was never shared)." });
      const mascot = rows[0].data || {};
      // 📱 Resume blobs are private handoffs, not public profiles — hand them
      // back verbatim and let the client decide (it only acts on ?resume=).
      if (mascot.__resume) return res.status(200).json({ mascot });
      // 🔄 LIVE OVERLAY — the share snapshot is frozen at the moment the Share
      // button was pressed. A mascot shared BEFORE minting (Seraphelle's case:
      // 4/5/5/6 Water preview) would show pre-mint stats forever while the
      // Studio shows the minted Legendary. If the mascot is minted, the mint
      // row is the truth: recompute tier/element/universe/stats from it.
      if (mascot.mintAddress) {
        try {
          const t = await sb(`mints?mint_address=eq.${encodeURIComponent(mascot.mintAddress)}&select=traits,card_tier,rarity,element,universe,image_url,marked_by,age_card,age_number,legendary_season,mint_number,token_address,token_url,token_telegram`, { method: "GET" });
          if (t && t[0]) {
            const row = t[0];
            if (row.token_address) {
              mascot.token = { address: row.token_address, url: row.token_url || null, telegram: row.token_telegram || null };
            }
            const tier = row.card_tier || row.rarity;
            if (tier) {
              const live = computeStats(
                { ...(row.traits || {}), characterName: mascot.name, element: row.element || undefined },
                tier, row.marked_by || null, row.age_card || null, row.age_number || null,
                !row.universe, // Genesis: minted with no universe
                tier === "Legendary" && row.mint_number >= 1 && row.mint_number <= 333 ? row.mint_number : null // ⚜️ Founder seat = mint number
              );
              mascot.tier = tier;
              mascot.universe = row.universe || mascot.universe || null;
              mascot.element = live.element ? live.element.id : (row.element || mascot.element || null);
              if (row.image_url) mascot.image = row.image_url;
              mascot.stats = { power: live.power, hp: live.hp, speed: live.speed, special: live.special, battleHp: live.hpPoints };
            }
          }
        } catch (e) {}
      }
      return res.status(200).json({ mascot });
    }

    // 🚀 GUIDED TOKEN LINK — the user launches their token THEMSELVES on
    // pump.fun; this only records the resulting address so their mascot page
    // can link to it. Owner-only, wallet-signed. MascotGen creates nothing.
    if (action === "token-link") {
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      const { wallet, mintAddress, tokenAddress, tokenUrl, tokenTelegram } = req.body;
      if (!wallet || !mintAddress) return res.status(400).json({ error: "wallet and mintAddress required" });
      const owned = await sb(`mints?mint_address=eq.${encodeURIComponent(mintAddress)}&select=owner_wallet`, { method: "GET" });
      if (!owned || !owned.length) return res.status(404).json({ error: "Mascot not found." });
      if (owned[0].owner_wallet && owned[0].owner_wallet !== wallet) {
        return res.status(403).json({ error: "You don't own this mascot." });
      }
      // Light validation: a Solana mint is base58, ~32-44 chars. We store what
      // the user pastes but keep it sane — never auto-launch, never custody.
      const addr = String(tokenAddress || "").trim().slice(0, 64);
      if (tokenAddress && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
        return res.status(400).json({ error: "That doesn't look like a Solana token address." });
      }
      const clean = (u, n) => { const s = String(u || "").trim().slice(0, n); return s || null; };
      await sb(`mints?mint_address=eq.${encodeURIComponent(mintAddress)}`, {
        method: "PATCH",
        body: JSON.stringify({
          token_address: addr || null,
          token_url: clean(tokenUrl, 200),
          token_telegram: clean(tokenTelegram, 200),
          token_linked_at: addr ? new Date().toISOString() : null,
        }),
      });
      return res.status(200).json({ ok: true });
    }

    // ------------------------------------------------------------------------
    // 📦 FOLDED IN from record-mint.js and wallet-mascots.js — same behavior,
    // same payloads, two fewer Vercel functions (the Hobby cap is 12 and we
    // were sitting at it). None of these carry wallet-signature auth, exactly
    // as before: record-mint fires mid-mint-pipeline before auth exists, and
    // wallet-sync's proof of ownership IS the token list the wallet holds.
    // ------------------------------------------------------------------------

    // Records a completed mint — including the FULL character data
    // (result_data) so wallet-sync can restore a mascot COMPLETELY anywhere.
    if (action === "record-mint") {
      const {
        mintAddress, characterName, tokenName, ticker, ownerWallet, traits,
        tier, rarity, element, legendarySeason, universe, godNumber,
        markNumber, markedBy, ageCard, ageNumber, imageUrl, resultData,
      } = req.body || {};
      if (!mintAddress || !characterName) {
        return res.status(400).json({ error: "Missing mintAddress or characterName" });
      }
      // 🔐 THE FORGERY GATE. Unprotected, this endpoint let anyone INSERT rows
      // into `mints` — fake mascots appearing in the Market and the gallery
      // with any name, tier, art or God number the sender fancied, credited to
      // any wallet they liked. The chain would say nothing of the sort, but
      // the site reads this table, so the site would show the lie. Whoever the
      // mint is recorded to must prove they hold that wallet.
      if (!ownerWallet) return res.status(400).json({ error: "Missing ownerWallet" });
      {
        const authErr = requireAuth(ownerWallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      // ...and proving you hold YOUR wallet is not the same as owning THIS
      // mascot. The insert below upserts on mint_address, so without this a
      // signed-in stranger could overwrite an existing card's name, art, tier
      // and owner simply by re-recording its mint. An unclaimed row (no owner)
      // stays writable — that's the path wallet-sync's chain recovery uses to
      // adopt a mascot the database never recorded.
      {
        const prior = (await sb(
          `mints?mint_address=eq.${encodeURIComponent(mintAddress)}&select=owner_wallet`,
          { method: "GET" }
        )) || [];
        const holder = prior.length ? String(prior[0].owner_wallet || "") : "";
        if (holder && holder !== String(ownerWallet) && !isOwnerWallet(ownerWallet)) {
          return res.status(403).json({ error: "That mint is already recorded to another wallet." });
        }
      }
      await sb(`mints`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify([{
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
        }]),
      });
      return res.status(200).json({ ok: true });
    }

    // The REBUILD PROFILE repair path — re-attach restored character text to
    // a minted mascot's row.
    if (action === "update-profile") {
      const { mintAddress, resultData, imageUrl, wallet } = req.body || {};
      if (!mintAddress || !resultData) return res.status(400).json({ error: "Missing mintAddress or resultData" });
      // 🔐 Rewriting a mascot's name, bio and picture is precisely what a
      // defacer would reach for — and this is the one endpoint that can do it
      // to a card that is already minted and listed. Prove the wallet, then
      // prove the card is yours. The studio keeps an override so it can still
      // repair someone's broken record on request.
      {
        const authErr = requireAuth(wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
        if (!isOwnerWallet(wallet)) {
          const own = (await sb(
            `mints?mint_address=eq.${encodeURIComponent(mintAddress)}&select=owner_wallet`,
            { method: "GET" }
          )) || [];
          const minter = own.length ? String(own[0].owner_wallet || "") : "";
          // FAIL CLOSED. A missing row or a null owner_wallet must not read as
          // "no objection" — that would let any signed wallet rewrite an
          // ownerless card. No proven owner, no edit.
          if (!minter || minter !== String(wallet)) {
            return res.status(403).json({ error: "That mascot isn't yours to edit." });
          }
        }
      }
      const payload = { result_data: resultData };
      if (imageUrl) payload.image_url = imageUrl;
      const rows = await sb(`mints?mint_address=eq.${encodeURIComponent(mintAddress)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
      return res.status(200).json({ updated: Array.isArray(rows) ? rows.length : 0 });
    }

    // 🔗 THE IMAGE TIME BOMB — part one: which mascots are still living on a
    // temporary art host? Most rows were written with the fal.ai URL the art
    // was generated at, and fal expires files. The NFTs are fine (their
    // on-chain metadata points at permanent Arweave storage), but this table
    // is what the Market, the gallery and every share card read — so when fal
    // expires, the SITE goes blank even though the assets are intact.
    // Returns only what's already public on the gallery: address and name.
    if (action === "stale-images") {
      const rows = (await sb(`mints?select=mint_address,character_name,image_url&limit=5000`, { method: "GET" })) || [];
      const stale = rows
        .filter((r) => !String(r.image_url || "").startsWith("https://gateway.irys.xyz/"))
        .map((r) => ({ mint: r.mint_address, name: r.character_name || "", image: r.image_url || null }));
      return res.status(200).json({ stale, total: rows.length });
    }

    // 🔗 Part two: point one mascot's row at its PERMANENT image.
    //
    // Two deliberate guards, because this endpoint is unauthenticated like the
    // rest of the file and an image URL is exactly the sort of thing a griefer
    // would love to rewrite:
    //   1. The URL must be a permanent Irys gateway address, so nobody can
    //      aim a card at arbitrary content on the open web.
    //   2. A row that's ALREADY permanent is never overwritten. So this is a
    //      one-way ratchet: every card it fixes is locked afterwards, and once
    //      the backfill has been run there is nothing left to hijack.
    if (action === "backfill-image") {
      const { mintAddress, imageUrl } = req.body || {};
      if (!mintAddress || !imageUrl) return res.status(400).json({ error: "Missing mintAddress or imageUrl" });
      // 🔐 STUDIO ONLY. This one rewrites other people's cards by design, so
      // the URL validation and the never-overwrite-a-permanent-row ratchet are
      // no longer the only things standing in the way — the caller must be a
      // signed-in studio wallet. Fails closed: with DEV_WALLETS unset in
      // Vercel, nobody passes, including Xavier.
      {
        const authErr = requireAuth(req.body.wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
        if (!isOwnerWallet(req.body.wallet)) {
          return res.status(403).json({ error: "Studio wallets only." });
        }
      }
      if (!/^https:\/\/gateway\.irys\.xyz\/[A-Za-z0-9_-]{20,}$/.test(String(imageUrl))) {
        return res.status(400).json({ error: "imageUrl must be a permanent gateway.irys.xyz URL" });
      }
      const key = encodeURIComponent(mintAddress);
      const cur = (await sb(`mints?mint_address=eq.${key}&select=mint_address,image_url`, { method: "GET" })) || [];
      if (!cur.length) return res.status(200).json({ updated: 0, missing: true });
      if (String(cur[0].image_url || "").startsWith("https://gateway.irys.xyz/")) {
        return res.status(200).json({ updated: 0, skipped: true });
      }
      const rows = await sb(`mints?mint_address=eq.${key}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ image_url: imageUrl }),
      });
      return res.status(200).json({ updated: Array.isArray(rows) ? rows.length : 0 });
    }

    // Mark a pending pack roll as spent, the moment its NFT lands on-chain.
    if (action === "close-pending") {
      const { pendingId, mintAddress } = req.body || {};
      if (!pendingId || !mintAddress) return res.status(400).json({ error: "Missing pendingId or mintAddress" });
      // 🔐 A pack roll is the rarest thing in the system — a Legendary seat or
      // a God-Mark, spendable exactly once. Anyone who learned a pendingId
      // could otherwise burn someone else's roll by marking it minted against
      // an unrelated NFT. Only the wallet that opened the pack may close it.
      {
        const own = (await sb(
          `pending_mints?id=eq.${encodeURIComponent(pendingId)}&select=owner_wallet`,
          { method: "GET" }
        )) || [];
        if (!own.length) return res.status(200).json({ updated: 0 });
        const authErr = requireAuth(own[0].owner_wallet, req.body.auth);
        if (authErr) return res.status(401).json({ error: authErr });
      }
      const rows = await sb(`pending_mints?id=eq.${encodeURIComponent(pendingId)}&status=eq.unminted`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "minted", mint_address: mintAddress, minted_at: new Date().toISOString() }),
      });
      return res.status(200).json({ updated: Array.isArray(rows) ? rows.length : 0 });
    }

    // Wallet Sync — the ownership bridge. The frontend scans the connected
    // wallet's token accounts and sends the mint addresses; we return the full
    // mascot record for every match — including mascots the wallet received
    // via trade and never minted itself. Ownership = the wallet holds it.
    if (action === "wallet-sync") {
      const { mints } = req.body || {};
      if (!Array.isArray(mints) || mints.length === 0) {
        return res.status(400).json({ error: "Send { mints: [addresses] }" });
      }
      const list = mints.slice(0, 500).filter((m) => typeof m === "string" && m.length > 20);
      if (list.length === 0) return res.status(200).json({ mascots: [] });
      const filter = `(${list.map((m) => `"${m}"`).join(",")})`;
      const rows = (await sb(`mints?mint_address=in.${encodeURIComponent(filter)}&select=*`, { method: "GET" })) || [];
      const mascots = rows.map((row) => ({
        mintAddress: row.mint_address,
        characterName: row.character_name,
        tokenName: row.token_name,
        ticker: row.ticker,
        traits: row.traits || null,
        tier: row.card_tier || row.tier || row.rarity || null,
        element: row.element || null,
        legendarySeason: row.legendary_season || null,
        mintNumber: row.mint_number || null,
        universe: row.universe || null,
        godNumber: row.god_number || null,
        markNumber: row.mark_number || null,
        markedBy: row.marked_by || null,
        ageCard: row.age_card || null,
        ageNumber: row.age_number || null,
        tokenAddress: row.token_address || null,
        tokenUrl: row.token_url || null,
        tokenTelegram: row.token_telegram || null,
        imageUrl: row.image_url || null,
        resultData: row.result_data || null,
        mintedAt: row.created_at || null,
      }));
      return res.status(200).json({ mascots });
    }

    if (action === "gallery") {
      // 🏪 The Market gallery — every minted mascot in the Pentaverse, public
      // by design. Wallets are truncated client-side; emails never appear.
      const rows = (await sb(
        `mints?select=mint_address,character_name,image_url,rarity,card_tier,universe,element,god_number,mark_number,marked_by,owner_wallet,resurrections,legendary_season,traits,age_card,age_number,mint_number&limit=2000`,
        { method: "GET" }
      )) || [];
      // 📖 Which of these mascots have a published saga, and under whose name.
      // Two small queries beat 2,000 joins: every published chapter's
      // (mint, wallet) pair, then the usernames for those wallets.
      const sagaOf = {};
      try {
        const pub = (await sb(`published_chapters?select=mint_address,wallet&limit=5000`, { method: "GET" })) || [];
        const pw = [...new Set(pub.map((p) => p.wallet).filter(Boolean))];
        const uname = {};
        if (pw.length) {
          const pf = `(${pw.map((w) => `"${w}"`).join(",")})`;
          const profs = (await sb(`profiles?wallet=in.${encodeURIComponent(pf)}&select=wallet,username`, { method: "GET" })) || [];
          for (const p of profs) uname[p.wallet] = p.username;
        }
        for (const p of pub) {
          if (!p.mint_address) continue;
          const u = uname[p.wallet];
          if (!u) continue;
          if (!sagaOf[p.mint_address]) sagaOf[p.mint_address] = { author: u, chapters: 0 };
          sagaOf[p.mint_address].chapters++;
        }
      } catch (e) {}
      return res.status(200).json({
        items: rows.map((r) => {
          if (r.god_number && SEALED_THRONES.includes(r.god_number)) {
            // The sealed throne walks the market as a rumor, not a listing.
            return { sealed: true, god: true, tier: "Super Legendary" };
          }
          return {
            mint: r.mint_address,
            name: r.character_name,
            image: r.image_url || null,
            tier: r.rarity || r.card_tier || "Common",
            universe: r.universe || null,
            element: r.element || null,
            god: !!r.god_number,
            markNumber: r.mark_number || null,
            markedBy: r.marked_by || null,
            owner: r.owner_wallet || null,
            returns: r.resurrections || 0,
            season: r.legendary_season || null,
            author: (sagaOf[r.mint_address] || {}).author || null,
            chapters: (sagaOf[r.mint_address] || {}).chapters || 0,
            // 🃏 Full battle-card view: the client recomputes live stats from
            // these with the same computeStats the arena uses.
            traits: r.traits || null,
            ageCard: r.age_card || null,
            ageNumber: r.age_number || null,
            mintNumber: r.mint_number || null,
          };
        }),
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
