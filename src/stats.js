// stats.js — the MascotGen battle stat engine.
//
// Core principle: stats are DETERMINISTIC. The same character (same traits)
// always produces the exact same BASE stats. Nothing random at battle time —
// this makes the game fair, verifiable, and impossible to manipulate after
// minting. The stats are baked into the NFT metadata, so what you mint is
// what you play.
//
// IMPORTANT (rarity refactor): Card TIER is NO LONGER derived from traits.
// Tier (Common/Rare/Epic/Legendary) is assigned by a mint-time RARITY ROLL
// (see api rarity engine) and passed INTO computeStats(). This closes the
// loophole where a player with all attributes unlocked could stack high-stat
// traits to manufacture a Legendary. Nobody can build or buy a tier — it is
// rolled. Tier then applies a stat BONUS on top of the trait-derived base,
// so pulling Legendary genuinely makes the card stronger.
//
// Every trait contributes to a 1-7 rating in four stats:
//   POWER   — attack strength
//   HP      — health / durability
//   SPEED   — turn order + dodge chance
//   SPECIAL — special-ability strength (also unlocks the character's signature move)

// ---- Per-category stat contributions -------------------------------------
// Each trait maps to [power, hp, speed, special] points. Kept readable so you
// can hand-tune any single trait's feel later without touching the engine.

const ARCHETYPE_STATS = {
  // Common — balanced, modest
  Animal: [2, 2, 2, 1], Dog: [2, 2, 3, 1], Cat: [2, 1, 3, 2], Frog: [1, 2, 3, 1],
  Bear: [3, 3, 1, 1], Hamster: [1, 1, 3, 1], Penguin: [1, 2, 2, 1], Food: [1, 3, 1, 2],
  Plant: [1, 3, 1, 2], Object: [2, 2, 1, 2], "Human-like": [2, 2, 2, 2],
  Bird: [2, 1, 4, 1], Fish: [1, 2, 3, 1], Rabbit: [1, 2, 4, 1], Mouse: [1, 1, 4, 1],
  Baby: [1, 2, 3, 4],
  // Rare — stronger
  Ape: [4, 3, 2, 1], Creature: [3, 3, 2, 3], Robot: [3, 3, 1, 3], Insect: [2, 2, 4, 2], Blob: [2, 4, 1, 3],
  Dragon: [5, 4, 3, 4], Dino: [4, 4, 2, 1], Slime: [1, 5, 1, 3],
  // Alpha — top tier
  Bull: [5, 4, 2, 2], Ghost: [2, 3, 4, 5], Zombie: [3, 5, 1, 3], Alien: [3, 3, 3, 5], Fighter: [5, 4, 3, 2],
  Demon: [5, 3, 3, 4], Angel: [3, 4, 3, 5],
};

const VIBE_STATS = {
  Degen: [3, 1, 3, 1], Wholesome: [1, 3, 1, 2], Chaotic: [3, 2, 3, 1], Heroic: [3, 3, 2, 2],
  Comedic: [1, 2, 3, 2], Corporate: [2, 3, 1, 2], Zen: [1, 3, 2, 3], Lovestruck: [1, 2, 2, 2],
  Flirty: [1, 1, 3, 2], FOMO: [2, 1, 4, 1], Sarcastic: [2, 2, 2, 2], Clumsy: [1, 2, 1, 1],
  Cocky: [3, 2, 2, 1], Sleepy: [1, 3, 1, 2], Hyper: [2, 1, 4, 1], Grumpy: [3, 3, 1, 1], Curious: [1, 2, 3, 2],
  Mysterious: [2, 2, 3, 4], Villainous: [4, 2, 2, 3], Feral: [4, 3, 3, 1], Royal: [2, 3, 2, 4],
  Unhinged: [4, 2, 3, 2], "Sad Boi / Melancholy": [2, 4, 1, 3],
  Vengeful: [4, 3, 2, 2], Enlightened: [1, 3, 2, 5], Rebellious: [3, 2, 3, 2],
  Superpowers: [4, 3, 3, 5], Genius: [2, 3, 3, 5], Brawler: [5, 4, 2, 2], Immortal: [3, 5, 2, 4],
};

const WORLD_STATS = {
  Space: [2, 2, 3, 3], Fantasy: [3, 2, 2, 3], "Street Culture": [3, 2, 3, 1], "Corporate Satire": [2, 3, 1, 2],
  Ocean: [2, 3, 2, 2], Jungle: [3, 3, 2, 1], Cyberpunk: [3, 2, 3, 3], "Wild West": [3, 2, 3, 1],
  "Retro Arcade": [2, 2, 3, 2], "Gym / Fitness": [4, 3, 2, 1], "Beach Paradise": [1, 3, 2, 1], City: [2, 2, 3, 1],
  Island: [1, 3, 2, 1], Boat: [2, 2, 2, 1], Casino: [2, 2, 2, 3], Mountain: [3, 4, 1, 1],
  Pyramids: [2, 3, 1, 3], Zoo: [2, 2, 2, 1], Restaurant: [1, 2, 2, 1], Mall: [1, 2, 3, 1],
  Airport: [1, 2, 3, 1], Desert: [3, 3, 1, 1], Forest: [2, 3, 2, 2], Stadium: [3, 2, 3, 1],
  Farm: [2, 3, 1, 1], "Snow Peaks": [3, 4, 1, 2], Volcano: [4, 3, 2, 2], Swamp: [3, 3, 2, 2],
  Racetrack: [2, 2, 4, 1], Nightclub: [2, 2, 3, 2],
  "Heaven & Clouds": [2, 3, 3, 4], "Haunted Mansion": [3, 2, 2, 4], "Las Vegas": [3, 2, 3, 3],
  "Circus / Carnival": [2, 2, 3, 3], "Post-Apocalyptic": [4, 3, 2, 2], Underworld: [4, 3, 2, 3],
  "Ancient Ruins": [3, 3, 2, 3], "Floating City": [2, 3, 3, 4], Dreamscape: [2, 2, 3, 5],
  "Boxing Ring": [5, 4, 3, 1], "Octagon Ring": [5, 4, 3, 2], "The Moon": [3, 3, 4, 4], "Mars Colony": [3, 4, 3, 4],
};

const COLOR_STATS = {
  "Neon Green": [2, 1, 3, 1], "Hot Pink": [2, 1, 2, 2], "Deep Purple": [2, 2, 1, 3], Cyan: [1, 2, 3, 2],
  "Blood Red": [4, 2, 2, 1], "Electric Blue": [2, 2, 3, 2], "Toxic Orange": [3, 2, 2, 2], "Black & White": [2, 2, 2, 1],
  Lavender: [1, 2, 2, 2], Mint: [1, 3, 2, 1],
  "Sunset Orange": [3, 2, 2, 1], "Forest Green": [2, 3, 2, 1], Crimson: [4, 2, 2, 1], "Sky Blue": [1, 2, 3, 2],
  Rainbow: [2, 2, 2, 4], "Chrome Silver": [3, 3, 2, 2], Bubblegum: [2, 2, 3, 2], "Midnight Blue": [2, 3, 2, 3], "Acid Yellow": [3, 1, 4, 1],
  Holographic: [2, 2, 3, 4], Galaxy: [3, 3, 2, 4], "Rose Gold": [3, 3, 2, 3],
  Gold: [4, 4, 2, 3], Platinum: [4, 5, 2, 4], Diamond: [5, 5, 3, 4],
};

const ACCESSORY_STATS = {
  "Wif Hat (Knit Beanie)": [1, 1, 1, 1], "Long Lashes": [0, 1, 1, 1], "Glam Nails": [1, 0, 1, 1],
  "Long Flowing Hair": [0, 1, 2, 1], "Designer Purse": [0, 1, 0, 2], Earrings: [0, 1, 1, 1],
  "Basic Sneakers": [0, 0, 2, 0], Sunglasses: [1, 1, 1, 1], Chain: [1, 2, 0, 1], Cape: [1, 1, 2, 2],
  Headphones: [0, 1, 2, 1], Axe: [3, 1, 1, 0], Halo: [0, 2, 1, 3], "Devil Horns": [3, 1, 1, 2],
  "Cowboy Hat": [2, 1, 1, 1], Sweater: [0, 2, 0, 1], Shorts: [0, 0, 2, 0],
  Scarf: [0, 2, 1, 1], Backpack: [0, 2, 1, 1], Wristband: [1, 1, 1, 0], Bandana: [1, 1, 2, 1], "Face Mask": [1, 1, 2, 2], Flute: [0, 1, 1, 2], "Bamboo Hand Fan": [0, 2, 1, 1], Jersey: [1, 1, 1, 0], Stereo: [1, 1, 0, 2], "Baseball Hat": [1, 1, 1, 0],
  "Laser Eyes": [4, 0, 1, 3], "Diamond Hands": [2, 4, 0, 2], Umbrella: [1, 3, 1, 2], Rolex: [1, 2, 1, 3],
  Harp: [0, 2, 1, 4], Sword: [4, 1, 2, 1], Katana: [4, 1, 3, 1], Crown: [2, 3, 1, 3], Cigar: [2, 2, 1, 2],
  Jetpack: [1, 1, 5, 2], "Baseball Bat": [4, 1, 2, 0], "Bow & Arrow": [3, 0, 3, 3], Shield: [1, 4, 0, 2],
  "Meme Corps Armor": [3, 4, 2, 3], "MMA Gloves": [5, 2, 4, 1], "Cyber Visor": [3, 2, 3, 4], "Hype Kicks": [1, 1, 5, 1],
  Guitar: [2, 2, 2, 3], Lollipop: [1, 2, 2, 3], Gun: [5, 1, 3, 2], "Boxing Gloves": [5, 3, 3, 1],
  "Flaming Sword": [5, 2, 3, 4], "Angel Wings": [2, 3, 4, 4],
};

const AURA_STATS = {
  None: [0, 0, 0, 0],
  "Dragon Aura": [4, 3, 2, 4],
  "Ultimate Aura": [4, 4, 3, 5],
  "Blessed Aura": [3, 5, 2, 5],
};

// Signature moves — unlocked by the character's highest-contributing trait area.
// Purely flavor + a small mechanical hook the battle system can read later.
const SIGNATURE_MOVES = {
  power: { name: "Overpower", desc: "A crushing strike scaled by Power." },
  hp: { name: "Iron Will", desc: "Shrug off damage and heal a portion of HP." },
  speed: { name: "Blitz", desc: "Strike first and gain an extra action." },
  special: { name: "Signature Burst", desc: "Unleash the character's unique special energy." },
};

// ---- Ability system --------------------------------------------------------
// Every mascot gets 2 SIGNATURE abilities (from the common pool). Rare+ tiers
// add extra abilities from the rare pool. Legendary has a 33% chance of one
// SUPER-RARE effect. Which specific abilities a mascot gets is DETERMINISTIC —
// derived from a hash of its identity — so the same mascot always shows the
// same kit, but different mascots differ.

// Common effects — the pool every mascot's 2 signatures are drawn from.
// value is a damage/heal/shield magnitude BEFORE per-character scaling.
const COMMON_EFFECTS = [
  { id: "burst",  name: "Burst",     icon: "⚡", kind: "damage", base: 70, desc: "High direct damage." },
  { id: "shield", name: "Iron Wall", icon: "🛡", kind: "shield", base: 40, desc: "Blocks the next incoming attack." },
  { id: "heal",   name: "Mend",      icon: "💚", kind: "heal",   base: 35, desc: "Restores HP." },
  { id: "drain",  name: "Sap",       icon: "🌀", kind: "drain",  base: 2,  desc: "Cuts opponent's Power for 2 turns." },
  { id: "stun",   name: "Stun",      icon: "⏭", kind: "stun",   base: 1,  desc: "Opponent loses their next turn." },
];

// Rare effects — Rare tier and above get these on top of their 2 signatures.
const RARE_EFFECTS = [
  { id: "flip",     name: "Element Flip", icon: "🔥", kind: "utility",  base: 0,  desc: "Swap your element to counter the opponent's." },
  { id: "double",   name: "Double Strike", icon: "⚔️", kind: "damage",  base: 45, desc: "Attacks twice in one turn." },
  { id: "reflect",  name: "Reflect",      icon: "🪞", kind: "utility",  base: 0,  desc: "Bounces the opponent's next attack back." },
  { id: "lifesteal",name: "Lifesteal",    icon: "🔗", kind: "damage",  base: 50, desc: "Deals damage and heals you for part of it." },
];

// Super-rare effects — Legendary only, 33% chance. The nuke tier.
const SUPER_RARE_EFFECTS = [
  { id: "void",    name: "Void Send", icon: "💀", kind: "banish",  base: 0, desc: "Instantly banish the opponent's mascot to the graveyard." },
  { id: "undying", name: "Undying",   icon: "♾️", kind: "revive",  base: 1, desc: "The first time you'd be banished, survive with 1 HP." },
];

// Epic passives — Epic tier gets one small always-on passive.
const EPIC_PASSIVES = [
  { id: "regen",    name: "Regeneration", icon: "🌿", kind: "passive", base: 8,  desc: "Heal a little HP each turn." },
  { id: "thorns",   name: "Thorns",       icon: "🌵", kind: "passive", base: 10, desc: "Attackers take recoil damage." },
  { id: "momentum", name: "Momentum",     icon: "💨", kind: "passive", base: 1,  desc: "Speed rises each turn." },
];

// Deterministic hash from a string -> unsigned 32-bit int (FNV-1a).
// Used so a mascot's per-character variance is stable and reproducible.
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A small seeded PRNG (mulberry32) so we can pull several stable values from one seed.
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Element system --------------------------------------------------------
// Four elements, each equally likely, assigned DETERMINISTICALLY from the
// mascot's identity (so the same mascot always has the same element — on-chain
// safe — but different mascots vary). Type-advantage triangle drives battle:
//   Fire beats Earth, Earth beats Air, Air beats Water, Water beats Fire.
const ELEMENTS = [
  { id: "Fire",  icon: "🔥", color: "#FF5A3C", beats: "Earth" },
  { id: "Water", icon: "💧", color: "#3CA9FF", beats: "Fire" },
  { id: "Earth", icon: "🌍", color: "#B98A3C", beats: "Air" },
  { id: "Air",   icon: "💨", color: "#9FE6FF", beats: "Water" },
];

// Returns the element object for a mascot, derived from its identity seed.
// If the mascot already has a locked element (e.g. from its minted metadata),
// that is honored instead of re-rolling.
function resolveElement(seed, lockedElementId) {
  if (lockedElementId) {
    const found = ELEMENTS.find((e) => e.id === lockedElementId);
    if (found) return found;
  }
  // Use a distinct slice of the seed so element doesn't correlate with abilities.
  const r = seededRandom(seed ^ 0x9e3779b9)();
  return ELEMENTS[Math.floor(r * ELEMENTS.length) % ELEMENTS.length];
}

// Given two element ids, returns 1 if a beats b, -1 if b beats a, 0 if neutral.
export function elementMatchup(aId, bId) {
  const a = ELEMENTS.find((e) => e.id === aId);
  const b = ELEMENTS.find((e) => e.id === bId);
  if (!a || !b) return 0;
  if (a.beats === bId) return 1;
  if (b.beats === aId) return -1;
  return 0;
}


// Pick n distinct items from a pool using a seeded RNG (deterministic).
function seededPick(pool, n, rng) {
  const copy = pool.slice();
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}


// ---- Tier system (assigned by mint-time roll, NOT by traits) --------------
// The rarity roll (server-side) decides tier. Here we only define what a tier
// MEANS mechanically: a flat stat bonus applied to every stat, and whether the
// card gets bonus-effect slots. Order matters for validation.
const TIER_ORDER = ["Common", "Rare", "Epic", "Legendary"];

const TIER_BONUS = {
  Common: 0,     // no bonus
  Rare: 1,       // +1 to every stat
  Epic: 2,       // +2 to every stat + a minor passive slot
  Legendary: 3,  // +3 to every stat + a full 2nd effect slot
};

// How many bonus-effect slots a tier unlocks (used by the effect system).
const TIER_EFFECT_SLOTS = {
  Common: 0,
  Rare: 0,
  Epic: 1,   // minor passive
  Legendary: 2, // signature-strength 2nd effect
};

// ---- Helpers --------------------------------------------------------------

function sumStats(names, table) {
  const total = [0, 0, 0, 0];
  (names || []).forEach((n) => {
    const s = table[n];
    if (s) for (let i = 0; i < 4; i++) total[i] += s[i];
  });
  return total;
}

// Squash a raw accumulated score into a clean 1-7 rating.
// Tuned so a typical character lands mid-range and maxed builds approach 7.
function toRating(raw, min, max) {
  if (max === min) return 4;
  const scaled = 1 + ((raw - min) / (max - min)) * 6;
  return Math.max(1, Math.min(7, Math.round(scaled)));
}

// Base trait stats clamp to the 1-7 range (familiar card scale). The tier
// bonus is then ADDED on top and is NOT capped — so a maxed base-7 stat plus a
// Legendary +3 reads as 10. This guarantees the tier bonus always matters, even
// on fully-stacked builds, and keeps Legendary visibly stronger than any
// un-tiered card. Floor stays at 1.
function clampBase(v) {
  return Math.max(1, Math.min(7, v));
}

function applyBonus(base, bonus) {
  return Math.max(1, base + bonus); // no upper clamp — bonus can exceed 7
}

/**
 * Computes battle stats for a character from its traits.
 *
 * @param {object} traits - { archetypes, vibes, worlds, colors, accessories, aura }
 * @param {string|null} tier - The card tier assigned by the mint-time rarity
 *   roll ("Common"|"Rare"|"Epic"|"Legendary"). Pass null/undefined for a
 *   pre-mint PREVIEW: stats are computed with NO tier bonus and tier is null.
 *   Tier is NEVER inferred from traits — it must be supplied by the roll.
 * @returns {{power:number, hp:number, speed:number, special:number, total:number,
 *            basePower:number, baseHp:number, baseSpeed:number, baseSpecial:number,
 *            hpPoints:number, signatureMove:{name:string,desc:string},
 *            tier:(string|null), tierBonus:number, effectSlots:number}}
 */
export function computeStats(traits, tier = null) {
  const t = traits || {};
  const acc = [0, 0, 0, 0];
  const add = (arr) => {
    for (let i = 0; i < 4; i++) acc[i] += arr[i];
  };

  add(sumStats(t.archetypes, ARCHETYPE_STATS));
  add(sumStats(t.vibes, VIBE_STATS));
  add(sumStats(t.worlds, WORLD_STATS));
  add(sumStats(t.colors, COLOR_STATS));
  add(sumStats(t.accessories, ACCESSORY_STATS));
  if (t.aura && AURA_STATS[t.aura]) add(AURA_STATS[t.aura]);

  // Rating bounds recalibrated from measured raw-score distributions across tiers.
  // Raw scores range ~0 (nothing) to ~85 (a fully-stacked Elite build with the
  // heaviest traits). Mapping 0..70 onto the 1-7 scale means:
  //   Free (1 per category, raw ~10):      lands ~2-3
  //   Platinum (raw ~35):                  lands ~4-5
  //   Elite (raw ~63):                     lands ~5-6 typically
  //   Only a DELIBERATELY optimized Elite max-stack (raw 75+) reaches 7.
  // This makes 7/7/7/7 something you have to intentionally build toward — even
  // at Elite — rather than something every build hits by accident.
  const [rp, rh, rs, rx] = acc;
  const basePower = clampBase(toRating(rp, 0, 70));
  const baseHp = clampBase(toRating(rh, 0, 70));
  const baseSpeed = clampBase(toRating(rs, 0, 68));
  const baseSpecial = clampBase(toRating(rx, 0, 70));

  // Validate the supplied tier. If it isn't a known tier (e.g. preview), no bonus.
  const validTier = TIER_ORDER.includes(tier) ? tier : null;
  const bonus = validTier ? TIER_BONUS[validTier] : 0;

  // Apply the tier stat bonus on top of the base — NOT capped at 7, so a maxed
  // Legendary reaches 10 and the bonus always matters.
  const power = applyBonus(basePower, bonus);
  const hp = applyBonus(baseHp, bonus);
  const speed = applyBonus(baseSpeed, bonus);
  const special = applyBonus(baseSpecial, bonus);

  // ---- Per-character deterministic variance --------------------------------
  // Seed from the character's identity so every mascot differs, but the SAME
  // mascot always resolves to the SAME numbers (on-chain safe). We fold in the
  // name plus all trait selections.
  const identity = [
    t.name || t.characterName || "",
    (t.archetypes || []).join(","),
    (t.vibes || []).join(","),
    (t.worlds || []).join(","),
    (t.colors || []).join(","),
    (t.accessories || []).join(","),
    t.aura || "",
  ].join("|");
  const seed = hashString(identity || "mascot");
  const rng = seededRandom(seed);

  // Resolve the mascot's element (deterministic; honors a locked element if the
  // traits carry one, e.g. from minted on-chain metadata).
  const element = resolveElement(seed, t.element);

  // Variance factor in ~0.85..1.15 — a stable per-character multiplier so two
  // mascots with identical stats still hit for slightly different numbers.
  const variance = 0.85 + rng() * 0.30;

  // ---- HP pool (now varies by traits AND per-character) --------------------
  // Base scales with the HP stat; rare/alpha-heavy builds land higher. The
  // variance multiplier spreads otherwise-identical builds apart, so you don't
  // see the same HP on every mascot.
  const hpPoints = Math.round((60 + hp * 14) * variance); // ~ 70 .. 230+

  // ---- Signature abilities (2, always) -------------------------------------
  // Damage/heal/shield magnitudes scale with the relevant stat + variance, so
  // each mascot deals different numbers even at the same rarity.
  const atkScale = (0.6 + (power + special) / 20) * variance; // higher Power/Special = bigger hits
  const defScale = (0.6 + (hp) / 10) * variance;

  const scaleEffect = (eff) => {
    let value = eff.base;
    let label = "";
    if (eff.kind === "damage") {
      value = Math.round(eff.base * atkScale);
      label = `${value} dmg`;
    } else if (eff.kind === "shield") {
      value = Math.round(eff.base * defScale);
      label = `+${value} shield`;
    } else if (eff.kind === "heal") {
      value = Math.round(eff.base * defScale);
      label = `+${value} HP`;
    } else if (eff.kind === "drain") {
      label = `-Power ${eff.base}t`;
    } else if (eff.kind === "stun") {
      label = `skip 1 turn`;
    } else if (eff.kind === "passive") {
      value = Math.round(eff.base * (0.7 + variance * 0.3));
      label = eff.id === "momentum" ? `+Speed/turn` : `${value}/turn`;
    } else if (eff.kind === "banish") {
      label = `banish`;
    } else if (eff.kind === "revive") {
      label = `survive at 1 HP`;
    } else {
      label = eff.desc.split(".")[0];
    }
    return { id: eff.id, name: eff.name, icon: eff.icon, kind: eff.kind, value, label, desc: eff.desc };
  };

  // Two signatures, deterministically chosen from the common pool.
  const signatures = seededPick(COMMON_EFFECTS, 2, rng).map(scaleEffect);

  // ---- Extra abilities by tier ---------------------------------------------
  const abilities = [];
  if (validTier === "Rare" || validTier === "Epic" || validTier === "Legendary") {
    abilities.push(...seededPick(RARE_EFFECTS, 1, rng).map(scaleEffect));
  }
  if (validTier === "Epic") {
    abilities.push(...seededPick(EPIC_PASSIVES, 1, rng).map(scaleEffect));
  }
  if (validTier === "Legendary") {
    // A second rare effect...
    const secondRare = seededPick(RARE_EFFECTS.filter((e) => !abilities.some((a) => a.id === e.id)), 1, rng).map(scaleEffect);
    abilities.push(...secondRare);
    // ...and a 33% chance at a super-rare effect (the nuke tier).
    if (rng() < 0.33) {
      abilities.push(...seededPick(SUPER_RARE_EFFECTS, 1, rng).map(scaleEffect));
    }
  }

  // Viral-moment commemorative ability: mascots born from Trending Mode carry a
  // unique but deliberately WEAK ability named after their moment, so the viral
  // moment lives on forever on the card. Cosmetic-leaning, low value.
  if (t.viralMoment) {
    const momentName = typeof t.viralMoment === "string" && t.viralMoment.length > 1
      ? t.viralMoment.slice(0, 24)
      : "Viral Echo";
    const viralDmg = 10 + Math.round(rng() * 8); // weak: 10-18 dmg
    abilities.push({
      id: "viral",
      name: momentName,
      icon: "🌟",
      kind: "damage",
      value: viralDmg,
      label: `${viralDmg} dmg · viral moment`,
      desc: "A commemorative move from the viral moment that birthed this mascot.",
    });
  }

  // Keep the legacy signatureMove field (highest-stat flavor) for compatibility.
  const order = [
    ["special", special],
    ["power", power],
    ["hp", hp],
    ["speed", speed],
  ];
  order.sort((a, b) => b[1] - a[1]);
  const signatureMove = SIGNATURE_MOVES[order[0][0]];

  const total = power + hp + speed + special;

  return {
    power, hp, speed, special, total,
    basePower, baseHp, baseSpeed, baseSpecial,
    hpPoints,
    variance,
    element,              // NEW: { id, icon, color, beats }
    signatureMove,        // legacy flavor field
    signatures,           // NEW: the 2 signature abilities with values
    abilities,            // NEW: extra tier-gated abilities with values
    hasSuperRare: abilities.some((a) => a.kind === "banish" || a.kind === "revive"),
    tier: validTier,
    tierBonus: bonus,
    effectSlots: validTier ? TIER_EFFECT_SLOTS[validTier] : 0,
  };
}

/**
 * Formats computed stats as NFT metadata attributes (Solana/Metaplex standard).
 * These go on-chain alongside the trait attributes so the card is provably
 * playable with fixed stats. Only call this at MINT time, when a tier has been
 * assigned — a preview (tier null) should not be minted.
 */
export function statsToAttributes(stats) {
  const attrs = [
    { trait_type: "Power", value: stats.power },
    { trait_type: "HP", value: stats.hp },
    { trait_type: "Speed", value: stats.speed },
    { trait_type: "Special", value: stats.special },
    { trait_type: "Battle HP", value: stats.hpPoints },
    { trait_type: "Signature Move", value: stats.signatureMove.name },
    { trait_type: "Card Tier", value: stats.tier || "Common" },
  ];
  return attrs;
}

// Exported so the rarity engine / battle system can reference tier meaning
// without duplicating the constants.
export { TIER_ORDER, TIER_BONUS, TIER_EFFECT_SLOTS };
