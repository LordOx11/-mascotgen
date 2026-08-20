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
const DEEP7_MOVE = 115;        // flat move value — see GOD_MOVE_OVERRIDES note

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
  champion_s1:  { icon: "⚜️", name: "Champion — Season 1", hp: 333,  supply: 333 },
  champion_s2:  { icon: "⚜️", name: "Champion — Season 2", hp: 333,  supply: 333 },
  demon:        { icon: "😈", name: "Demon Age",           hp: 666,  supply: 666 },
  archangel:    { icon: "🕊️", name: "Archangel",           hp: 777,  supply: 1111 },

  // ---- Unreleased age. Milestone and odds live in api/open-pack.js. -------
  deep_legion:  { icon: "⚔️", name: "The Deep Legion",     hp: 1111, supply: 2222 },

  // Unreleased. Twelve total: nine public, three studio-reserved.
  watcher:      { icon: "👁️", name: "Watcher of the Portal", hp: 1222, supply: 9 },
  watcher_prime:{ icon: "👁️", name: "Watcher — the Three",   hp: 1313, supply: 3 },

  // Unreleased.
  // ---- ⚜️ CHAMPIONS S3 · THE GRAND CUT (mint 333,333) ---------------------
  // 3,333 of them — ten times either earlier season — as the world arms itself
  // for what the Great War opened. No ladder snapshot; the whole season rolls.
  champion_s3:  { icon: "⚜️", name: "Champion — The Grand Cut", hp: 333, supply: 3333 },

  // ---- Unreleased ages. Supply and HP only; nothing here is public yet. ---
  deep7:        { icon: "🕳️", name: "The Deep 7 — The Vestibule",      hp: 1555, supply: 777 },
  deep6:        { icon: "📉", name: "The Recorders — Falling Archive",  hp: 1666, supply: 666 },
  deep5:        { icon: "☸️", name: "The Ophan — Wheel Orchard",        hp: 1777, supply: 555 },
  deep4:        { icon: "🎶", name: "The Unsung — Drowned Choir",       hp: 1888, supply: 444 },
  deep3:        { icon: "🧩", name: "The Discards — House Unmade",      hp: 1999, supply: 333 },
  deep2:        { icon: "🌑", name: "The Elder Dark — The Antechamber", hp: 2222, supply: 222 },
  // Unreleased. Studio only. THE BOTTOM OF EVERYTHING — and the last card that
  // will ever be revealed. Node 1 is where the Old One was born and where it
  // began the climb that ended with the Overthrone. Corrected 20 Aug 2026: this
  // slot previously read "The Gardener — The Seed", which put the Gardener at
  // the root of the tree. The Gardener never held a node — it held the seat
  // ABOVE node 12, it was displaced, and where it went is a question that is
  // never answered. Supply 12: one for each layer the Old One climbed.
  deep1:        { icon: "🌑", name: "The Old One — The First Dark",     hp: 3333, supply: 12 },

  // Unreleased. Display name flips at the milestone via revealAgeCard().
  deep7_seed:   { icon: "⏳", name: "The Unnamed",          hp: 1555, supply: 3 },
};

// Ages whose true identity is withheld until a later milestone. The engine
// treats them normally; only the DISPLAY name changes on reveal.
export const AGE_REVEALS = {
  deep7_seed: { at: 333333, icon: "🕳️", name: "The Deep 7 — Seed" },
};
// Pass the live lifetime mint count (the client already has it as
// totals.mints) to get the card's current public identity.
export function revealAgeCard(key, totalMints) {
  const base = AGE_CARDS[key];
  if (!base) return null;
  const r = AGE_REVEALS[key];
  if (r && typeof totalMints === "number" && totalMints >= r.at) {
    return { ...base, icon: r.icon, name: r.name, revealed: true };
  }
  return { ...base, revealed: false };
}

// ---- ⚙️ THE AGE-ABILITY ENGINE ---------------------------------------------
// Age abilities used to be hand-written branches in battle.js, which capped
// each age at 3-4 shared powers — with 666 demons that meant ~166 cards to a
// name. They are DATA now: every ability declares an `op` the arena knows how
// to execute, so growing a pool costs one array entry and no engine work.
//
// OPS (all understood by battle.js):
//   { t:"hit",     dmg, pierce?, unavoidable?, selfCost?, healOnKo?, when? }
//   { t:"heal",    amount }
//   { t:"shield",  amount }
//   { t:"drain",   stat:"power"|"speed", amount, rounds }
//   { t:"stun" }
//   { t:"cleanse", heal }
//   { t:"tick",    dmg }                  every round, passive
//   { t:"counter", pct }                  on being hit, % of ATTACKER max HP
//   { t:"resolve", below, mult }          damage multiplier under a HP fraction
//   { t:"bell",    below, heal }          once, when driven under a fraction
//   { t:"execute", below, mult }          damage multiplier vs a hurt target
//   { t:"leech",   pct }                  heal a % of damage dealt
// `once:true` limits an active op to one use per battle; `freq` is how often
// it is chosen when several are available.
const ONCE = { once: true };

const CHAMPION_INTRINSIC = {
  id: "champ_giant", name: "Giant-Slayer", icon: "⚜️", kind: "age", value: 0,
  label: "dmg scales vs bigger foes (max 1.5x)",
  desc: "Trained on things larger than itself. Damage scales with how far the enemy's HP bar outreaches your own, up to half again — and does nothing whatsoever to anything smaller than you.",
};

// ⚜️ CHAMPIONS — 333 HP, combat-sports blooded, built to punch upward.
const CHAMPION_ABILITIES = [
  { id: "champ_resolve", name: "Champion's Resolve", icon: "⚜️", kind: "age", label: "below 33% HP: dmg +50%",       op: { t: "resolve", below: 0.33, mult: 1.5 },        desc: "Backed into the corner where champions are made — under a third of HP, every strike lands a third harder." },
  { id: "champ_counter", name: "Ring Counter",       icon: "🥊", kind: "age", label: "counter 8% of attacker HP", op: { t: "counter", pct: 0.075 },                      desc: "Answer every blow instantly for a twentieth of whatever hit you. The bigger they are, the more their own weight costs them." },
  { id: "champ_bell",    name: "Saved by the Bell",  icon: "🔔", kind: "age", label: "once under 33%: cut round, +50 HP", op: { t: "bell", below: 0.33, heal: 50 },            desc: "Once per battle, the moment you're driven under a third, the bell rings early — the exchange is cut short and health comes back in the corner." },
  { id: "champ_body",    name: "Body Work",          icon: "🫀", kind: "age", label: "3 hits of 50",                     op: { t: "hit", dmg: 50, times: 3, freq: 0.4 },        desc: "Nobody wins a title headhunting. Three to the ribs and the legs stop answering in round nine." },
  { id: "champ_second",  name: "Second Wind",        icon: "🌬️", kind: "age", label: "once: heal 166",                   op: { t: "heal", amount: 166, ...ONCE, when: 0.45 },   desc: "The corner works fast, the swelling goes down, and a fighter everyone had written off comes off the stool clear-eyed." },
  { id: "champ_read",    name: "Reading the Feet",   icon: "👣", kind: "age", label: "enemy -6 speed for 3 rds",      op: { t: "drain", stat: "speed", amount: 6, rounds: 3, ...ONCE }, desc: "Watch the feet, never the hands. Ten seconds in, a champion already knows where you'll be standing." },
  { id: "champ_clinch",  name: "The Clinch",         icon: "🤼", kind: "age", label: "once: enemy loses a turn",         op: { t: "stun", ...ONCE, when: 0.35 },                desc: "Tie them up, lean the weight in, and let the round burn. Ugly, legal, and it wins fights." },
  { id: "champ_finish",  name: "Killer Instinct",    icon: "🎯", kind: "age", label: "+75% dmg vs targets under 40%",    op: { t: "execute", below: 0.4, mult: 1.75 },           desc: "Every real champion has the same tell: the moment they smell it, the pace doubles and it is already over." },
  { id: "champ_heart",   name: "All Heart",          icon: "❤️‍🔥", kind: "age", label: "heal 15% of damage dealt",      op: { t: "leech", pct: 0.225 },                         desc: "Doesn't feel it until the walk back to the locker room. Runs on the crowd and something meaner underneath." },
];

// 😈 DEMON AGE — 666 HP, the deepest kit in the mortal ladder.
const DEMON_ABILITIES = [
  { id: "demon_pact",   name: "Blood Pact",       icon: "🩸", kind: "age", label: "41 dmg, costs 22 own HP",  op: { t: "hit", dmg: 41, selfCost: 22, freq: 0.4 },              desc: "Power borrowed from the void is never free — every strike is paid for in your own blood." },
  { id: "demon_howl",   name: "Void Howl",        icon: "😈", kind: "age", label: "enemy -1 power for 3 rds", op: { t: "drain", stat: "power", amount: 1, rounds: 3, ...ONCE }, desc: "A howl from beneath the five — the enemy's strength drains for three rounds." },
  { id: "demon_chains", name: "Dragging Chains",  icon: "⛓️", kind: "age", label: "enemy -2 speed for 2 rds", op: { t: "drain", stat: "speed", amount: 2, rounds: 2, ...ONCE }, desc: "What fell with Toro reaches up. Chains around the ankles, two rounds long." },
  { id: "demon_feast",  name: "Feast of Embers",  icon: "🔥", kind: "age", label: "27 dmg + heal 44 on KO",   op: { t: "hit", dmg: 27, healOnKo: 44, freq: 0.35 },             desc: "A strike that pays for itself — if it fells the target, the demon feasts on the fall and heals." },
  { id: "demon_maw",    name: "The Long Maw",     icon: "🦷", kind: "age", label: "heal 25% of damage dealt", op: { t: "leech", pct: 0.155 },                                  desc: "Whatever it opens, it drinks. A demon at full health has usually just finished someone." },
  { id: "demon_brand",  name: "Brand of the Pit", icon: "🔻", kind: "age", label: "enemy takes 11 per round", op: { t: "tick", dmg: 11 },                                     desc: "A mark burned into the meat that keeps burning after the demon walks away." },
  { id: "demon_rend",   name: "Rend",             icon: "🩻", kind: "age", label: "55 dmg, ignores shields",  op: { t: "hit", dmg: 55, pierce: true, freq: 0.3 },              desc: "Guards are for things that attack the outside." },
  { id: "demon_smoke",  name: "Sulphur Smoke",    icon: "🌫️", kind: "age", label: "once: enemy loses a turn", op: { t: "stun", ...ONCE, when: 0.4 },                          desc: "The air goes yellow and thick, and for one long moment nobody can find anybody." },
  { id: "demon_glut",   name: "Glutton's Due",    icon: "🍖", kind: "age", label: "+37% dmg vs targets under 40%", op: { t: "execute", below: 0.4, mult: 1.37 },                     desc: "Patient right up until you bleed. Then not." },
  { id: "demon_scorn",  name: "Scorn",            icon: "💢", kind: "age", label: "counter 2% of attacker HP", op: { t: "counter", pct: 0.025 },                                desc: "It does not dodge. It resents, and resentment costs you something every time you swing." },
];

// 🕊️ ARCHANGELS — 777 HP, 1,111 of them, the answer heaven sent.
const ARCHANGEL_ABILITIES = [
  { id: "arch_descent", name: "Waterfall Descent", icon: "🕊️", kind: "age", label: "116 dmg, cannot be stopped", op: { t: "hit", dmg: 116, unavoidable: true, freq: 0.45 },      desc: "Down the cosmic waterfall at full song — damage that no footwork escapes and no shield answers." },
  { id: "arch_choir",   name: "Choir Shield",      icon: "🎶", kind: "age", label: "+116 shield once",            op: { t: "shield", amount: 116, ...ONCE, when: 0.7 },          desc: "A wall of song, raised once and only once." },
  { id: "arch_mercy",   name: "Higher Mercy",      icon: "🕊️", kind: "age", label: "cleanse all debuffs, +50 HP", op: { t: "cleanse", heal: 50, ...ONCE },                      desc: "Everything the war stuck to you comes off, and health returns with the light." },
  { id: "arch_verdict", name: "The Verdict",       icon: "⚖️", kind: "age", label: "166 dmg, ignores shields",   op: { t: "hit", dmg: 166, pierce: true, freq: 0.3 },          desc: "Not an attack. A finding, delivered." },
  { id: "arch_vigil",   name: "Standing Vigil",    icon: "🔆", kind: "age", label: "heal 33 every round",        op: { t: "tick", dmg: -33 },                                  desc: "Has not slept since the barrier went up and does not intend to start now." },
  { id: "arch_name",    name: "Spoken Name",       icon: "📯", kind: "age", label: "once: enemy loses a turn",   op: { t: "stun", ...ONCE, when: 0.4 },                        desc: "Says the thing's real name out loud. Whatever it was about to do, it forgets." },
  { id: "arch_wings",   name: "Six Wings",         icon: "🪶", kind: "age", label: "enemy -6 speed for 3 rds", op: { t: "drain", stat: "speed", amount: 6, rounds: 3, ...ONCE }, desc: "Four of them are not for flying. Whatever they are for, the ground gets further away." },
  { id: "arch_temper",  name: "Tempered Wrath",    icon: "🗡️", kind: "age", label: "below 40% HP: dmg +60%",  op: { t: "resolve", below: 0.4, mult: 1.6 },                  desc: "Patience is a discipline, not a nature. Cut deep enough and you meet the nature." },
  { id: "arch_grace",   name: "Borrowed Grace",    icon: "✨", kind: "age", label: "once: heal 232",             op: { t: "heal", amount: 232, ...ONCE, when: 0.45 },          desc: "Not its own. Given back the moment the fight ends, and never asked for twice." },
];

// ⚔️ THE DEEP LEGION — 1,111 HP, 2,222 strong. Purgatory's seventh level,
// walking in daylight for the first time since the fall.
const LEGION_ABILITIES = [
  { id: "leg_breach",  name: "Breach",             icon: "⚔️", kind: "age", label: "126 dmg, ignores shields",  op: { t: "hit", dmg: 126, pierce: true, freq: 0.35 },          desc: "They came through a wall that was built to hold something worse. A shield is a rounding error." },
  { id: "leg_siege",   name: "Siege Weight",       icon: "🏚️", kind: "age", label: "enemy takes 27 per round",  op: { t: "tick", dmg: 27 },                                   desc: "An army does not duel. It arrives, and stays, and the ground gives out." },
  { id: "leg_marrow",  name: "Marrow Draught",     icon: "🦴", kind: "age", label: "heal 30% of damage dealt",  op: { t: "leech", pct: 0.285 },                                 desc: "A thousand years with nothing to eat but each other taught them where the good parts are." },
  { id: "leg_thousand",name: "Thousand-Year Grudge",icon: "🕯️", kind: "age", label: "below 40% HP: dmg +52%", op: { t: "resolve", below: 0.4, mult: 1.52 },                 desc: "It has had a very long time to think about this, and it thought about nothing else." },
  { id: "leg_yoke",    name: "The Yoke",           icon: "🪝", kind: "age", label: "enemy -3 power for 4 rds", op: { t: "drain", stat: "power", amount: 3, rounds: 4, ...ONCE }, desc: "The chains they wore for a millennium came out with them, and they know exactly how to fit them." },
  { id: "leg_toll",    name: "The Toll",           icon: "💀", kind: "age", label: "147 dmg, costs 44 own HP",   op: { t: "hit", dmg: 147, selfCost: 44, freq: 0.35 },         desc: "Everything out of the deep is paid for. They stopped minding the price somewhere around year eight hundred." },
  { id: "leg_banner",  name: "Black Banner",       icon: "🏴", kind: "age", label: "once: enemy loses a turn",   op: { t: "stun", ...ONCE, when: 0.4 },                        desc: "The colours go up and something very old in the blood says *lie down*." },
  { id: "leg_gate",    name: "Gate-Wide",          icon: "🚪", kind: "age", label: "3 hits of 52",               op: { t: "hit", dmg: 52, times: 3, freq: 0.35 },              desc: "They did not come through one at a time." },
  { id: "leg_rot",     name: "Rot of the Seventh", icon: "🪱", kind: "age", label: "enemy -5 speed for 3 rds", op: { t: "drain", stat: "speed", amount: 5, rounds: 3, ...ONCE }, desc: "Whatever the seventh level does to a body, it does slowly, and it does not stop when you leave." },
  { id: "leg_last",    name: "No Retreat",         icon: "🛑", kind: "age", label: "counter 6% of attacker HP",  op: { t: "counter", pct: 0.057 },                              desc: "There is nowhere behind them. That was the whole plan and it makes them very hard to move." },
];

// 👁️ THE TWELVE WATCHERS — hand-written, one per number, because only twelve
// will ever exist. Numbers 1-9 rolled to the world during the Great War
// window; 10, 11 and 12 are THE THREE and were never released.
const WATCHER_ABILITIES = [
  { id: "watch_1",  name: "First Vigil",        icon: "👁️", kind: "age", label: "heal 40 every round",         op: { t: "tick", dmg: -40 },                                   desc: "Watched the portal longer than the barrier has stood. Rest was never part of the post." },
  { id: "watch_2",  name: "Sealing Hand",       icon: "🤚", kind: "age", label: "once: enemy loses a turn",     op: { t: "stun", ...ONCE, when: 0.45 },                        desc: "The gesture that shut the gate ten thousand times. It still works on smaller things." },
  { id: "watch_3",  name: "Eyes on the Seam",   icon: "🔍", kind: "age", label: "+84% dmg vs targets under 45%", op: { t: "execute", below: 0.45, mult: 1.84 },                  desc: "Spent an age learning where a thing is weakest by staring at the one door that could not be allowed to open." },
  { id: "watch_4",  name: "Long Watch",         icon: "🌒", kind: "age", label: "enemy -7 speed for 3 rds",  op: { t: "drain", stat: "speed", amount: 7, rounds: 3, ...ONCE }, desc: "Time moves differently at the seventh level. It brought some of that out with it." },
  { id: "watch_5",  name: "Bulwark Oath",       icon: "🛡️", kind: "age", label: "+186 shield once",             op: { t: "shield", amount: 186, ...ONCE, when: 0.75 },         desc: "The oath was to hold. Nothing in it said hold for whom." },
  { id: "watch_6",  name: "Answering Fire",     icon: "🔥", kind: "age", label: "counter 8% of attacker HP",    op: { t: "counter", pct: 0.084 },                               desc: "Everything that ever tested the gate got the same reply, and none of them came back for a second." },
  { id: "watch_7",  name: "Seventh Level",      icon: "🕳️", kind: "age", label: "212 dmg, ignores shields",     op: { t: "hit", dmg: 212, pierce: true, freq: 0.35 },          desc: "Reaches down to the floor it used to guard and brings a handful of it up with the swing." },
  { id: "watch_8",  name: "Warden's Due",       icon: "⛓️", kind: "age", label: "enemy -5 power for 4 rds",  op: { t: "drain", stat: "power", amount: 5, rounds: 4, ...ONCE }, desc: "It kept things stronger than you in a box. Your strength is an administrative problem." },
  { id: "watch_9",  name: "Broken Post",        icon: "💔", kind: "age", label: "below 45% HP: dmg +79%",    op: { t: "resolve", below: 0.45, mult: 1.79 },                  desc: "Abandoning the post was the hardest thing it ever did. Everything after has been easy." },
  // ---- THE THREE (10-12) — studio only, and the strongest of the twelve. ---
  { id: "watch_10", name: "The One Who Opened It", icon: "🗝️", kind: "age", label: "239 dmg, cannot be stopped", op: { t: "hit", dmg: 239, unavoidable: true, freq: 0.4 },     desc: "Twelve stood at the gate. One of them turned the key from the inside, and the other eleven found out at the same time as the five universes did." },
  { id: "watch_11", name: "The One Who Counted", icon: "🧮", kind: "age", label: "heal 40% of damage dealt",    op: { t: "leech", pct: 0.48 },                                  desc: "Kept the tally of every year without a breach. Reached a number it liked and decided that meant it was safe. It was not counting the right thing." },
  { id: "watch_12", name: "The One Still Watching", icon: "🌑", kind: "age", label: "enemy takes 53 per round", op: { t: "tick", dmg: 53 },                                    desc: "Walked out with the rest and never once turned its back to the door. Of the twelve, it is the only one that still believes the post mattered — and the only one that knows what is coming through it." },
];

// 🕳️ THE DEEP 7 — seven powers for seven of them. Placeholders in name only:
// mechanically complete, but yours to rewrite before the age opens.
const DEEP7_ABILITIES = [
  { id: "deep_pressure", name: "Pressure",       icon: "🕳️", kind: "age", label: "enemy takes 47 per round",   op: { t: "tick", dmg: 47 },                                    desc: "Nothing down there has to strike you. The weight of it is the attack." },
  { id: "deep_grip",     name: "Abyssal Grip",   icon: "🌊", kind: "age", label: "169 dmg, ignores shields",   op: { t: "hit", dmg: 169, pierce: true, freq: 0.4 },            desc: "Something reaches up through every guard ever raised and simply takes hold." },
  { id: "deep_dark",     name: "The Long Dark",  icon: "🌑", kind: "age", label: "enemy -6 speed for 3 rds", op: { t: "drain", stat: "speed", amount: 6, rounds: 3, ...ONCE }, desc: "Seven billion years of falling taught it patience. It slows the world to match." },
  { id: "deep_fall",     name: "Still Falling",  icon: "🕯️", kind: "age", label: "189 dmg, cannot be stopped", op: { t: "hit", dmg: 189, unavoidable: true, freq: 0.35 },      desc: "The dark kept giving. It is still going, and it brings some of that down with it." },
  { id: "deep_wheel",    name: "Wheel Within a Wheel", icon: "☸️", kind: "age", label: "enemy -4 power for 4 rds", op: { t: "drain", stat: "power", amount: 4, rounds: 4, ...ONCE }, desc: "Rims crowded with unblinking eyes. Whatever they settle on gets quieter." },
  { id: "deep_older",    name: "Older Than the Cord", icon: "🪢", kind: "age", label: "heal 35% of damage dealt", op: { t: "leech", pct: 0.297 },                               desc: "The waterfall ran upward for a reason and this was on the other end of it before anyone thought to ask." },
  { id: "deep_written",  name: "It Was Written", icon: "📜", kind: "age", label: "+68% dmg vs targets under 50%", op: { t: "execute", below: 0.5, mult: 1.68 },                  desc: "It did not have to break the portal. It only had to be right about the Watchers, and wait." },
];

const AGE_ABILITY_POOLS = {
  champion_s1: CHAMPION_ABILITIES,
  champion_s2: CHAMPION_ABILITIES,
  champion_s3: CHAMPION_ABILITIES,
  demon: DEMON_ABILITIES,
  archangel: ARCHANGEL_ABILITIES,
  deep_legion: LEGION_ABILITIES,
  deep7: DEEP7_ABILITIES,
  deep7_seed: DEEP7_ABILITIES,
  // Deeps 6-1 share the Deep pool until you write theirs. Each root wants its
  // own seven: the Recorders recite, the Ophan watch, the Unsung answer, the
  // Discards revise, the Elder Dark remembers, and the First Dark is where it
  // all started climbing.
  deep6: DEEP7_ABILITIES,
  deep5: DEEP7_ABILITIES,
  deep4: DEEP7_ABILITIES,
  deep3: DEEP7_ABILITIES,
  deep2: DEEP7_ABILITIES,
  deep1: DEEP7_ABILITIES,
};

// The two Watcher ages draw from the SAME twelve, sliced by number — so no two
// Watchers in existence will ever share a power.
export function ageAbilityFor(ageCard, rng, ageNumber = null) {
  if (ageCard === "watcher" || ageCard === "watcher_prime") {
    const n = Number(ageNumber);
    // watcher 1-9 → entries 0-8 · watcher_prime 1-3 → entries 9-11 (The Three)
    const idx = ageCard === "watcher_prime"
      ? 9 + (Number.isFinite(n) && n >= 1 ? Math.min(3, n) - 1 : 0)
      : (Number.isFinite(n) && n >= 1 ? Math.min(9, n) - 1 : Math.floor((rng ? rng() : 0) * 9) % 9);
    return { ...WATCHER_ABILITIES[idx] };
  }
  const pool = AGE_ABILITY_POOLS[ageCard];
  if (!pool) return null;
  const idx = Math.floor((rng ? rng() : 0) * pool.length) % pool.length;
  return { ...pool[idx] };
}

// Which age keys are stat-maxed like a god (HP alone is not enough — an age
// card otherwise carries mortal output and loses to a god it outweighs).
// Only the Deep 7 are stat-maxed like a god. The Watchers are the strongest
// DEMONS ever to hold a body — enormous HP and unique powers, but mortal
// stats. Making them primal put them over Toro at 73%, which breaks the one
// rule that cannot bend: the bull and the house are the ceiling of the known
// pantheon, and only the thing they were built to hold back goes past them.
export const PRIMAL_AGES = ["deep7", "deep7_seed", "deep6", "deep5", "deep4", "deep3", "deep2", "deep1"];

// ---- STAT FLOORS BY AGE ----------------------------------------------------
// HP alone cannot carry a rung. An age card otherwise rolls MORTAL stats
// (power/special around 5 against a god's 10), so a 1,313 HP Watcher with
// mortal output loses to Toro 88% of the time — no Great War in that. These
// floors lift each age's four stats to a minimum, producing a smooth climb
// from the mortal ladder to the Deep 7 without anyone leapfrogging.
//   ⚔️ Legion 7 · 👁️ Watcher 8 · 👁️ The Three 9 · 🕳️ Deep 7 10 (god-level)
// Champions, Demons and Archangels keep mortal stats deliberately — they are
// cards a normal collector holds, and their identity is their ability, not
// raw numbers.
export const AGE_STAT_FLOOR = {
  deep_legion: 7,
  watcher: 8,
  watcher_prime: 9,
  deep7: 10,
  deep7_seed: 10,
  deep6: 10, deep5: 10, deep4: 10, deep3: 10, deep2: 10, deep1: 10,
};


// ---- ⚜️ THE FOUNDING 333 — a mark for every founder ------------------------
// The first 333 mints in MascotGen history are all Legendary, and each one now
// carries a NAMED mark nobody else has. Thirty-three mechanics sit underneath
// the 333 names: ten founders share each mechanic, and no two share a name.
//
// WHY 33 MECHANICS AND NOT 333: the battle engine reads ONE ability-op per
// fighter, so every distinct mechanic is a distinct balance surface. Thirty-
// three can be measured; 333 cannot, and an unmeasured one is exactly the hole
// somebody farms. Every mark below was simulated 2,500 battles against a
// Champion — the win rate is in the comment, and all 33 land between 34% and
// 50%. A founder is genuinely dangerous to a Champion and still the underdog,
// which is the relationship 333 founders and 333 champions should have.
//
// NO BONUS HP, deliberately: the same marks with +33 HP measured 52-77% and
// spread out badly. The mark alone keeps the whole cohort in one tight band.
//
// The seat number is already in the database — the Founding 333 hold
// legendary_season 1-333 — so nothing new is stored and any mark can be
// verified against the chain.
const FOUNDER_MARKS = [
  { id: "f_three", icon: "🥁", label: "3 strikes of 27", op: { t: "hit", dmg: 27, times: 3, freq: 0.4 }, desc: "Three beats, always three, and the third is the one that lands where the first two were only asking." },  // 49.1%
  { id: "f_four", icon: "🌧", label: "4 strikes of 20", op: { t: "hit", dmg: 20, times: 4, freq: 0.4 }, desc: "Not one blow but weather — four of them, from four directions, until standing up straight stops being an option." },  // 49.2%
  { id: "f_twin", icon: "✌️", label: "2 strikes of 44", op: { t: "hit", dmg: 44, times: 2, freq: 0.4 }, desc: "The first one is the question. The second one is asked before the answer finishes forming." },  // 49.3%
  { id: "f_single", icon: "❗", label: "one strike of 72", op: { t: "hit", dmg: 72, freq: 0.4 }, desc: "One swing, wound all the way through it, and nothing held back for a second attempt that was never planned." },  // 42.4%
  { id: "f_pierce", icon: "🪡", label: "72 that ignores shields", op: { t: "hit", dmg: 72, pierce: true, freq: 0.4 }, desc: "Armour is a set of promises about where a blade will go. This one goes somewhere else." },  // 43.5%
  { id: "f_feast", icon: "🍖", label: "66, heals 80 on a kill", op: { t: "hit", dmg: 66, healOnKo: 80, freq: 0.4 }, desc: "Finishing someone is not the end of the work. It is the meal that pays for the next one." },  // 37.1%
  { id: "f_reply", icon: "↩️", label: "counter 6% of attacker HP", op: { t: "counter", pct: 0.06 }, desc: "Nothing here is given away. Every blow is entered in a ledger and answered before the ink dries." },  // 48.1%
  { id: "f_echo", icon: "🔊", label: "counter 9% of attacker HP", op: { t: "counter", pct: 0.09 }, desc: "Some rooms hold a sound longer than it was made. Hit anything in this one and hear it come back bigger." },  // 48.3%
  { id: "f_mirror", icon: "🪞", label: "counter 11% of attacker HP", op: { t: "counter", pct: 0.11 }, desc: "The blow lands and finds itself facing the wrong way. Whatever you brought, you brought it for yourself." },  // 49.2%
  { id: "f_ember", icon: "🔥", label: "enemy takes 16 per round", op: { t: "tick", dmg: 16 }, desc: "No blaze, no drama. A coal set somewhere warm that has never once gone out on its own." },  // 49.1%
  { id: "f_rot", icon: "🍂", label: "enemy takes 19 per round", op: { t: "tick", dmg: 19 }, desc: "Nothing was broken. Something was simply left damp, and left, and time did the rest of the work." },  // 49.3%
  { id: "f_salt", icon: "🧂", label: "enemy takes 22 per round", op: { t: "tick", dmg: 22 }, desc: "A wound that is not permitted to close. Every round it is opened again by something that isn't there." },  // 49.6%
  { id: "f_root", icon: "🌱", label: "heal 22 every round", op: { t: "tick", dmg: -22 }, desc: "Cut the top off as often as you like. The part that matters was never above the ground." },  // 39.2%
  { id: "f_tide", icon: "🌊", label: "heal 25 every round", op: { t: "tick", dmg: -25 }, desc: "The water goes out. Everyone who has not watched water before assumes that it is leaving." },  // 36.9%
  { id: "f_breath", icon: "🫁", label: "heal 30 every round", op: { t: "tick", dmg: -30 }, desc: "Never rushed, never winded, still drawing the same even breath in round nine as in round one." },  // 36.6%
  { id: "f_tithe", icon: "🧾", label: "heal 22% of damage dealt", op: { t: "leech", pct: 0.22 }, desc: "A tenth of everything, quietly, off the top. Small enough that nobody argues and it never stops." },  // 37.9%
  { id: "f_thirst", icon: "🥤", label: "heal 30% of damage dealt", op: { t: "leech", pct: 0.3 }, desc: "An old thirst that predates the water. Drinking has never once made it smaller." },  // 40.6%
  { id: "f_toll", icon: "🌉", label: "heal 38% of damage dealt", op: { t: "leech", pct: 0.38 }, desc: "Nothing crosses for free. The keeper takes a portion at the bridge and has never made an exception." },  // 42.8%
  { id: "f_scent", icon: "🦈", label: "+75% dmg vs targets under 40%", op: { t: "execute", below: 0.4, mult: 1.75 }, desc: "Something changes in the water and the whole shape of the thing changes with it." },  // 37.2%
  { id: "f_close", icon: "🚪", label: "+50% dmg vs targets under 50%", op: { t: "execute", below: 0.5, mult: 1.5 }, desc: "Last call. The pleasant part of the evening is concluded and the rest is procedure." },  // 38.5%
  { id: "f_mile", icon: "🏁", label: "+35% dmg vs targets under 60%", op: { t: "execute", below: 0.6, mult: 1.35 }, desc: "The finish comes into view and the pace changes — not out of cruelty, just because it is downhill now." },  // 49.2%
  { id: "f_corner", icon: "🧱", label: "below 33% HP: dmg +80%", op: { t: "resolve", below: 0.33, mult: 1.8 }, desc: "The wall arrives at the spine and the arithmetic simplifies: there is nowhere to go, so there is nothing to weigh." },  // 40.0%
  { id: "f_second", icon: "💨", label: "below 45% HP: dmg +50%", op: { t: "resolve", below: 0.45, mult: 1.5 }, desc: "Everything up to here was the part that was being spent. This is the part that was being kept." },  // 40.0%
  { id: "f_stand", icon: "🛡", label: "below 60% HP: dmg +30%", op: { t: "resolve", below: 0.6, mult: 1.3 }, desc: "Holds the line the way a post holds a fence — without opinion, and long after the reason is gone." },  // 43.4%
  { id: "f_wall", icon: "🪨", label: "+88 shield once", op: { t: "shield", amount: 88, once: true, when: 0.5 }, desc: "A stone put between, once, by someone who understood exactly which moment would need it." },  // 37.3%
  { id: "f_vow", icon: "🤝", label: "+116 shield once", op: { t: "shield", amount: 116, once: true, when: 0.7 }, desc: "A promise made before the world had a name, kept once, in full, at the cost it was always going to cost." },  // 44.6%
  { id: "f_door", icon: "🔒", label: "+150 shield once", op: { t: "shield", amount: 150, once: true, when: 0.6 }, desc: "The door is barred from the inside. Whatever is on the other side may knock as long as it likes." },  // 45.3%
  { id: "f_mercy", icon: "🕊", label: "once: heal 133", op: { t: "heal", amount: 133, once: true, when: 0.45 }, desc: "An hour given back that had already been spent. Nobody says who gave it, and nobody asks twice." },  // 34.0%
  { id: "f_spring", icon: "⛲", label: "once: heal 166", op: { t: "heal", amount: 166, once: true, when: 0.4 }, desc: "Water found under dry ground by someone who knew it was there, in a place that had no business holding any." },  // 34.1%
  { id: "f_wash", icon: "🧼", label: "once: clear debuffs, heal 130", op: { t: "cleanse", heal: 130, once: true, when: 0.45 }, desc: "Whatever was put on gets taken off. Curses, brands, poisons — the page is simply wiped and handed back." },  // 34.6%
  { id: "f_bell", icon: "🔔", label: "once under 33%: cut round, +15 HP", op: { t: "bell", below: 0.33, heal: 15 }, desc: "The bronze goes off early, the exchange is cut in half, and the corner gets the ten seconds it needed." },  // 49.7%
  { id: "f_stay", icon: "⏳", label: "once under 25%: cut round, +22 HP", op: { t: "bell", below: 0.25, heal: 22 }, desc: "A hand comes down on the clock. Not a rescue — a delay, granted by something with the authority to grant it." },  // 36.2%
  { id: "f_hush", icon: "🔇", label: "once: enemy loses a turn", op: { t: "stun", once: true, when: 0.5 }, desc: "Not deafness and not fear. Simply a moment in which nothing that was going to be said gets said." },  // 35.3%
];

// 333 names — index [family][variant]. Families 0-2 carry eleven because
// 333 does not divide by 33 evenly; seats 331-333 take that eleventh name.
const FOUNDER_NAMES = [
  ["Three Bells Rung", "The Triple Knock", "Drumfall", "Three Times Told", "The Third Answer", "Trip Hammer", "Thrice-Struck Iron", "Three Doors Opened", "The Triple Count", "Cadence of Three", "Three-Stroke Dawn"],
  ["Hailfall", "The Four Winds", "Quartered Sky", "Fourfold Rain", "The Scatter", "Volley of Four", "Sleet and Iron", "The Grain Storm", "Four Quick Debts", "Stitchwork", "The Fourth Wall Falls"],
  ["Two Hands Empty", "The Second Truth", "Twin Verdict", "Both Barrels", "The Pair", "Left Then Right", "Two Coins Down", "The Double Oath", "Twinned Iron", "Second Sentence", "Two Names Spoken"],
  ["One Clean Word", "The Only Swing", "Single Verdict", "First and Last", "The Whole Argument", "One Nail", "Full Stop", "The Single Stroke", "Once Is Enough", "The Last Sentence"],
  ["Needle's Path", "The Gap Between", "Threadwork", "Through the Seam", "Hairline", "The Narrow Way", "Keyhole", "Splitting the Grain", "The Thin Place", "Between the Ribs"],
  ["Harvest Rite", "The Long Table", "Fed by Falling", "Reaper's Portion", "The Second Helping", "Grave Appetite", "What the Fallen Leave", "The Feast Bell", "Carrion Grace", "Ash and Bread"],
  ["Answered in Kind", "The Reply", "Nothing Given Free", "Return Post", "The Courteous Blow", "Same Coin Back", "Reciprocal", "The Polite Correction", "Sent Back Twice", "Even Ledger"],
  ["Echo Clause", "The Long Echo", "Repeated Back", "What Rooms Remember", "Second Voice", "The Returning Sound", "Echo of Iron", "Said Again", "The Answering Wall", "Rebound"],
  ["Mirror Law", "The Glass Answer", "Reflected Debt", "Facing Pane", "The Mirror's Fee", "Your Own Hand", "Silvered Back", "What Looks Back", "The Turned Blade", "Struck by Yourself"],
  ["Slow Ember", "The Quiet Burn", "Coalwork", "Low Flame", "Smoulder", "The Patient Fire", "Bank the Coals", "Ash Creep", "The Long Warmth", "Ember Debt"],
  ["Rust Sets In", "The Slow Rot", "Creeping Blight", "What Damp Does", "Rot Clause", "The Spreading Stain", "Mildew Crown", "Slow Spoil", "The Turning", "Corruption Tax"],
  ["Salt in It", "The Open Wound", "Bleeding Ledger", "Won't Close", "Saltwork", "The Unhealed", "Weeping Seam", "Slow Leak", "The Reopened", "Brine and Iron"],
  ["Deep Root", "What Roots Do", "The Taproot", "Rooted Under", "Slow Green", "The Returning Root", "Undersoil", "Root Patience", "The Buried Spring", "Grown Back"],
  ["Tide Returns", "The Second Tide", "Highwater", "What the Sea Gives Back", "Tidal Right", "The Turning Water", "Flood Return", "Neap and Spring", "The Coming In", "Waterline Rises"],
  ["Steady Breath", "The Long Lung", "Breath Kept", "Unhurried Air", "The Calm Chest", "Breathing Room", "Second Air", "The Even Draw", "Windward Lung", "Never Winded"],
  ["The Tithe", "Small Cut Taken", "Tenth Part", "The Collector's Tenth", "Tithe Barn", "What Is Owed Up", "The Modest Cut", "Levy", "Skimmed", "The Quiet Percentage"],
  ["Old Thirst", "The Dry Mouth", "Drinks Deep", "Thirstwork", "What Drinking Costs", "The Long Draught", "Never Slaked", "Drought's Answer", "The Deep Cup", "Swallowed Whole"],
  ["The Toll Gate", "Nothing Crosses Free", "Bridge Fee", "The Keeper's Cut", "Toll and Tally", "Paid at the Crossing", "The Gate's Portion", "Passage Price", "The Standing Toll", "Crossing Debt"],
  ["Blood in the Water", "The Scent", "Knows the Smell", "Turned Predator", "What Sharks Know", "The Change in the Air", "Copper on the Tongue", "Scented Ending", "The Quickening", "Reads the Wound"],
  ["Closing Time", "The Shortening", "Last Call", "The Narrowing", "Closes the Door", "Endgame Manner", "The Final Quarter", "Shuts the Book", "The Closing Argument", "Time Called"],
  ["The Last Mile", "Downhill From Here", "The Home Stretch", "Sees the Finish", "Nothing Left to Save", "The Final Furlong", "Runs It Down", "The Closing Distance", "The Last Hundred Yards", "Already Over"],
  ["Backed to the Wall", "The Corner", "Nowhere Left", "Cornered Thing", "The Last Foot of Ground", "Wall at the Spine", "No Retreat Left", "The Tight Corner", "Boxed In", "Where It Turns"],
  ["Second Wind", "The Turn", "Finds Another Gear", "What's Left Underneath", "The Reserve", "Deeper Well", "The Held-Back Half", "Something Kept", "The Second Half", "Not Finished Yet"],
  ["Last Stand", "The Standing Order", "Holds the Line", "Won't Fall", "The Final Post", "Stood Ground", "The Held Position", "Still Standing", "The Unyielding", "Last One Up"],
  ["Stone Between", "The Raised Wall", "Bulwark", "What Walls Are For", "The Standing Stone", "Rampart", "The Interposed", "Wall Rite", "Shieldwork", "The Blocked Path"],
  ["The Vow Holds", "Sworn Guard", "Oathwall", "What Was Promised", "The Given Word", "Vow of Iron", "The Kept Oath", "Promised Shelter", "Bound to Hold", "The Standing Vow"],
  ["The Barred Door", "Nothing Comes Through", "The Sealed Way", "Door Rite", "The Shut Gate", "Held Fast", "The Bolted Hour", "What Doors Refuse", "The Closed Threshold", "Locked Against"],
  ["Small Mercy", "The Given Hour", "Granted Reprieve", "Mercywork", "The Kind Cut", "What Mercy Costs", "The Spared Moment", "Grace Allowed", "The Soft Hand", "Unearned Kindness"],
  ["The Hidden Spring", "Wellwater", "Found Water", "The Deep Well", "What Springs Do", "Sweetwater", "The Rising Spring", "Drawn From Under", "The Cold Source", "Wellspring Right"],
  ["Washed Clean", "The Clean Slate", "Salt Scrub", "What Water Takes", "The Rinsing", "Scoured", "Clean Water Rite", "The Wiped Page", "Nothing Sticks", "Purge and Draw"],
  ["The Bell Rings", "Saved by Sound", "Bronze Reprieve", "The Rung Hour", "Bell Clause", "What Bells Interrupt", "The Struck Bronze", "Called Off", "The Sounding", "Bell and Breath"],
  ["The Reprieve", "Stayed Execution", "The Late Pardon", "Time Granted", "The Stopped Hand", "Called Back", "The Given Minute", "Stay of Ruin", "The Halted Fall", "Reprieve Rite"],
  ["The Silence", "Nothing to Say", "Struck Dumb", "The Held Tongue", "Quiet Imposed", "What Silence Buys", "The Stopped Word", "Wordless Interval", "The Cut Sentence", "Mute Hour"],
];

export const FOUNDER_CAP = 333;

// Seat -> that founder's one-and-only mark. Deterministic, so the same card
// always shows the same name, on any device, forever.
export function founderMark(seat) {
  const n = Math.floor(Number(seat));
  if (!Number.isFinite(n) || n < 1 || n > FOUNDER_CAP) return null;
  const fam = (n - 1) % 33;
  const variant = Math.floor((n - 1) / 33);
  const names = FOUNDER_NAMES[fam];
  const m = FOUNDER_MARKS[fam];
  if (!names || !m) return null;
  return {
    id: `founder_${n}`, name: names[variant] || names[names.length - 1],
    icon: m.icon, kind: "age", label: m.label, desc: m.desc, op: m.op,
    founderSeat: n,
  };
}

// ---- 🗡 SIGNATURE MOVES — the canon mains -----------------------------------
// One named move per main character, matched by character name. These are
// MORTAL-scale — they use the same op vocabulary as the age abilities, sized
// so a main is dangerous to a Champion without outranking one. Each op type
// appears exactly once across the set, so every main FEELS different in the
// log, not just in the numbers.
//
// Matching is by name on purpose: if a fan mints a card named "Kragg
// Serpenthorn", they get to fight with the Serpent's Kiss. That is cosplay,
// not an exploit — the move is mortal-tier and the name is the tribute.
export const CANON_SIGNATURES = {
  luxordriftfang: { id: "sig_luxor",    name: "Redline",         icon: "🏎️", kind: "age", label: "3 nitro passes of 30",            op: { t: "hit", dmg: 30, times: 3, freq: 0.4 },          desc: "Three passes at speeds the eye files under rumor. By the third, the paint trade is personal." },
  kraggserpenthorn:{ id: "sig_kragg",   name: "Serpent's Kiss",  icon: "🗡️", kind: "age", label: "+50% dmg vs targets under 50%",   op: { t: "execute", below: 0.5, mult: 1.5 },             desc: "An assassin doesn't win fights. He ends the ones that were already lost and lets you think it was a fight." },
  janicestfu3000: { id: "sig_janice",   name: "STFU Protocol",   icon: "🔇", kind: "age", label: "once: enemy loses a turn",         op: { t: "stun", once: true, when: 0.5 },                desc: "There is a button for everything, and Janice was built around the one everybody secretly wants." },
  zyrek:          { id: "sig_zyrek",    name: "Debt Collector",  icon: "🧾", kind: "age", label: "heal 30% of damage dealt",         op: { t: "leech", pct: 0.3 },                            desc: "Every hit he lands, he keeps a percentage. He has always kept a percentage. Ask anyone who owes him." },
  dozzer:         { id: "sig_dozzer",   name: "Ground Holds",    icon: "🚜", kind: "age", label: "counter 8% of attacker HP",        op: { t: "counter", pct: 0.08 },                         desc: "You can hit Dozzer. Everyone gets to hit Dozzer once. The mistake is standing there afterward." },
  mirethnull:     { id: "sig_mireth",   name: "Null Field",      icon: "🕸️", kind: "age", label: "enemy takes 22 per round",          op: { t: "tick", dmg: 22 },                              desc: "Inside the field nothing works right — spells gutter, blades dull, and something quiet takes its toll every breath you stay." },
  seraphisvael:   { id: "sig_seraphis", name: "Heartbreaker",    icon: "💔", kind: "age", label: "below 45% HP: dmg +50%",            op: { t: "resolve", below: 0.45, mult: 1.5 },            desc: "Beautiful, unbothered, undefeated — until you finally mark that perfect face. Then you learn what the smile was holding back." },
};
export const normCanonName = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

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
// ---- ⏳ THE GENESIS ERA ----------------------------------------------------
// Cards minted BEFORE the Pentaverse was revealed carry no universe. They are
// the oldest beings in existence and no more can ever be made. Until now that
// was pure flavour with zero mechanical weight.
//
// ELDER: a Genesis card takes NO elemental disadvantage, ever, and carries
// +55 Battle HP. Fire beats Earth and Earth beats Air — but not for something
// that existed before the elements were sorted into a wheel. It is roughly a
// 20% edge in a bad matchup and nothing at all in a good one, it can never be
// farmed, it can never be minted again, and — the part that matters — it
// EXPLAINS ITSELF. A collector who reads "predates the elements" understands
// instantly why the rule exists, which is worth more than a bigger number.
export const GENESIS_HP_BONUS = 55;

export function computeStats(traits, tier = null, markedBy = null, ageCard = null, ageNumber = null, genesis = false, founderSeat = null) {
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
  const primal = PRIMAL_AGES.includes(ageCard);
  const maxed = isGod || primal;
  const floor = AGE_STAT_FLOOR[ageCard] || 0;
  const lift = (base) => Math.max(floor, applyBonus(base, bonus));

  // Gods and the Deep 7 are maxed outright. Great-War ages are lifted to their
  // floor. Everything else: base + tier bonus, exactly as before.
  const power = maxed ? GOD_STAT : lift(basePower);
  const hp = maxed ? GOD_STAT : lift(baseHp);
  const speed = maxed ? GOD_STAT : lift(baseSpeed);
  const special = maxed ? GOD_STAT : lift(baseSpecial);

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
    : Math.round((60 + hp * 14) * variance)
      + (godMarked ? MARK_HP_BONUS : 0)
      + (genesis ? GENESIS_HP_BONUS : 0);   // ⏳ Elder — see GENESIS_HP_BONUS

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
    ageAbility = ageAbilityFor(validAge, rng, ageNumber);
    if (ageAbility) abilities.push(ageAbility);
  }

  // 🗡 SIGNATURE MOVE — the canon mains fight with a named move of their own.
  // Keyed by character name, applied only when the card carries no age op
  // (an age card always outranks a signature — one op per fighter, and the
  // battle engine only ever reads the first). Numbers were tuned in the same
  // simulator as the ages: a weak-tier main now takes ~1 fight in 5 off a
  // Champion instead of being swept, an Epic main ~1 in 3, and a Legendary
  // Genesis main fights a Champion as an equal — which is what "pre-Penta
  // main character" is supposed to mean.
  const sigMove = CANON_SIGNATURES[normCanonName(t.characterName)];
  if (sigMove && !abilities.some((a) => a && a.op)) {
    abilities.push({ ...sigMove });
  }

  // ⚜️ FOUNDER'S MARK — one of the first 333 mints. Ranks BELOW an age card and
  // below a canon signature (a main character's identity outranks a seat
  // number), so a Champion who happens to be founder #7 still fights as a
  // Champion. One op per fighter, always.
  if (!abilities.some((a) => a && a.op)) {
    const fMark = founderMark(founderSeat);
    if (fMark) abilities.push(fMark);
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
