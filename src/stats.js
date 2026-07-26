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
  Headphones: [0, 1, 2, 1], "Rocket Backpack": [1, 0, 4, 1], Halo: [0, 2, 1, 3], "Devil Horns": [3, 1, 1, 2],
  "Cowboy Hat": [2, 1, 1, 1], Sweater: [0, 2, 0, 1], Shorts: [0, 0, 2, 0],
  Scarf: [0, 2, 1, 1], Backpack: [0, 2, 1, 1], Wristband: [1, 1, 1, 0], Bandana: [1, 1, 2, 1], "Face Mask": [1, 1, 2, 2],
  "Laser Eyes": [4, 0, 1, 3], "Diamond Hands": [2, 4, 0, 2], "Green Candle": [3, 1, 2, 2], Rolex: [1, 2, 1, 3],
  Harp: [0, 2, 1, 4], Sword: [4, 1, 2, 1], Katana: [4, 1, 3, 1], Crown: [2, 3, 1, 3], Cigar: [2, 2, 1, 2],
  Jetpack: [1, 1, 5, 2], Wings: [1, 1, 4, 3], Shield: [1, 4, 0, 2],
  "Golden Wif Hat": [3, 3, 2, 3], "Cyber Visor": [3, 2, 3, 4], "Hype Kicks": [1, 1, 5, 1],
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

  // Rating bounds — empirically chosen so ratings spread nicely across 1-7.
  // Base trait stats are clamped to 1-7 (the familiar card scale).
  const [rp, rh, rs, rx] = acc;
  const basePower = clampBase(toRating(rp, 2, 22));
  const baseHp = clampBase(toRating(rh, 2, 22));
  const baseSpeed = clampBase(toRating(rs, 2, 20));
  const baseSpecial = clampBase(toRating(rx, 2, 22));

  // Validate the supplied tier. If it isn't a known tier (e.g. preview), no bonus.
  const validTier = TIER_ORDER.includes(tier) ? tier : null;
  const bonus = validTier ? TIER_BONUS[validTier] : 0;

  // Apply the tier stat bonus on top of the base — NOT capped at 7, so a maxed
  // Legendary reaches 10 and the bonus always matters.
  const power = applyBonus(basePower, bonus);
  const hp = applyBonus(baseHp, bonus);
  const speed = applyBonus(baseSpeed, bonus);
  const special = applyBonus(baseSpecial, bonus);

  // Actual HP pool used in battle (bigger number than the 1-7 rating).
  const hpPoints = 40 + hp * 12; // ranges ~52 to ~124

  // Signature move = whichever stat is highest (ties break in this priority).
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
    // base (pre-tier-bonus) stats kept for transparency / preview display
    basePower, baseHp, baseSpeed, baseSpecial,
    hpPoints, signatureMove,
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
