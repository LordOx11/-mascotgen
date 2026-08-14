// stats.js — the MascotGen battle stat engine.
//
// Core principle: stats are DETERMINISTIC. The same character (same traits)
// always produces the exact same BASE stats. Nothing random at battle time —
// this makes the game fair, verifiable, and impossible to manipulate after
// minting. The stats are baked into the NFT metadata, so what you mint is
// what you play.
//
// IMPORTANT (rarity refactor): Card TIER is NO LONGER derived from traits.
// Tier is assigned by a mint-time RARITY ROLL (api/open-pack.js) and passed
// INTO computeStats(). Nobody can build or buy a tier — it is rolled.
//
// v2 — THE 11 GODS: a fifth tier, SUPER LEGENDARY, sits above Legendary.
// It can never be rolled through normal odds — it belongs to the 11 gods of
// the Pentaverse (plus a 0.01% public roll at the last 3 thrones, handled
// server-side). A god card is maxed: 10/10/10/10, 333 Battle HP, both
// super-rare effects, and one UNIQUE god ability. Toro Maximus, Kaelion Voss
// and Vraxon the Unbothered have hand-written god abilities; every other god
// draws a deterministic one from the divine pool (hand-tune later by adding
// their name to GOD_OVERRIDES).

// ---- Per-category stat contributions -------------------------------------

const ARCHETYPE_STATS = {
  // Common — balanced, modest
  Animal: [2, 2, 2, 1], Dog: [2, 2, 3, 1], Cat: [2, 1, 3, 2], Frog: [1, 2, 3, 1],
  Bear: [3, 3, 1, 1], Hamster: [1, 1, 3, 1], Penguin: [1, 2, 2, 1], Food: [1, 3, 1, 2],
  Plant: [1, 3, 1, 2], Object: [2, 2, 1, 2], "Human-like": [2, 2, 2, 2],
  Bird: [2, 1, 4, 1], Fish: [1, 2, 3, 1], Rabbit: [1, 2, 4, 1], Mouse: [1, 1, 4, 1],
  Baby: [1, 2, 3, 4], Panther: [3, 2, 4, 2], Goat: [2, 3, 2, 2], Snake: [2, 2, 4, 3],
  // Rare — stronger
  Ape: [4, 3, 2, 1], Creature: [3, 3, 2, 3], Robot: [3, 3, 1, 3], Insect: [2, 2, 4, 2], Blob: [2, 4, 1, 3],
  Dragon: [5, 4, 3, 4], Dino: [4, 4, 2, 1], Slime: [1, 5, 1, 3],
  // Alpha — top tier
  Bull: [5, 4, 2, 2], Ghost: [2, 3, 4, 5], Zombie: [3, 5, 1, 3], Alien: [3, 3, 3, 5], Fighter: [5, 4, 3, 2],
  Demon: [5, 3, 3, 4], Angel: [3, 4, 3, 5],
  // Previously selectable but unwired — these contributed NOTHING to a card.
  Lion: [4, 3, 2, 2], "Sports Car": [3, 2, 5, 2], Gargoyle: [4, 5, 2, 3],
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
  // Previously selectable but unwired.
  "Adrenaline Junkie": [3, 1, 4, 1], "Smooth Operator": [1, 2, 3, 3], "Hot-Headed": [4, 2, 2, 1],
  "Show-Off": [2, 1, 3, 3], Mischievous: [2, 1, 4, 2],
  Fearless: [4, 4, 2, 2], "Stone-Cold Stoic": [2, 5, 1, 3],
  // NEW — 3 Common · 2 Rare · 2 Alpha
  Paranoid: [1, 2, 3, 2], Loyal: [2, 3, 1, 2], Theatrical: [2, 1, 2, 3],
  Haunted: [2, 3, 2, 4], Ruthless: [4, 2, 3, 2],
  Warlord: [5, 4, 2, 3], Ascendant: [3, 4, 3, 5],
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
  "Travel Train": [1, 2, 3, 1], Planet: [2, 2, 2, 3], "Machine Planet": [2, 3, 1, 4], "Water Planet": [1, 4, 2, 3],
  "Fire Planet": [4, 1, 2, 3], "Storm Planet": [2, 1, 4, 4], "Crystal Planet": [2, 4, 2, 5], "Gold Planet": [3, 4, 2, 4],
  // NEW — 2 Common · 2 Rare · 1 Alpha. The Cosmic Waterfall is the cord to
  // heaven itself (Lore Bible §3), so it tops the table.
  Skyscraper: [2, 2, 3, 2], Subway: [2, 2, 3, 1],
  "Sunken Cathedral": [2, 3, 2, 4], "Black Market": [3, 2, 3, 2],
  "The Cosmic Waterfall": [3, 4, 3, 5],
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
  Nunchucks: [3, 1, 4, 1], "Chef Apron": [1, 3, 1, 2], "Police Suit": [2, 3, 2, 1],
  Scrubs: [1, 4, 2, 2], "Trench Coat": [2, 3, 1, 3], "Sports Car": [2, 1, 5, 3],
  "Cosmic Aura": [3, 3, 3, 4], "Dark Aura": [4, 2, 3, 4],
  // Previously selectable but unwired — every one of these gave a card ZERO
  // stats, including three Elite-only items people paid for.
  Dreadlocks: [0, 2, 1, 2], Braids: [0, 1, 2, 2], Durag: [1, 1, 2, 1], Hoodie: [0, 2, 1, 1],
  Mohawk: [2, 1, 2, 1], Eyepatch: [2, 1, 1, 2], "Leather Jacket": [2, 2, 1, 1], Beard: [1, 2, 0, 2],
  "Varsity Jacket": [1, 2, 1, 1], "Fanny Pack": [0, 1, 1, 1], "Ski Goggles": [0, 1, 2, 1],
  "Cargo Pants": [0, 2, 1, 1], "Top Hat": [0, 1, 1, 3], Overalls: [1, 2, 0, 1],
  "Flip Flops": [0, 0, 1, 1], "Fishing Rod": [1, 1, 1, 2], Toolbelt: [1, 2, 1, 1],
  "Gold Grillz": [1, 2, 1, 3], Skateboard: [1, 1, 4, 1], Microphone: [1, 2, 1, 4],
  "Spiked Collar": [3, 2, 1, 1], Trident: [4, 2, 2, 2], Scythe: [5, 1, 2, 2], "Wizard Staff": [1, 2, 1, 5],
  "Cybernetic Arm": [4, 3, 2, 3], "Dragon Wings": [3, 3, 4, 3], "Plasma Cannon": [5, 1, 2, 4],
  // NEW — 5 Common · 4 Rare · 3 Alpha
  "Denim Vest": [1, 2, 1, 1], "Bucket Hat": [0, 1, 1, 2], Kneepads: [0, 2, 2, 0],
  "Messenger Bag": [0, 2, 1, 1], "Prayer Beads": [0, 2, 0, 3],
  "Grappling Hook": [1, 1, 4, 2], "Brass Knuckles": [4, 1, 2, 1], "Smoke Bombs": [1, 2, 3, 3],
  "Oracle Deck": [0, 2, 1, 5],
  "Void Gauntlet": [5, 2, 2, 4], "Seraph Blade": [5, 2, 3, 3], "Warp Boots": [1, 2, 5, 4],
};

const AURA_STATS = {
  None: [0, 0, 0, 0],
  "Dragon Aura": [4, 3, 2, 4],
  "Ultimate Aura": [4, 4, 3, 5],
  "Blessed Aura": [3, 5, 2, 5],
};

// Signature moves — unlocked by the character's highest-contributing trait area.
const SIGNATURE_MOVES = {
  power: { name: "Overpower", desc: "A crushing strike scaled by Power." },
  hp: { name: "Iron Will", desc: "Shrug off damage and heal a portion of HP." },
  speed: { name: "Blitz", desc: "Strike first and gain an extra action." },
  special: { name: "Signature Burst", desc: "Unleash the character's unique special energy." },
};

// ---- Ability system --------------------------------------------------------

// Common effects — the pool every mascot's 2 signatures are drawn from.
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
  { id: "reflect",  name: "Reflect",      icon: "👥", kind: "utility",  base: 0,  desc: "Bounces the opponent's next attack back." },
  { id: "lifesteal",name: "Lifesteal",    icon: "🔗", kind: "damage",  base: 50, desc: "Deals damage and heals you for part of it." },
];

// Super-rare effects — Legendary rolls a 33% chance at ONE. Gods get BOTH.
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

// ---- THE 11 GODS — Super Legendary ----------------------------------------
export const GOD_TIER = "Super Legendary";
// ---- THE POWER LADDER (single source of truth) -----------------------------
// Every rung sits strictly above the one below it, with deliberate daylight
// left at the very top for THE DEEP 7. Read it top to bottom:
//
//   mortal roll ......    70 – 230
//   ⚜️ Champion ......       333   (Giant-Slayer closes the gap upward)
//   😈 Demon .........       666
//   🕊️ Archangel .....       777
//   ✧ divine floor ...       888   Corvaxis · Seraphine · Aethon · any new god
//   ✧ throne gods ....       999   Vraxon · Aurelia · Kaelion
//   ✧ Blaze ..........     1,111   usurper of the Fire throne
//   ✧ Toro / Gravel ..     1,333   the bull and the house — the ceiling of the
//                                   known pantheon, and nothing reaches it
//   🕳️ THE DEEP 7 ....     1,555   RESERVED. Above Toro and Gravel by design,
//                                   one-on-one. Beatable only in numbers —
//                                   which is the entire argument for clans.
//
// Gods were previously capped at 777, i.e. LEVEL with an Archangel and only
// 111 above a Demon. That read wrong on the card and left no headroom at all
// for the Deep 7 to sit above them. The whole ladder moved up together, so
// nothing below changed in relative terms.
const GOD_HP = 888;   // the divine floor — no god sits below 888, which is
                      // itself above the Archangel age's 777.
export const DEEP7_HP = 1555;  // reserved ceiling — see AGE_CARDS.deep7
const DEEP7_MOVE = 133;        // flat move value — see GOD_MOVE_OVERRIDES note

// ---- RAID-TIER GODS --------------------------------------------------------
// A few gods are built as raid bosses rather than duelists — they anchor
// community-vs-god events, so they get their own Battle HP above the standard
// 333. Keyed by exact character name.
//
// TIERS (power, NOT lineage — per the Lore Bible, a throne is an office).
// FLOOR: no god sits below 888 — above the Archangel age, as it should be.
//   1,333 — Toro (strong by nature) and Gravel (strong by leverage: contracts)
//     999 — Blaze is ABOVE this trio; these are the seated lower-realm powers:
//           Vraxon (wars were fought for his attention; none succeeded) ·
//           Aurelia · Kaelion (whose edict rewrites one action per battle)
//   1,111 — Blaze, usurper of the Fire throne
//     888 — the divine floor: Aethon, Seraphine, Corvaxis, every other god
// Note: Aethon halves ALL damage and Corvaxis dodges every 3rd hit, so their
// abilities already multiply effective HP — at 888 they're durable without
// stacking raid HP that would push them past the bull.
const GOD_HP_OVERRIDES = {
  "Toro Maximus": 1333,
  "Gravel Mortis": 1333,         // the house sits level with the bull
  "Blaze Malpherion": 1111,
  "Vraxon the Unbothered": 999,
  "Aurelia the Eternal Bull": 999,
  "Kaelion Voss": 999,
  "Corvaxis": 888,
};

// Forces every numeric move (damage / shield / heal) on a god to a flat value,
// so a raid boss hits — and holds — like one. Passives are left alone.
// Scaled with the ladder — at 1,333 HP a 111 hit would drag raid fights past
// the engine's round cap and turn a god duel into a war of attrition.
const GOD_MOVE_OVERRIDES = {
  "Toro Maximus": 177,
  "Gravel Mortis": 177,
};
const GOD_STAT = 10;  // every god stat is maxed

// Hand-written god abilities. Add each new god's name here after you mint it
// to replace its pooled ability with a custom one.
const GOD_OVERRIDES = {
  "Toro Maximus": {
    id: "god_toro", name: "Blessed Horizon", icon: "🐂", kind: "god", value: 0,
    label: "can't be banished · pierces shields",
    desc: "Toro cannot be banished — Void Send fails against him — and his attacks pierce straight through shields.",
  },
  "Kaelion Voss": {
    id: "god_kaelion", name: "Sovereign Edict", icon: "⚔️", kind: "god", value: 0,
    label: "rewrite 1 enemy action / battle",
    desc: "Once per battle, Kaelion cancels the opponent's action outright and strikes in its place.",
  },
  "Vraxon the Unbothered": {
    id: "god_vraxon", name: "Unbothered", icon: "😤", kind: "god", value: 0,
    label: "first hit each battle = 0",
    desc: "The first attack against Vraxon each battle deals nothing. He didn't notice it.",
  },
  "Aethon Ironveil": {
    id: "god_aethon", name: "Heaven's Bulwark", icon: "🕊️", kind: "god", value: 0,
    label: "ALL damage taken is halved",
    desc: "Forged in the ruins of heaven, built to hold forever — every hit against Aethon is cut in half, always.",
  },
  "Seraphine Valdur": {
    id: "god_seraphine", name: "Judgment Flame", icon: "🔥", kind: "god", value: 111,
    label: "111 dmg · can't miss · ignores Reflect",
    desc: "Once per battle the Eternal Fist of Heaven falls: 111 unavoidable damage that no mirror can turn back.",
  },
  "Aurelia the Eternal Bull": {
    id: "god_aurelia", name: "Eternal Refrain", icon: "🎼", kind: "god", value: 55,
    label: "heals 55 HP every round",
    desc: "The golden harp of Empyrion never stops playing — Aurelia recovers 55 HP at the end of every round for as long as the song holds.",
  },
  "Gravel Mortis": {
    id: "god_gravel", name: "The House Always Wins", icon: "🎰", kind: "god", value: 0,
    label: "enemy crits & Super-Rares fail vs him",
    desc: "Every critical strike and Super-Rare effect aimed at Gravel Mortis comes up snake eyes. The dealer is already dead — and the house always wins.",
  },
  "Corvaxis": {
    id: "god_corvaxis", name: "Void Waltz", icon: "🌀", kind: "god", value: 0,
    label: "every 3rd attack misses entirely",
    desc: "Corvaxis steps into the void mid-swing — every third strike against him touches nothing at all. Too pretty to die.",
  },
  "Blaze Malpherion": {
    id: "god_blaze", name: "Throne of Cinders", icon: "👑", kind: "god", value: 11,
    label: "burns ALL enemies 11/turn",
    desc: "The usurper of the Fire throne sets the whole battlefield alight — every enemy burns for 11 at the end of each turn.",
  },
};

// The divine pool — gods without a hand-written override draw ONE of these,
// deterministically from their name, so the same god always shows the same
// power. Eight abilities for the eight remaining thrones.
const GOD_ABILITY_POOL = [
  { id: "god_dawn",    name: "Dawnbreaker",     icon: "🌅", kind: "god", value: 0, label: "full heal once below 20%", desc: "Once per battle, when below 20% HP, restore to full." },
  { id: "god_judge",   name: "Divine Judgment", icon: "⚖️", kind: "god", value: 0, label: "dmg = enemy Power ×15",    desc: "Strike for damage equal to the opponent's own Power ×15." },
  { id: "god_horizon", name: "Event Horizon",   icon: "🕳️", kind: "god", value: 0, label: "absorb 2 hits, release",   desc: "Absorb the next two attacks, then release their combined damage back." },
  { id: "god_wrath",   name: "Star's Wrath",    icon: "🌩️", kind: "god", value: 0, label: "150 dmg once / battle",    desc: "Call down a single devastating 150-damage strike, once per battle." },
  { id: "god_tithe",   name: "Tithe",           icon: "🩸", kind: "god", value: 0, label: "drain 10% max HP ×3 turns", desc: "Drain 10% of the opponent's max HP each turn for three turns." },
  { id: "god_still",   name: "Stillness",       icon: "🧊", kind: "god", value: 0, label: "enemy Speed = 1 for 3 turns", desc: "Freeze the opponent's Speed to 1 for three turns." },
  { id: "god_fate",    name: "Rewrite Fate",    icon: "🔮", kind: "god", value: 0, label: "reroll any outcome once",  desc: "Once per battle, force any single outcome to be rerolled." },
  { id: "god_edge",    name: "Oblivion Edge",   icon: "🗡️", kind: "god", value: 0, label: "strike ignores Undying",   desc: "A strike so absolute that even Undying cannot survive it." },
];

// ✋ THE GOD-MARKED — 777 forever, rolled at 0.1% of paid mints.
// A mortal touched by one of the Twelve. Not a god, not a tier — an overlay
// that can land on ANY rarity. The mark grants +77 Battle HP and one power
// lent by the god who marked them, so which throne touched you is collectible.
export const MARK_HP_BONUS = 77;
export const MARK_SUPPLY = 777;

const MARK_ABILITIES = {
  1:  { id: "mark_1",  name: "Borrowed Flame",    icon: "🔥", kind: "mark", value: 44, label: "44 burn for 3 turns",      desc: "The mark burns the opponent for 44 damage over three turns." },
  2:  { id: "mark_2",  name: "Borrowed Tide",     icon: "🌊", kind: "mark", value: 44, label: "heal 44 when struck",      desc: "When struck below half HP, the tide restores 44." },
  3:  { id: "mark_3",  name: "Borrowed Stone",    icon: "🪨", kind: "mark", value: 55, label: "+55 shield once",          desc: "Once per battle, the earth answers with a 55-point shield." },
  4:  { id: "mark_4",  name: "Borrowed Gale",     icon: "🌪️", kind: "mark", value: 0,  label: "act first for 2 turns",     desc: "The wind grants the first move for two turns." },
  5:  { id: "mark_5",  name: "Borrowed Ledger",   icon: "📓", kind: "mark", value: 0,  label: "enemy crit fails once",    desc: "The house voids the opponent's first critical strike." },
  6:  { id: "mark_6",  name: "Borrowed Silence",  icon: "🤫", kind: "mark", value: 0,  label: "mute an ability 2 turns",  desc: "Silences one enemy ability for two turns." },
  7:  { id: "mark_7",  name: "Borrowed Edge",     icon: "🗡️", kind: "mark", value: 66, label: "66 dmg, pierces shields",  desc: "A lent edge that ignores shields for 66 damage." },
  8:  { id: "mark_8",  name: "Borrowed Hour",     icon: "⏳", kind: "mark", value: 0,  label: "repeat your last move",    desc: "Once per battle, take the same turn twice." },
  9:  { id: "mark_9",  name: "Borrowed Mercy",    icon: "🕊️", kind: "mark", value: 0,  label: "survive one lethal hit",   desc: "The first lethal blow leaves 1 HP instead." },
  10: { id: "mark_10", name: "Borrowed Hunger",   icon: "🩸", kind: "mark", value: 40, label: "drain 40, heal for it",    desc: "Drain 40 damage and heal for the same amount." },
  11: { id: "mark_11", name: "Borrowed Thunder",  icon: "⚡", kind: "mark", value: 88, label: "88 dmg once / battle",     desc: "A single lent thunderclap for 88 damage." },
  12: { id: "mark_12", name: "Borrowed Refrain",  icon: "🎵", kind: "mark", value: 0,  label: "restore a spent ability",  desc: "A note from a sealed throne returns one used ability." },
};

export function markAbilityFor(throne) {
  const n = Number(throne);
  return MARK_ABILITIES[n] ? { ...MARK_ABILITIES[n] } : { ...MARK_ABILITIES[1] };
}

// ---- ⏳ THE AGES — milestone card classes ----------------------------------
// Rolled server-side (open-pack) once the mint counter crosses each milestone.
// An age card is an OVERLAY like the God-Mark: it lands on a rolled rarity and
// REPLACES the card's Battle HP with the age's fixed number — the whitepaper's
// exact promise (Champions 333 · Demons 666 · Archangels 777). It also grants
// one age ability, deterministic from the character's identity seed.
export const AGE_CARDS = {
  champion_s1: { icon: "⚜️", name: "Champion — Season 1", hp: 333, supply: 333 },
  champion_s2: { icon: "⚜️", name: "Champion — Season 2", hp: 333, supply: 333 },
  demon:       { icon: "😈", name: "Demon Age",           hp: 666, supply: 666 },
  archangel:   { icon: "🕊️", name: "Archangel",           hp: 777, supply: 1111 },
  // 🕳️ THE DEEP 7 — SCAFFOLDED, NOT RELEASED. 777 cards at 1,555 HP, which is
  // 222 above Toro and Gravel. One of these beats either of them one-on-one
  // more often than not; a PAIR of gods beats one of these. That asymmetry is
  // the mechanical argument for clans, and the reason the throne-succession
  // arcs become possible only once this age lands. The milestone and odds in
  // open-pack.js are placeholders — nothing fires until the counter reaches
  // them, so this ships safely years before it opens.
  deep7:       { icon: "🕳️", name: "The Deep 7",          hp: 1555, supply: 777 },
};

// ⚜️ GIANT-SLAYER — carried by EVERY Champion card, no roll involved. This is
// the answer to the 333-vs-666 problem: 666 Champions (two seasons) will one
// day face 666 Demons with exactly half their HP, and without this the fight
// is decided before it starts. Because the bonus is the RATIO of the enemy's
// bar to your own, it is worth +100% against a Demon, +100% (capped) against
// an Archangel, +33% against a 444 HP god — and exactly ZERO against a Common,
// an Epic, or anything else a Champion outweighs. It cannot bully the lower
// tiers even in principle. The prophecy assembles Champions for one reason:
// they are built to fight things bigger than themselves.
const CHAMPION_INTRINSIC = {
  id: "champ_giant", name: "Giant-Slayer", icon: "⚜️", kind: "age", value: 0,
  label: "dmg scales vs bigger foes (max 2x)",
  desc: "Trained on things larger than itself. Damage scales with how far the enemy's HP bar outreaches your own, up to double — and does nothing whatsoever to anything smaller than you.",
};

const CHAMPION_ABILITIES = [
  { id: "champ_resolve", name: "Champion's Resolve", icon: "⚜️", kind: "age", value: 0,  label: "below 33% HP: damage +33%",       desc: "Backed into the corner where champions are made — under a third of HP, every strike lands a third harder." },
  { id: "champ_counter", name: "Ring Counter",       icon: "🥊", kind: "age", value: 0,  label: "counter 5% of attacker's max HP", desc: "Answer every blow instantly for a twentieth of whatever hit you. Against something enormous that is a real wound; against something small it is a tap. The bigger they are, the more their own weight costs them." },
  { id: "champ_bell",    name: "Saved by the Bell",  icon: "🔔", kind: "age", value: 33, label: "once under 33%: cut round, +33 HP", desc: "Once per battle, the moment you're driven under a third, the bell rings early — the exchange is cut short and 33 comes back in the corner." },
];
const DEMON_ABILITIES = [
  { id: "demon_pact",   name: "Blood Pact",     icon: "🩸", kind: "age", value: 66, label: "66 dmg, costs 22 own HP",   desc: "Power borrowed from the void is never free — 66 damage, 22 paid in your own blood." },
  { id: "demon_howl",   name: "Void Howl",      icon: "😈", kind: "age", value: 0,  label: "enemy loses 2 Power 3t",    desc: "A howl from beneath the five — the enemy's strength drains for three turns." },
  { id: "demon_chains", name: "Dragging Chains", icon: "⛓️", kind: "age", value: 0,  label: "enemy Speed -3 for 2t",     desc: "What fell with Toro reaches up. Chains around the ankles, two turns long." },
  { id: "demon_feast",  name: "Feast of Embers", icon: "🔥", kind: "age", value: 44, label: "44 dmg + heal 44 on KO",    desc: "Deals 44 — and if it fells the target, the demon feasts and heals the same." },
];
const ARCHANGEL_ABILITIES = [
  { id: "arch_descent", name: "Waterfall Descent", icon: "🕊️", kind: "age", value: 77, label: "77 dmg from above, can't miss", desc: "Down the cosmic waterfall at full song — 77 damage that no footwork escapes." },
  { id: "arch_choir",   name: "Choir Shield",      icon: "🎶", kind: "age", value: 77, label: "+77 shield once",               desc: "A wall of song. Once per battle, 77 points of it." },
  { id: "arch_mercy",   name: "Higher Mercy",      icon: "🕊️", kind: "age", value: 0,  label: "cleanse all debuffs, heal 33",  desc: "Everything the war stuck to you comes off, and 33 HP returns with the light." },
];
// 🕳️ THE DEEP 7 — PLACEHOLDER KIT. These three exist so a granted card is
// never blank during a story shoot; they are NOT final. The Deep 7's real
// powers are yours to write before the age opens, and rewriting this array is
// the only change required — nothing else in the engine depends on the names.
const DEEP7_ABILITIES = [
  { id: "deep_pressure", name: "Pressure",        icon: "🕳️", kind: "age", value: 22,  label: "enemy takes 22 every round",   desc: "Nothing down there has to strike you. The weight of it is the attack." },
  { id: "deep_grip",     name: "Abyssal Grip",    icon: "🌊", kind: "age", value: 155, label: "155 dmg, ignores shields",     desc: "Something reaches up through every guard ever raised and simply takes hold." },
  { id: "deep_dark",     name: "The Long Dark",   icon: "🌑", kind: "age", value: 0,   label: "enemy -5 Speed for 3 rounds",  desc: "Seven billion years of falling taught it patience. It slows the world to match." },
];

const AGE_ABILITY_POOLS = {
  champion_s1: CHAMPION_ABILITIES,
  champion_s2: CHAMPION_ABILITIES,
  demon: DEMON_ABILITIES,
  archangel: ARCHANGEL_ABILITIES,
  deep7: DEEP7_ABILITIES,
};

export function ageAbilityFor(ageCard, rng) {
  const pool = AGE_ABILITY_POOLS[ageCard];
  if (!pool) return null;
  const idx = Math.floor((rng ? rng() : 0) * pool.length) % pool.length;
  return { ...pool[idx] };
}

function pickGodAbility(name, rng) {
  if (name && GOD_OVERRIDES[name]) return { ...GOD_OVERRIDES[name] };
  const pool = GOD_ABILITY_POOL;
  const idx = Math.floor(rng() * pool.length) % pool.length;
  return { ...pool[idx] };
}

// Deterministic hash from a string -> unsigned 32-bit int (FNV-1a).
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
// Four elements, deterministic from the mascot's identity. The type-advantage
// triangle drives battle AND (v2) maps to the four lower universes of the
// Pentaverse: Fire→Ignivar, Water→Abyssia, Earth→Terravok, Air→Zephyrion.
const ELEMENTS = [
  { id: "Fire",  icon: "🔥", color: "#FF5A3C", beats: "Earth" },
  { id: "Water", icon: "💧", color: "#3CA9FF", beats: "Fire" },
  { id: "Earth", icon: "🌍", color: "#B98A3C", beats: "Air" },
  { id: "Air",   icon: "💨", color: "#9FE6FF", beats: "Water" },
];

function resolveElement(seed, lockedElementId) {
  if (lockedElementId) {
    const found = ELEMENTS.find((e) => e.id === lockedElementId);
    if (found) return found;
  }
  const r = seededRandom(seed ^ 0x9e3779b9)();
  return ELEMENTS[Math.floor(r * ELEMENTS.length) % ELEMENTS.length];
}

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
const TIER_ORDER = ["Common", "Rare", "Epic", "Legendary", "Super Legendary"];

const TIER_BONUS = {
  Common: 0,
  Rare: 1,
  Epic: 2,
  Legendary: 3,
  "Super Legendary": 3, // nominal — god stats are OVERRIDDEN to 10s below
};

const TIER_EFFECT_SLOTS = {
  Common: 0,
  Rare: 0,
  Epic: 1,
  Legendary: 2,
  "Super Legendary": 3,
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

function toRating(raw, min, max) {
  if (max === min) return 4;
  const scaled = 1 + ((raw - min) / (max - min)) * 6;
  return Math.max(1, Math.min(7, Math.round(scaled)));
}

function clampBase(v) {
  return Math.max(1, Math.min(7, v));
}

function applyBonus(base, bonus) {
  return Math.max(1, base + bonus); // no upper clamp — a maxed Legendary reads 10
}

/**
 * Computes battle stats for a character from its traits.
 *
 * @param {object} traits - { archetypes, vibes, worlds, colors, accessories,
 *   aura, element?, characterName? }
 *   • element: pass the LOCKED element id (e.g. from minted metadata) to honor
 *     it instead of re-deriving. Optional — derivation is deterministic anyway.
 *   • characterName: used ONLY for god-ability lookup (Super Legendary). It is
 *     deliberately EXCLUDED from the identity seed so that passing it never
 *     shifts an existing mascot's element, variance, or ability rolls.
 * @param {string|null} tier - assigned by the mint-time rarity roll
 *   ("Common"|"Rare"|"Epic"|"Legendary"|"Super Legendary"). null = preview.
 */
export function computeStats(traits, tier = null, markedBy = null, ageCard = null) {
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

  const [rp, rh, rs, rx] = acc;
  const basePower = clampBase(toRating(rp, 0, 70));
  const baseHp = clampBase(toRating(rh, 0, 70));
  const baseSpeed = clampBase(toRating(rs, 0, 68));
  const baseSpecial = clampBase(toRating(rx, 0, 70));

  const validTier = TIER_ORDER.includes(tier) ? tier : null;
  const isGod = validTier === GOD_TIER;
  const bonus = validTier ? TIER_BONUS[validTier] : 0;

  // 🕳️ PRIMAL — the Deep 7 alone among age cards is stat-maxed like a god.
  // HP is not enough on its own: an age card otherwise carries MORTAL stats
  // (power/special around 5 against a god's 10), so a 1,555 HP Deep 7 with
  // mortal output loses to a 888 HP god badly. Maxing the stats is what makes
  // the ceiling real. It still stops short of a full god — the Deep 7 get a
  // god's raw numbers and both super-rare effects, but NO unique god ability
  // and NO Undying. That gap is exactly why a PAIR of gods still beats one.
  const primal = ageCard === "deep7";
  const maxed = isGod || primal;

  // Gods and the Deep 7 are maxed outright. Everything else: base + tier bonus.
  const power = maxed ? GOD_STAT : applyBonus(basePower, bonus);
  const hp = maxed ? GOD_STAT : applyBonus(baseHp, bonus);
  const speed = maxed ? GOD_STAT : applyBonus(baseSpeed, bonus);
  const special = maxed ? GOD_STAT : applyBonus(baseSpecial, bonus);

  // ---- Per-character deterministic variance --------------------------------
  // IDENTITY NOTE: characterName is intentionally NOT part of this identity
  // string (it never was in practice) — keeping it out guarantees that adding
  // the name for god lookups does not change any existing mascot's seed,
  // element, variance, or ability picks.
  const identity = [
    t.name || "",
    (t.archetypes || []).join(","),
    (t.vibes || []).join(","),
    (t.worlds || []).join(","),
    (t.colors || []).join(","),
    (t.accessories || []).join(","),
    t.aura || "",
  ].join("|");
  const seed = hashString(identity || "mascot");
  const rng = seededRandom(seed);

  const element = resolveElement(seed, t.element);

  const variance = 0.85 + rng() * 0.30;

  // Gods get a fixed 333 Battle HP — above every possible mortal roll.
  const godName = t.characterName || t.name || "";
  // God-Marked mortals carry +77 Battle HP. Gods are already raid-tier and
  // cannot be marked — nobody lends power to someone who has more of it.
  const godMarked = !isGod && markedBy != null;
  // Age cards REPLACE the rolled Battle HP with the age's fixed number
  // (Champion 333 · Demon 666 · Archangel 777). A God-Mark still adds its +77
  // on top — both are collectible, both should show.
  const validAge = !isGod && ageCard && AGE_CARDS[ageCard] ? ageCard : null;
  const hpPoints = isGod
    ? (GOD_HP_OVERRIDES[godName] || GOD_HP)
    : validAge
    ? AGE_CARDS[validAge].hp + (godMarked ? MARK_HP_BONUS : 0)
    : Math.round((60 + hp * 14) * variance) + (godMarked ? MARK_HP_BONUS : 0); // ~70..230+

  const atkScale = (0.6 + (power + special) / 20) * variance;
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
    } else if (eff.kind === "god") {
      label = eff.label || "divine";
    } else {
      label = eff.desc.split(".")[0];
    }
    return { id: eff.id, name: eff.name, icon: eff.icon, kind: eff.kind, value, label: eff.kind === "god" ? (eff.label || label) : label, desc: eff.desc };
  };

  // Two signatures, deterministically chosen from the common pool.
  const signatures = seededPick(COMMON_EFFECTS, 2, rng).map(scaleEffect);

  // ---- Extra abilities by tier ---------------------------------------------
  const abilities = [];
  let markAbility = null;
  let godAbility = null;

  if (isGod) {
    // Gods: 2 rare effects + BOTH super-rare effects + their unique god power.
    abilities.push(...seededPick(RARE_EFFECTS, 2, rng).map(scaleEffect));
    abilities.push(...SUPER_RARE_EFFECTS.map(scaleEffect));
    godAbility = pickGodAbility(t.characterName || t.name || "", rng);
    abilities.push(godAbility);
  }
  // 🕳️ Deep 7 — a god's numbers and both super-rare effects, but no god
  // ability and no Undying. Deliberately one rung short of divinity.
  if (primal && !isGod) {
    abilities.push(...seededPick(RARE_EFFECTS, 2, rng).map(scaleEffect));
    abilities.push(...SUPER_RARE_EFFECTS.filter((e) => e.kind !== "revive").map(scaleEffect));
  }
  if (godMarked) {
    markAbility = markAbilityFor(markedBy);
    abilities.push(markAbility);
  } else {
    if (validTier === "Rare" || validTier === "Epic" || validTier === "Legendary") {
      abilities.push(...seededPick(RARE_EFFECTS, 1, rng).map(scaleEffect));
    }
    if (validTier === "Epic") {
      abilities.push(...seededPick(EPIC_PASSIVES, 1, rng).map(scaleEffect));
    }
    if (validTier === "Legendary") {
      const secondRare = seededPick(RARE_EFFECTS.filter((e) => !abilities.some((a) => a.id === e.id)), 1, rng).map(scaleEffect);
      abilities.push(...secondRare);
      if (rng() < 0.33) {
        abilities.push(...seededPick(SUPER_RARE_EFFECTS, 1, rng).map(scaleEffect));
      }
    }
  }

  // Age ability — one per age card, deterministic from the identity seed.
  let ageAbility = null;
  if (validAge) {
    // Champions carry Giant-Slayer intrinsically, THEN roll one of the three.
    if (validAge === "champion_s1" || validAge === "champion_s2") {
      abilities.push({ ...CHAMPION_INTRINSIC });
    }
    ageAbility = ageAbilityFor(validAge, rng);
    if (ageAbility) abilities.push(ageAbility);
  }

  // ---- Raid-tier move overrides --------------------------------------------
  // Force this god's numeric moves to their flat raid value. Passives keep
  // their own tuning (the battle engine drives those separately).
  // 🕳️ Deep 7 — flat 133 on every numeric move. This, not HP, is the lever
  // that puts them over Toro and Gravel: an age card's moves otherwise scale
  // off mortal effect values, so 1,555 HP with ~88 damage still loses to a
  // god hitting for 177. Measured at 133: a Deep 7 beats Toro 59% of the time
  // and Gravel 50% — slightly over, exactly as intended — while Toro AND
  // Gravel TOGETHER beat one 52%, and any three gods beat one 88%. One is
  // above the pantheon; a clan is above one. That asymmetry is the argument.
  if (primal && !isGod) {
    for (const m of [...signatures, ...abilities]) {
      if (m.kind === "damage") { m.value = DEEP7_MOVE; m.label = `${DEEP7_MOVE} dmg`; }
      else if (m.kind === "shield" || m.kind === "heal") { m.value = DEEP7_MOVE; }
    }
  }
  if (isGod && GOD_MOVE_OVERRIDES[godName]) {
    const forced = GOD_MOVE_OVERRIDES[godName];
    const raidScale = (m) => {
      if (m.kind === "damage") { m.value = forced; m.label = `${forced} dmg`; }
      else if (m.kind === "shield") { m.value = forced; m.label = `+${forced} shield`; }
      else if (m.kind === "heal") { m.value = forced; m.label = `+${forced} HP`; }
      return m;
    };
    signatures.forEach(raidScale);
    abilities.forEach(raidScale);
  }

  // Viral-moment commemorative ability (weak, cosmetic-leaning).
  if (t.viralMoment) {
    const momentName = typeof t.viralMoment === "string" && t.viralMoment.length > 1
      ? t.viralMoment.slice(0, 24)
      : "Viral Echo";
    const viralDmg = 10 + Math.round(rng() * 8);
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

  // Legacy signatureMove field (highest-stat flavor) for compatibility.
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
    element,
    signatureMove,
    signatures,
    abilities,
    godAbility,            // NEW: the god's unique power (null for mortals)
    markAbility,           // NEW: the borrowed power of a God-Marked mortal
    ageCard: validAge,     // ⏳ which age this card belongs to (null for none)
    ageAbility,            // ⏳ the age's granted ability
    godMarked,             // NEW: true if one of the Twelve marked them
    markedBy: godMarked ? Number(markedBy) : null,
    isGod,                 // NEW: convenience flag for the UI
    hasSuperRare: abilities.some((a) => a.kind === "banish" || a.kind === "revive" || a.kind === "god"),
    tier: validTier,
    tierBonus: isGod ? 0 : bonus,
    effectSlots: validTier ? TIER_EFFECT_SLOTS[validTier] : 0,
  };
}

/**
 * Formats computed stats as NFT metadata attributes (Solana/Metaplex standard).
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
  if (stats.godMarked) {
    attrs.push({ trait_type: "God-Marked", value: `Throne ${stats.markedBy}` });
    if (stats.markAbility) attrs.push({ trait_type: "Borrowed Power", value: stats.markAbility.name });
  }
  if (stats.godAbility) {
    attrs.push({ trait_type: "God Ability", value: stats.godAbility.name });
  }
  if (stats.ageCard && AGE_CARDS[stats.ageCard]) {
    attrs.push({ trait_type: "Age", value: AGE_CARDS[stats.ageCard].name });
    if (stats.ageAbility) attrs.push({ trait_type: "Age Ability", value: stats.ageAbility.name });
  }
  return attrs;
}

export { TIER_ORDER, TIER_BONUS, TIER_EFFECT_SLOTS };
