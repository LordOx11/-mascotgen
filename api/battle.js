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
    row.card_tier || row.rarity || null
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
// driver. Same +25/-25 economics, no cash value, resettable each season.
async function bumpRaceRating(wallet, won) {
  const rows = await sb(`race_ratings?wallet=eq.${encodeURIComponent(wallet)}&select=*`, { method: "GET" });
  const cur = (rows && rows[0]) || { wallet, rating: 1000, wins: 0, losses: 0 };
  await sb(`race_ratings`, {
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



    if (action === "race") {
      // 🏁 THE GRAND CIRCUIT — same squad-picking model as battles.
      const { challengerWallet, teamMints, opponentWallet } = req.body;
      if (!challengerWallet || !Array.isArray(teamMints) || teamMints.length < 1 || teamMints.length > 3) {
        return res.status(400).json({ error: "Send challengerWallet and 1-3 teamMints." });
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
        if (all && all.length > 0) {
          const wallets = [...new Set(all.map((r) => r.owner_wallet).filter(Boolean))];
          oppWallet = wallets[Math.floor(Math.random() * wallets.length)] || "the-void";
          oppRows = all.filter((r) => r.owner_wallet === oppWallet);
          if (oppRows.length === 0) oppRows = all;
        } else {
          // 🪞 Mirror grid — the void fields your own reflections. No rating.
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
          }]),
        });
      } catch (e) {}
      if (!mirror) {
        try {
          newRating = await bumpRaceRating(challengerWallet, winner === "challenger");
          await bumpRaceRating(oppWallet, winner === "opponent");
        } catch (e) {}
      } else {
        log.push("🪞 Mirror grid — no rating at stake against your own reflection.");
        events.push({ text: "🪞 Mirror grid — no rating at stake against your own reflection.", t: "info" });
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



    // ================= 📖 PUBLISHING (Session A) =================
    if (action === "profile-claim") {
      const { wallet, username, avatarMint } = req.body;
      if (!wallet || !username) return res.status(400).json({ error: "wallet and username required" });
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
      return res.status(200).json({
        chapters: rows.map((r) => {
          const m = mascots[r.mint_address] || {};
          return {
            id: r.id,
            mintAddress: r.mint_address,
            character: r.character_name,
            arc: r.arc_name,
            chapterNo: r.chapter_no,
            title: r.title,
            preview: Array.isArray(r.panels) && r.panels[0] ? String(r.panels[0]).slice(0, 220) : "",
            panelCount: Array.isArray(r.panels) ? r.panels.length : 0,
            publishedAt: r.published_at,
            author: nameOf[r.wallet] || null,
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

    if (action === "bible-save") {
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
      let battleCount = 0;
      try {
        const r = await fetch(`${SB}/rest/v1/battles?select=id&limit=1`, { headers: { ...sbHeaders, Prefer: "count=exact", Range: "0-0" } });
        battleCount = parseInt((r.headers.get("content-range") || "").split("/")[1], 10) || 0;
      } catch (e) {}
      return res.status(200).json({
        totals: { mints: total, holders: owners.size, battles: battleCount, thronesSeated: seatedCount, thronesUnclaimed: unclaimedCount, thronesTotal: PANTHEON },
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
        rarity: asList(bucket("rarity")),
        universes: asList(bucket("universe")),
        elements: asList(bucket("element")),
        archetypes: topN(tally((r) => (r.traits || {}).archetypes), 12),
        vibes: topN(tally((r) => (r.traits || {}).vibes), 10),
        worlds: topN(tally((r) => (r.traits || {}).worlds), 8),
        thrones,
        graveyard,
        leaderboard: lb.map((r) => ({ wallet: r.wallet, rating: r.rating, wins: r.wins, losses: r.losses })),
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
      // Publish a mascot's public snapshot. The id comes from the client
      // (random); payload is capped and sanitized to displayable fields only.
      const { id, data } = req.body || {};
      if (!id || !data || typeof id !== "string" || id.length > 40) {
        return res.status(400).json({ error: "Bad share payload" });
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
      await sb(`shared_mascots`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ id, data: clean }),
      });
      return res.status(200).json({ ok: true, id });
    }

    if (action === "mascot") {
      // Public profile fetch for a share link.
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "Need id" });
      const rows = (await sb(`shared_mascots?id=eq.${encodeURIComponent(id)}&select=data`, { method: "GET" })) || [];
      if (!rows[0]) return res.status(404).json({ error: "This mascot page doesn't exist (or was never shared)." });
      return res.status(200).json({ mascot: rows[0].data });
    }

    if (action === "gallery") {
      // 🏪 The Market gallery — every minted mascot in the Pentaverse, public
      // by design. Wallets are truncated client-side; emails never appear.
      const rows = (await sb(
        `mints?select=mint_address,character_name,image_url,rarity,card_tier,universe,element,god_number,mark_number,marked_by,owner_wallet,resurrections,legendary_season&limit=2000`,
        { method: "GET" }
      )) || [];
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
          };
        }),
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
