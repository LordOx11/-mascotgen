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

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const sbHeaders = {
  "Content-Type": "application/json",
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
};

async function sb(path, options = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    ...options,
    headers: { ...sbHeaders, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${path.split("?")[0]} failed: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const BEATS = { Fire: "Earth", Earth: "Air", Air: "Water", Water: "Fire" };

function makeFighter(row) {
  const traits = row.traits || {};
  const stats = computeStats(
    { ...traits, characterName: row.character_name, element: row.element || undefined },
    row.card_tier || row.rarity || null
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
    used: {}, // once-per-battle trackers
    hitsTaken: 0,
    momentum: 0,
  };
}

const has = (f, id) => (f.abilities || []).some((a) => a.id === id || a.kind === id);
const god = (f, name) => f.isGod && f.name === name;

// Event recorder: every log line gets a structured twin the stage can animate.
function makeRec() {
  const events = [];
  const rec = (text, ev) => events.push({ text, ...(ev || { t: "info" }) });
  return { events, rec };
}

function elemMult(att, def) {
  if (BEATS[att.element] === def.element) return 1.25;
  if (BEATS[def.element] === att.element) return 0.8;
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
  // Reflect (once): bounce a big hit back.
  if (!def.used.reflect && has(def, "reflect") && dmg >= 55 && !god(att, "Seraphine Valdur")) {
    def.used.reflect = true;
    att.hp -= dmg;
    rec(`🪞 ${def.name} REFLECTS the attack — ${dmg} damage bounces back at ${att.name}!`, { t: "reflect", attacker: att.name, target: def.name, dmg, hpAfter: Math.max(0, att.hp) });
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

async function bumpRating(wallet, won) {
  const rows = await sb(`battle_ratings?wallet=eq.${encodeURIComponent(wallet)}&select=*`, { method: "GET" });
  const cur = rows && rows[0] ? rows[0] : { rating: 1000, wins: 0, losses: 0 };
  await sb(`battle_ratings`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      wallet,
      rating: Math.max(0, cur.rating + (won ? 25 : -25)),
      wins: cur.wins + (won ? 1 : 0),
      losses: cur.losses + (won ? 0 : 1),
      updated_at: new Date().toISOString(),
    }),
  });
  return cur.rating + (won ? 25 : -25);
}

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
        if (all && all.length > 0) {
          const wallets = [...new Set(all.map((r) => r.owner_wallet).filter(Boolean))];
          oppWallet = wallets[Math.floor(Math.random() * wallets.length)] || "the-void";
          oppRows = all.filter((r) => r.owner_wallet === oppWallet);
          if (oppRows.length === 0) oppRows = all;
        } else {
          // 🪞 MIRROR REALM — no other wallets exist yet, so the void answers
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
      const shortB = mirror ? "🪞 THE MIRROR REALM" : `${oppWallet.slice(0, 4)}..${oppWallet.slice(-4)}`;
      const { winner, events, log } = simulate(teamA, teamB, shortA, shortB);
      const displayTeam = (t) => t.map((f) => ({ name: f.name, tier: f.tier, element: f.element, maxHp: f.maxHp, image: f.image, isGod: f.isGod }));

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
          },
        ]),
      });
      let newRating = null;
      if (!mirror) {
        newRating = await bumpRating(challengerWallet, winner === "challenger");
        await bumpRating(oppWallet, winner === "opponent");
      }

      if (mirror) {
        log.push("🪞 Mirror match — no rating at stake against your own reflection.");
        events.push({ text: "🪞 Mirror match — no rating at stake against your own reflection.", t: "info" });
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


    if (action === "ecosystem") {
      // 📊 Public ecosystem stats — aggregated server-side; wallets only,
      // never emails. Folded in here to stay under Vercel's function limit.
      const FOUNDING_TARGET = 111;
      const PANTHEON = 12;
      // NOTE: no created_at / ordering here — the mints table doesn't carry a
      // timestamp column, and none of these figures depend on order.
      const rows = (await sb(
        `mints?select=character_name,rarity,card_tier,universe,element,traits,god_number,legendary_season,owner_wallet&limit=5000`,
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
      const SEALED_THRONES = [12]; // Aurelia — revealed when the story says so
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
      const seatedCount = thrones.filter((t) => t.status !== "unclaimed").length;
      const unclaimedCount = thrones.filter((t) => t.status === "unclaimed").length;
      const owners = new Set(rows.map((r) => r.owner_wallet).filter(Boolean));
      let lb = [];
      try { lb = (await sb(`battle_ratings?select=wallet,rating,wins,losses&order=rating.desc&limit=10`, { method: "GET" })) || []; } catch (e) {}
      let battleCount = 0;
      try {
        const r = await fetch(`${SB}/rest/v1/battles?select=id&limit=1`, { headers: { ...sbHeaders, Prefer: "count=exact", Range: "0-0" } });
        battleCount = parseInt((r.headers.get("content-range") || "").split("/")[1], 10) || 0;
      } catch (e) {}
      return res.status(200).json({
        totals: { mints: total, holders: owners.size, battles: battleCount, thronesSeated: seatedCount, thronesUnclaimed: unclaimedCount, thronesTotal: PANTHEON },
        founding: { target: FOUNDING_TARGET, claimed: Math.min(total, FOUNDING_TARGET), remaining: Math.max(0, FOUNDING_TARGET - total), complete: total >= FOUNDING_TARGET },
        rarity: asList(bucket("rarity")),
        universes: asList(bucket("universe")),
        elements: asList(bucket("element")),
        archetypes: topN(tally((r) => (r.traits || {}).archetypes), 12),
        vibes: topN(tally((r) => (r.traits || {}).vibes), 10),
        worlds: topN(tally((r) => (r.traits || {}).worlds), 8),
        thrones,
        leaderboard: lb.map((r) => ({ wallet: r.wallet, rating: r.rating, wins: r.wins, losses: r.losses })),
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
