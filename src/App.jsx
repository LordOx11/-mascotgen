import React, { useState, useEffect, useRef } from "react";
import { Dice5, Sparkles, Loader2, RefreshCw, Globe, CreditCard, Save, FolderOpen, Trash2, X, Wallet } from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { mintCharacterNFT, repairNftUri, setRoyalty, createMascotGenCollection, joinCollection, burnMascotNFT, COLLECTION_ADDRESS } from "./mint.js";
import { computeStats, AGE_CARDS } from "./stats.js";

// 🔗 OFFICIAL LINKS — edit these in one place. Used by the footer and the
// anti-impersonation block. Update the X handle once the account exists.
const OFFICIAL_LINKS = {
  telegram: "https://t.me/mascotgenstudio",
  telegramHandle: "t.me/mascotgenstudio",
  x: "https://x.com/0xZangetsu",
  xHandle: "@0xZangetsu",
};

// ---- ◤ DIRECTION A · ARCADE CABINET ---------------------------------------
// Deeper, cooler surfaces than the old #14121A/#1D1A26 pair. The neon has more
// to push against, so the same brand colours read brighter without changing a
// single hex of the palette. Everything in this direction is CHROME ONLY — no
// mascot art, no SVG, no card anatomy was touched.
const INK = "#0B0912";      // page — was #14121A
const PANEL = "#161227";    // raised surface — was #1D1A26
const PANEL2 = "#100D1C";   // recessed wells (inputs, meter tracks)
const HAIRLINE = "#251F38"; // the one border colour
const LIME = "#C6FF3D";
const MAGENTA = "#FF3EA5";
const AMBER = "#FFB627";
const OFFWHITE = "#F2F0F5";
const MUTED = "#8B87A0";

// ---- THE PENTAVERSE --------------------------------------------------------
// Five universes on a five-point star. Empyrion (North) renders holographic.
// Cards minted BEFORE the Pentaverse carry no universe — the Genesis Era.
const UNIVERSE_COLORS = {
  Empyrion: "#FF9DF2", // holographic — rendered with the .holo-text class
  Ignivar: "#FF5A3C",
  Abyssia: "#3CA9FF",
  Terravok: "#B98A3C",
  Zephyrion: "#9FE6FF",
};
const UNIVERSE_ICONS = { Empyrion: "⭐", Ignivar: "🔥", Abyssia: "💧", Terravok: "🌍", Zephyrion: "💨" };

// 📡 Verse News kinds. The COLOUR is the only thing the client decides — who is
// allowed to post is decided on the server, against the wallet allowlist.
// 🪟 EVERY outbound link shares ONE named browser tab. With target="_blank" a
// browser opens a BRAND NEW tab on every single click — check a mint on
// Explorer, then Magic Eden, then Tensor, and you are three tabs deep before
// you have done anything. A named target reuses the same tab and replaces its
// contents, so the app never buries the user in tabs. rel="noopener" is kept
// everywhere for security.
const EXT_TAB = "mascotgenExternal";

// ---- ✨ WHAT'S NEW ---------------------------------------------------------
// Product changes, not canon — Verse News covers the world, this covers the app.
//
// ⚠️ IF YOU REMOVE A FEATURE, DELETE ITS LINE HERE. A changelog that still
// advertises something you took out is worse than no changelog: it sends people
// hunting for a button that isn't there. Two things keep that from rotting:
//   1. Every entry carries a DATE and anything older than NEW_MAX_AGE_DAYS
//      stops rendering on its own, so the strip can never become an archive of
//      stale claims even if nobody prunes it.
//   2. One array, one place. Deleting a feature is deleting one line.
const NEW_MAX_AGE_DAYS = 45;
const WHATS_NEW = [
  { d: "2026-08-15", t: "Saga Mode", b: "Publish chapters from different characters into ONE ordered book. Library → the purple bar." },
  { d: "2026-08-15", t: "Verse News", b: "The official broadcast, at the top of the Library. Canon announcements straight from the studio." },
  { d: "2026-08-15", t: "Read in order", b: "Origin stories are now Chapter 1, and every saga has START FROM CH. 1 plus Prev/Next." },
  { d: "2026-08-15", t: "33 new trait drawings", b: "Every archetype and accessory now renders in the live preview — and they layer in the right order." },
  { d: "2026-08-15", t: "⏳ Elder", b: "Genesis Era cards take no elemental disadvantage, ever, and carry +55 Battle HP." },
  { d: "2026-08-15", t: "🛡 Clans", b: "Found one or join one, 33 members max. The ladder ranks clans by their top ten fighters." },
];

const NEWS_KIND_COLOR = { canon: "#C6FF3D", age: "#C084FC", season: "#FF3EA5", event: "#FFB020", notice: "#8A94A6" };
// The studio wallet(s) that may broadcast. This only controls whether the
// compose box RENDERS — the server rejects anyone else regardless.
const STUDIO_WALLETS = (import.meta.env.VITE_STUDIO_WALLETS || "").split(",").map((w) => w.trim()).filter(Boolean);

// Canon rules injected into EVERY story prompt so the AI never breaks the world.
const LORE_RULES = `MASCOTGEN CANON RULES (never break these):
- THE PENTAVERSE: five universes arranged as a five-point star. EMPYRION (the North point) is the god-adjacent realm where all four elements mix. The four lower points each carry one element and oppose their parallel across the star: IGNIVAR (Fire) opposes ABYSSIA (Water), and TERRAVOK (Earth) opposes ZEPHYRION (Air).
- DEATH AND THE TIME WARP: mascots CAN die in stories, and death matters. A mascot born in the four lower universes that dies goes to PURGATORY for 1,000 years — but only 1 MINUTE passes in the living realm. A mascot born in EMPYRION that dies goes instead to rest above a colossal, brilliantly colorful cosmic waterfall beside the portal to heaven, under the same time warp (1,000 years there = 1 minute alive). Characters who return come back transformed by a millennium of experience while the living world barely noticed their absence.
- THE PRICE OF KILLING: a mascot that kills another is cursed — for every 1,000 years its victim serves, the killer may live only 1 minute of realm-time. Killing is never free.
- THE 11 GODS (Super Legendary tier): maxed beings (10/10/10/10 stats). No god sits below 888 Battle HP — above the Archangels' 777, because a god must read as a god. The seated lower-realm powers hold 999, Blaze Malpherion 1,111, and Toro Maximus and Gravel Mortis 1,333 apiece: the ceiling of the known pantheon, and nothing in circulation reaches it. 7 Good gods rule from Empyrion; 4 Evil gods each rule one lower universe — Vraxon the Unbothered rules Abyssia, Gravel Mortis rules Terravok. Treat any Super Legendary character as a god.
- THE HIDDEN TWELFTH: Aurelia the Eternal Bull — Toro Maximus's wife — is the secret 12th god, seated in Empyrion on throne #12. The world still calls the pantheon "The 11"; her throne is the truth behind the count.
- GENESIS ERA: cards minted before the Pentaverse was revealed carry no universe. They are the Genesis Era — the oldest beings in existence, predating the star itself.
- ELEMENT ADVANTAGE: Fire beats Earth, Earth beats Air, Air beats Water, Water beats Fire.
- THE GOD-MARKED: 777 mortals — and only ever 777 — carry the mark of one of the Twelve. A mark is not godhood; it is a god reaching down and lending a fraction of power to someone who was born with none. Marked characters are still mortal, still killable, still fallible. Being marked is a story: a god chose YOU, and gods do not explain themselves. What the mark costs its bearer is a fair question for any chapter to ask.
- CANON AUTHORITY (absolute): the Pentaverse's world-level story — the gods, the twelve thrones, the prophecy and its ages, the barrier, the sealed identity of the twelfth throne, and every universe-level event or reveal — belongs to MascotGen's official canon ALONE. A character's personal saga happens INSIDE that world and may brush against it: they can meet gods, defy gods, survive gods, impress gods, earn a god's mark or fury. But personal chapters may NEVER kill, depose, replace, or permanently change a god; never claim, unseal, or reveal a throne; never resolve, confirm, or expose a prophecy mystery; and never alter a world-level fact. Arena and Circuit victories over gods are sport, not succession. If a request asks for a forbidden outcome, write the closest thrilling version that leaves the world intact — a duel that ends in respect, a throne room escaped, a god who will remember their name.`;

// How chapters should SOUND — injected into every story prompt alongside the
// canon rules. Fixes the wall-to-wall epic-poetic narration: vibes now drive
// tone, dialogue is mandatory, and every chapter must breathe.
const STORY_VOICE = `NARRATIVE VOICE & PACING (as binding as the canon rules):
- LET THE CHARACTER'S VIBES DRIVE THE TELLING, not just the events. Comedic or Sarcastic vibes = real jokes, dry asides, comic timing. Zen or Enlightened = quiet beats, patience, an occasional riddle. Unhinged, Feral or Chaotic = unpredictable energy and non sequiturs. Degen = internet-brained confidence and terrible financial instincts. Royal or Stone-Cold Stoic = understatement and controlled power. Wholesome or Lovestruck = warmth and earnestness. Villainous = menace with dark wit. Adrenaline Junkie or Show-Off = swagger that sometimes writes checks it can't cash. Blend when a character has several vibes.
- PANELS ARE SCENES, NOT POEMS. At most ONE lyrical line per panel; everything else is concrete action, spoken dialogue, or plain honest feeling. If every sentence sounds like a movie trailer, rewrite it.
- DIALOGUE: characters SPEAK, in quotes, in at least half the panels — banter, complaints, jokes, trash talk, confessions.
- RANGE ACROSS THE CHAPTER: include at least one small human moment (a bad meal, a lost bet, an awkward silence, a dumb argument) and at least one emotional turn (funny to sad, tense to relieved, angry to laughing).
- GROWTH: the character learns, fails, or changes at least a little every chapter. Small character beats matter more than big explosions.
- Comedy belongs in dark chapters and sadness belongs in funny ones. Tonal range is what makes the saga feel alive.`;

// Human-readable status lines for story prompts.
const STATUS_PROMPTS = {
  alive: "Alive and active in the living realm.",
  purgatory: "DEAD — currently serving 1,000 years in Purgatory. Only 1 minute passes in the living realm before they can return, transformed by the millennium.",
  rest: "DEAD — resting above the cosmic waterfall at heaven's portal in Empyrion. 1,000 years there = 1 minute in the living realm before they can return.",
};

// Hard style enforcement appended to every art generation — kills the
// "too real / video-game CGI" drift and locks the chosen 2D style.
const STYLE_SUFFIX = {
  "Anime / Manga": "STYLE LOCK: flat cel-shaded 2D anime illustration, bold clean ink line art, vibrant flat colors, dramatic anime lighting, official anime key-art quality. STRICTLY NOT photorealistic, NOT 3D, NOT CGI, no realistic skin texture, no photography.",
  "Western Comic": "STYLE LOCK: American comic book illustration, heavy black ink outlines, flat comic colors with subtle halftone shading, dynamic splash-page composition. STRICTLY NOT photorealistic, NOT a 3D render, no CGI, no photography.",
  "Hand-Drawn Sketch": "STYLE LOCK: loose hand-drawn ink-and-pencil sketch, visible strokes and hatching, sketchbook illustration. NOT photorealistic, NOT 3D.",
  "Sticker / Chibi": "STYLE LOCK: cute chibi sticker art, super-deformed proportions, thick clean outlines, flat bright colors, 2D vector look. NOT realistic, NOT 3D.",
  "3D Render": "STYLE LOCK: stylized cartoon 3D render with playful proportions and soft clean lighting, like an animated feature film character — never uncanny, never photoreal human skin.",
  "Pixel Art": "STYLE LOCK: true retro pixel art, visible chunky pixels, limited color palette, 16-bit game sprite aesthetic. Absolutely no smooth gradients, no realism.",
};

// 🎨 COMPLEXION — cosmetic ONLY. Never enters the stat engine, never affects
// rarity. It exists because diffusion models carry demographic priors: pick
// "Braids" and FLUX will reliably draw the same kind of person every time.
// This lets the user decide instead of the model deciding for them. Ignored
// for non-humanoid mascots (a Frog has no complexion) — hence "Any".
const SKIN_TONES = [
  "Any", "Porcelain", "Fair", "Light Olive", "Golden Tan", "Warm Beige",
  "Bronze", "Deep Bronze", "Rich Brown", "Deep Ebony",
  "Not human — fur / scales / metal",
];
// Phrasing handed to the image model. Concrete words beat labels: FLUX responds
// to described skin far better than to a swatch name.
const SKIN_TONE_PROMPT = {
  Porcelain: "very fair porcelain skin with cool undertones",
  Fair: "fair light skin with warm undertones",
  "Light Olive": "light olive-toned Mediterranean skin",
  "Golden Tan": "golden tan sun-warmed skin",
  "Warm Beige": "warm beige medium skin tone",
  Bronze: "bronze brown skin with warm golden undertones",
  "Deep Bronze": "deep bronze brown skin",
  "Rich Brown": "rich dark brown skin with warm undertones",
  "Deep Ebony": "deep ebony skin with luminous highlights",
  "Not human — fur / scales / metal": "non-human hide — fur, scales, chitin or metal instead of skin",
};

// Generation languages — the AI writes ALL character text in the picked one.
const LANGUAGES = ["English", "Espa\u00f1ol", "Portugu\u00eas", "Fran\u00e7ais", "\ud55c\uad6d\uc5b4 (Korean)", "\u65e5\u672c\u8a9e (Japanese)", "\u4e2d\u6587 (Chinese)", "\u0939\u093f\u0928\u094d\u0926\u0940 (Hindi)", "\u0627\u0644\u0639\u0631\u0628\u064a\u0629 (Arabic)"];

// Rebuilds a solid art prompt from traits for mascots saved before full
// character data storage existed (older wallet-synced mints have no
// visualDescription) — so Regenerate Art always works.
// ---- 🏎️ SPORTS CAR ENGINE ------------------------------------------------
// Car mods shown in the builder when the Sports Car archetype is selected.
// They flow into accessories, so prompts, saves and stats pick them up free.
const CAR_MODS = ["Spoiler Wing", "Body Kit", "Underglow Neon", "Fog Lights", "Supercharger", "Nitro Boost", "Machine Gun Turret", "Chrome Rims", "Racing Stripes", "Butterfly Doors", "Turbo Exhaust", "Rocket Launcher", "Oil Slick Dropper", "Ramming Bumper", "Reactive Armor", "Ejector Seat", "Smoke Screen", "Hydraulics"];
// Every Sports Car mascot rolls a different real-world era + detail combo at
// generation time — 1950s classics through modern hypercars, 1000+ combos.
const CAR_ERAS = [
  "1950s chrome-finned classic roadster",
  "1960s American muscle car",
  "1970s fastback muscle coupe",
  "1980s wedge-shaped Italian-style supercar",
  "1990s Japanese street-racing coupe (JDM legend)",
  "2000s mid-engine exotic supercar",
  "2010s track-focused hypercar",
  "modern electric hypercar with active aero",
  "vintage hot rod with exposed chrome engine",
  "Le Mans-style endurance racer",
  "widebody drift machine",
  "open-wheel formula speedster",
];
const CAR_DETAILS = [
  "gleaming chrome trim",
  "scissor doors",
  "a huge rear diffuser",
  "pop-up headlights",
  "polished five-spoke wheels",
  "a carbon-fiber hood",
  "flame decals down the sides",
  "a low stance with wide fenders",
  "glowing brake discs",
  "massive air intakes",
];
function randomCarStyle() {
  const era = CAR_ERAS[Math.floor(Math.random() * CAR_ERAS.length)];
  const shuffled = [...CAR_DETAILS].sort(() => Math.random() - 0.5);
  return `a ${era} with ${shuffled[0]} and ${shuffled[1]}`;
}

function buildFallbackArtPrompt(entry) {
  const t = entry.traits || {};
  const r = entry.result || {};
  const bits = [];
  if (r.characterName) bits.push(`Character portrait of ${r.characterName}`);
  if ((t.archetypes || []).length) bits.push(`a ${t.archetypes.join(" / ")} mascot`);
  if ((t.archetypes || []).includes("Sports Car")) {
    const coPilots = (t.archetypes || []).filter((a) => a !== "Sports Car");
    bits.push(
      coPilots.length
        ? `the mascot is a ${coPilots.join(" / ")} character piloting and fused with ${randomCarStyle()}, transformers-style vehicle-character hybrid`
        : `the mascot IS ${randomCarStyle()} — a living car character with expressive headlight eyes and a face in the front grille`
    );
  }
  if (t.gender) bits.push(`${String(t.gender).toLowerCase()} presentation`);
  if (t.skinTone && t.skinTone !== "Any" && SKIN_TONE_PROMPT[t.skinTone]) bits.push(SKIN_TONE_PROMPT[t.skinTone]);
  if ((t.vibes || []).length) bits.push(`personality: ${t.vibes.join(", ")}`);
  if ((t.colors || []).length) bits.push(`color palette: ${t.colors.join(" and ")}`);
  const accs = (t.accessories || []).filter((a) => a !== t.aura);
  if (accs.length) bits.push(`wearing ${accs.slice(0, 3).join(", ")}`);
  if (t.aura && t.aura !== "None") bits.push(`surrounded by a glowing ${String(t.aura).toLowerCase()}`);
  if ((t.worlds || []).length) bits.push(`background setting: ${t.worlds[0]}`);
  if (r.tagline) bits.push(`character energy: "${r.tagline}"`);
  const style = t.artStyle || "Anime / Manga";
  return `${bits.join(", ")}. Full-body hero shot, centered, dynamic pose, ${style} art style, bold colors, clean detailed rendering, meme token mascot, no text, no watermark.`;
}

const ARCHETYPES_COMMON = ["Animal", "Dog", "Cat", "Frog", "Bear", "Hamster", "Penguin", "Food", "Plant", "Object", "Human-like", "Bird", "Fish", "Rabbit", "Mouse", "Baby", "Panther", "Goat", "Snake", "Lion"];
const ARCHETYPES_RARE = ["Ape", "Creature", "Robot", "Insect", "Blob", "Dragon", "Dino", "Slime", "Sports Car"];
const ARCHETYPES = [...ARCHETYPES_COMMON, ...ARCHETYPES_RARE];
const ALPHA_ARCHETYPES = ["Bull", "Ghost", "Zombie", "Alien", "Fighter", "Demon", "Angel", "Gargoyle"];
const VIBES_COMMON = ["Degen", "Wholesome", "Chaotic", "Heroic", "Comedic", "Corporate", "Zen", "Lovestruck", "Flirty", "FOMO", "Sarcastic", "Clumsy", "Cocky", "Sleepy", "Hyper", "Grumpy", "Curious", "Adrenaline Junkie", "Smooth Operator", "Hot-Headed", "Show-Off", "Mischievous", "Paranoid", "Loyal", "Theatrical"];
const VIBES_RARE = ["Mysterious", "Villainous", "Feral", "Royal", "Unhinged", "Sad Boi / Melancholy", "Vengeful", "Enlightened", "Rebellious", "Fearless", "Stone-Cold Stoic", "Haunted", "Ruthless"];
const VIBES = [...VIBES_COMMON, ...VIBES_RARE];
const ALPHA_VIBES = ["Superpowers", "Genius", "Brawler", "Immortal", "Warlord", "Ascendant"];
const WORLDS_COMMON = ["Space", "Fantasy", "Street Culture", "Corporate Satire", "Ocean", "Jungle", "Cyberpunk", "Wild West", "Retro Arcade", "Gym / Fitness", "Beach Paradise", "City", "Island", "Boat", "Casino", "Mountain", "Pyramids", "Zoo", "Restaurant", "Mall", "Airport", "Desert", "Forest", "Stadium", "Farm", "Snow Peaks", "Volcano", "Swamp", "Racetrack", "Nightclub", "Circus / Carnival", "Travel Train", "Skyscraper", "Subway"];
const WORLDS_RARE = ["Heaven & Clouds", "Haunted Mansion", "Las Vegas", "Post-Apocalyptic", "Underworld", "Ancient Ruins", "Floating City", "Dreamscape", "Mars Colony", "Planet", "Machine Planet", "Water Planet", "Fire Planet", "Storm Planet", "Sunken Cathedral", "Black Market"];
const WORLDS = [...WORLDS_COMMON, ...WORLDS_RARE];
const ALPHA_WORLDS = ["Boxing Ring", "Octagon Ring", "The Moon", "Crystal Planet", "Gold Planet", "The Cosmic Waterfall"];
const COLORS_COMMON = ["Neon Green", "Hot Pink", "Deep Purple", "Cyan", "Blood Red", "Electric Blue", "Toxic Orange", "Black & White", "Lavender", "Mint", "Sunset Orange", "Forest Green", "Crimson", "Sky Blue", "Turquoise", "Emerald", "Royal Blue", "Coral", "Charcoal", "Ivory", "Copper", "Neon Purple"];
const COLORS_RARE = ["Rainbow", "Chrome Silver", "Bubblegum", "Midnight Blue", "Acid Yellow", "Holographic", "Galaxy", "Rose Gold", "Sapphire", "Ruby", "Obsidian", "Pearl", "Blood Moon"];
const COLORS = [...COLORS_COMMON, ...COLORS_RARE];
const ALPHA_COLORS = ["Gold", "Platinum", "Diamond"];
const ACCESSORIES_COMMON = ["Wif Hat (Knit Beanie)", "Long Lashes", "Glam Nails", "Long Flowing Hair", "Designer Purse", "Earrings", "Basic Sneakers", "Sunglasses", "Chain", "Cape", "Headphones", "Axe", "Halo", "Devil Horns", "Cowboy Hat", "Sweater", "Shorts", "Scarf", "Backpack", "Wristband", "Bandana", "Face Mask", "Flute", "Bamboo Hand Fan", "Jersey", "Stereo", "Baseball Hat", "Nunchucks", "Chef Apron", "Police Suit", "Scrubs", "Trench Coat", "Dreadlocks", "Braids", "Durag", "Hoodie", "Mohawk", "Eyepatch", "Leather Jacket", "Beard", "Varsity Jacket", "Fanny Pack", "Ski Goggles", "Cargo Pants", "Top Hat", "Overalls", "Flip Flops", "Fishing Rod", "Toolbelt", "Denim Vest", "Bucket Hat", "Kneepads", "Messenger Bag", "Prayer Beads"];
const ACCESSORIES_RARE = ["Laser Eyes", "Diamond Hands", "Umbrella", "Rolex", "Harp", "Sword", "Katana", "Crown", "Jetpack", "Baseball Bat", "Bow & Arrow", "Shield", "Gold Grillz", "Skateboard", "Microphone", "Spiked Collar", "Trident", "Scythe", "Wizard Staff", "Grappling Hook", "Brass Knuckles", "Smoke Bombs", "Oracle Deck"];
const ACCESSORIES = [...ACCESSORIES_COMMON, ...ACCESSORIES_RARE];
const ALPHA_ACCESSORIES = ["Meme Corps Armor", "Cyber Visor", "Hype Kicks", "Guitar", "Lollipop", "Gun", "Boxing Gloves", "MMA Gloves", "Cigar", "Flaming Sword", "Angel Wings", "Cybernetic Arm", "Dragon Wings", "Plasma Cannon", "Void Gauntlet", "Seraph Blade", "Warp Boots"];
const AURAS = ["None", "Dragon Aura", "Ultimate Aura", "Blessed Aura", "Cosmic Aura", "Dark Aura"];
const ART_STYLES_COMMON = ["Hand-Drawn Sketch", "Sticker / Chibi", "3D Render", "Pixel Art"];
const ART_STYLES_RARE = ["Anime / Manga", "Western Comic"];
const ART_STYLES = [...ART_STYLES_COMMON, ...ART_STYLES_RARE];

const COLOR_HEX = {
  "Neon Green": "#C6FF3D",
  "Hot Pink": "#FF3EA5",
  Gold: "#FFB627",
  "Deep Purple": "#8B5CF6",
  Cyan: "#5EC9FF",
  "Blood Red": "#FF4D4D",
  "Electric Blue": "#3D9EFF",
  "Toxic Orange": "#FF8A3D",
  "Black & White": "#E8E8E8",
  Rainbow: "RAINBOW",
  Lavender: "#C4A7F5",
  Mint: "#7FF5C3",
  "Chrome Silver": "#C8CDD6",
  Bubblegum: "#FF9BD2",
  "Midnight Blue": "#2B3A8F",
  "Acid Yellow": "#EEFF3D",
  Platinum: "#E5E4E2",
  "Sunset Orange": "#FF7043",
  "Forest Green": "#3E9B5F",
  Crimson: "#D6224C",
  "Sky Blue": "#8FD4FF",
  Holographic: "RAINBOW",
  Galaxy: "#4B2E83",
  "Rose Gold": "#E8A9A0",
  Diamond: "#BFF3FF",
  Turquoise: "#40E0D0",
  Emerald: "#2ECC71",
  "Royal Blue": "#4169E1",
  Coral: "#FF7F50",
  Charcoal: "#36454F",
  Ivory: "#FFFFF0",
  Copper: "#B87333",
  "Neon Purple": "#B026FF",
  Sapphire: "#0F52BA",
  Ruby: "#E0115F",
  Obsidian: "#1B1B23",
  Pearl: "#EAE0C8",
  "Blood Moon": "#8A0303",
};

function Chip({ label, active, onClick, accent, dim }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-sm font-medium rounded-full border transition-all duration-150"
      style={{
        borderColor: active ? accent : HAIRLINE,
        color: active ? INK : dim ? "#5A5670" : OFFWHITE,
        backgroundColor: active ? accent : "transparent",
      }}
    >
      {label}
    </button>
  );
}

// Animated holographic lettering for Empyrion-born cards.
function HoloStyles() {
  return (
    <style>{`
      /* 📱 MOBILE: stop the whole page sliding left/right under a thumb.
         Something inside the layout is a few pixels wider than the viewport
         (a wide card, a long unbroken address), and mobile browsers happily
         let you drag the entire document to reveal it — which reads as the
         app being broken. Clamp the document width and kill horizontal
         overscroll. Panels that are SUPPOSED to scroll sideways (tab strips,
         card rails) use overflow-x-auto on themselves and are unaffected. */
      html, body {
        max-width: 100%;
        overflow-x: hidden;
        overscroll-behavior-x: none;
      }
      /* ⚠️ DO NOT put a global word-break rule on body. It cascades into the
         nav and every tight button and breaks ordinary words mid-letter
         ("Universi / ty", "Whitepap / er"). The horizontal-drag fix is the
         overflow rules above, on their own — a wrapping rule was never needed,
         because the long wallet addresses already carry break-all on the
         specific elements that hold them. */

      /* ◤ ARCADE CABINET — the retro layer. Scanlines ride above the page at
         very low opacity; they are pointer-events:none so they can never eat
         a click, and z-index keeps them under modals. */
      .crt::before{
        content:"";position:fixed;inset:0;pointer-events:none;z-index:60;
        background:repeating-linear-gradient(180deg,rgba(255,255,255,.022) 0 1px,transparent 1px 3px);
      }
      /* Numbers wear a monospace face — the cheapest arcade tell there is. */
      .mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;letter-spacing:.02em}
      /* Buttons you can feel press. */
      .btn-a{transition:transform .06s ease, box-shadow .06s ease}
      .btn-a:active{transform:translateY(2px)}
      /* A filled meter segment glows in its own colour. */
      .seg-on{box-shadow:0 0 6px currentColor}
      /* The active nav tab gets a cabinet-marquee glow. */
      .nav-on{box-shadow:0 0 18px rgba(198,255,61,.42)}

      @keyframes stageShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-7px) rotate(-1deg); } 40% { transform: translateX(6px) rotate(1deg); } 60% { transform: translateX(-4px); } 80% { transform: translateX(3px); } }
@keyframes floatDmg { 0% { opacity: 0; transform: translateY(6px) scale(0.7); } 15% { opacity: 1; transform: translateY(-4px) scale(1.15); } 100% { opacity: 0; transform: translateY(-46px) scale(1); } }
@keyframes hitFlash { 0%, 100% { box-shadow: none; } 30% { box-shadow: 0 0 0 3px rgba(255,80,80,0.9), 0 0 28px rgba(255,60,60,0.7); } }
@keyframes healPulse { 0%, 100% { box-shadow: none; } 40% { box-shadow: 0 0 0 3px rgba(80,255,140,0.8), 0 0 26px rgba(60,255,120,0.6); } }
@keyframes stageEnter { 0% { opacity: 0; transform: translateY(22px) scale(0.85); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes banishOut { 0% { opacity: 1; transform: rotate(0) scale(1); } 100% { opacity: 0; transform: rotate(540deg) scale(0); } }
@keyframes koFall { 0% { opacity: 1; transform: rotate(0); filter: grayscale(0); } 100% { opacity: 0.25; transform: rotate(8deg) translateY(10px); filter: grayscale(1); } }
@keyframes bannerPop { 0% { opacity: 0; transform: scale(0.6); } 20% { opacity: 1; transform: scale(1.08); } 80% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.04); } }
@keyframes holoShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      .holo-text {
        background: linear-gradient(90deg,#FF9DF2,#7DF9FF,#FFF3B0,#C084FC,#FF9DF2);
        background-size: 300% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: holoShift 3s linear infinite;
        font-weight: 800;
      }
    `}</style>
  );
}

function StatPanel({ stats, compact }) {
  if (!stats) return null;
  const rows = [
    { label: "PWR", value: stats.power, color: "#FF4D4D" },
    { label: "HP", value: stats.hp, color: "#4DFF88" },
    { label: "SPD", value: stats.speed, color: "#5EC9FF" },
    { label: "SPC", value: stats.special, color: "#C77DFF" },
  ];
  const tierColor =
    stats.tier === "Super Legendary" ? "#FF9DF2" :
    stats.tier === "Legendary" ? "#FFD700" :
    stats.tier === "Epic" ? "#C77DFF" :
    stats.tier === "Rare" ? "#5EC9FF" : "#9A94AD";
  return (
    <div className="w-full rounded-lg border p-3" style={{ borderColor: HAIRLINE, backgroundColor: PANEL2 }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black tracking-[0.18em] mono" style={{ color: MUTED }}>BATTLE CARD</span>
        {stats.tier && (
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: tierColor, color: INK }}>
            {stats.tier === "Super Legendary" ? "✧ SUPER LEGENDARY" : stats.tier}
          </span>
        )}
      </div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-bold w-8 mono tracking-wider" style={{ color: MUTED }}>{r.label}</span>
          {/* ◤ The arcade meter. Ten discrete blocks with a real 2px gutter and
              a glow on every lit one — the single detail that separates a
              cabinet readout from a progress bar. Same 10 segments as before,
              so no stat, no number and no layout width changed. */}
          <div className="flex-1 flex" style={{ gap: 2 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div
                key={n}
                className={n <= r.value ? "seg-on" : ""}
                style={{
                  flex: 1,
                  height: "11px",
                  borderRadius: 1,
                  color: r.color,
                  backgroundColor: n <= r.value ? r.color : "#1C1728",
                }}
              />
            ))}
          </div>
          <span className="text-xs font-black w-5 text-right mono" style={{ color: r.value > 7 ? "#FFD700" : OFFWHITE }}>{r.value}</span>
        </div>
      ))}
      {!compact && (
        <div className="mt-2 pt-2 border-t" style={{ borderColor: HAIRLINE }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: MUTED }}>
              Battle HP: <span className="mono" style={{ color: "#4DFF88", fontWeight: 800 }}>{stats.hpPoints}</span>
            </span>
            <div className="flex items-center gap-2">
              {stats.hasSuperRare && (
                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: "#FFD700", color: INK }}>
                  ★ SUPER-RARE
                </span>
              )}
              {stats.element && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1"
                  style={{ backgroundColor: `${stats.element.color}22`, color: stats.element.color, border: `1px solid ${stats.element.color}` }}
                  title={`${stats.element.id} — beats ${stats.element.beats}`}
                >
                  {stats.element.icon} {stats.element.id}
                </span>
              )}
            </div>
          </div>

          {/* Signature abilities (always 2) */}
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Signatures</p>
          {(stats.signatures || []).map((a, i) => (
            <div key={i} className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: OFFWHITE }}>
                {a.icon} <span style={{ fontWeight: 700 }}>{a.name}</span>
              </span>
              <span className="text-xs font-bold" style={{ color: "#5EC9FF" }}>{a.label}</span>
            </div>
          ))}

          {/* Extra tier-gated abilities */}
          {(stats.abilities || []).length > 0 && (
            <>
              <p className="text-xs uppercase tracking-widest mt-2 mb-1" style={{ color: MUTED }}>Abilities</p>
              {stats.abilities.map((a, i) => {
                const isSuper = a.kind === "banish" || a.kind === "revive";
                const isGodPower = a.kind === "god";
                return (
                  <div key={i} className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: isGodPower ? "#FF9DF2" : isSuper ? "#FFD700" : OFFWHITE }}>
                      {a.icon} <span style={{ fontWeight: 700 }}>{a.name}</span>
                    </span>
                    <span className="text-xs font-bold" style={{ color: isGodPower ? "#FF9DF2" : isSuper ? "#FFD700" : "#C77DFF" }}>{a.label}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, sub, children, accent }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: accent }}>
        {title}
      </p>
      {sub && (
        <p className="text-xs mb-2" style={{ color: MUTED }}>
          {sub}
        </p>
      )}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function toggleIn(list, value, max) {
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (list.length >= max) return [...list.slice(1), value];
  return [...list, value];
}

function MascotSVG({ archetypes, colors, accessories, size = 180 }) {
  const gradId = "mascotFillGrad";
  const c1 = COLOR_HEX[colors[0]] || LIME;
  const c2 = colors[1] ? COLOR_HEX[colors[1]] : null;
  const isRainbow = c1 === "RAINBOW" || c2 === "RAINBOW";
  const fill = isRainbow ? "url(#rainbowGrad)" : c2 ? `url(#${gradId})` : c1;

  const shapeFor = (a, asFill) => {
    switch (a) {
      case "Robot":
      case "Object":
        return <rect x="45" y="45" width="110" height="100" rx="14" fill={asFill} />;
      // ---- The seven that had no shape at all. "Animal" is also the
      // FALLBACK for any unknown archetype, so with no case here a mascot
      // could render as a pair of floating eyes and nothing else.
      case "Animal":
        return (
          <>
            <ellipse cx="100" cy="112" rx="50" ry="44" fill={asFill} />
            <path d="M62 78 Q56 52 76 60 Q84 68 82 82 Z" fill={asFill} />
            <path d="M138 78 Q144 52 124 60 Q116 68 118 82 Z" fill={asFill} />
            <ellipse cx="100" cy="124" rx="26" ry="20" fill={asFill} opacity="0.7" />
          </>
        );
      case "Lion":
        return (
          <>
            <circle cx="100" cy="96" r="58" fill={asFill} opacity="0.55" />
            <ellipse cx="100" cy="112" rx="46" ry="42" fill={asFill} />
            <circle cx="66" cy="70" r="13" fill={asFill} />
            <circle cx="134" cy="70" r="13" fill={asFill} />
            <ellipse cx="100" cy="124" rx="24" ry="18" fill={asFill} opacity="0.7" />
          </>
        );
      case "Rabbit":
        return (
          <>
            <ellipse cx="100" cy="118" rx="46" ry="42" fill={asFill} />
            <ellipse cx="84" cy="52" rx="11" ry="32" fill={asFill} />
            <ellipse cx="116" cy="52" rx="11" ry="32" fill={asFill} />
            <ellipse cx="100" cy="130" rx="22" ry="16" fill={asFill} opacity="0.7" />
          </>
        );
      case "Mouse":
        return (
          <>
            <ellipse cx="100" cy="116" rx="44" ry="40" fill={asFill} />
            <circle cx="66" cy="76" r="20" fill={asFill} />
            <circle cx="134" cy="76" r="20" fill={asFill} />
            <path d="M144 140 q26 6 22 26" stroke={asFill} strokeWidth="5" fill="none" strokeLinecap="round" />
          </>
        );
      case "Bird":
        return (
          <>
            <ellipse cx="100" cy="114" rx="42" ry="46" fill={asFill} />
            <circle cx="100" cy="72" r="26" fill={asFill} />
            <path d="M100 78 L124 88 L100 96 Z" fill="#FFB020" />
            <path d="M58 108 Q34 124 60 146 Q70 128 66 112 Z" fill={asFill} opacity="0.8" />
            <path d="M142 108 Q166 124 140 146 Q130 128 134 112 Z" fill={asFill} opacity="0.8" />
          </>
        );
      case "Fish":
        return (
          <>
            <ellipse cx="94" cy="110" rx="52" ry="38" fill={asFill} />
            <path d="M144 110 L176 88 L176 132 Z" fill={asFill} opacity="0.85" />
            <path d="M88 72 L104 88 L72 88 Z" fill={asFill} opacity="0.7" />
            <path d="M60 122 q14 10 30 6" stroke="#0B0912" strokeWidth="2.5" fill="none" opacity="0.35" />
          </>
        );
      case "Baby":
        return (
          <>
            <circle cx="100" cy="86" r="42" fill={asFill} />
            <ellipse cx="100" cy="140" rx="36" ry="28" fill={asFill} />
            <path d="M84 46 q10 -14 22 -4" stroke={asFill} strokeWidth="6" fill="none" strokeLinecap="round" />
          </>
        );
      case "Frog":
        return (
          <>
            <ellipse cx="100" cy="112" rx="54" ry="44" fill={asFill} />
            <circle cx="74" cy="70" r="16" fill={asFill} />
            <circle cx="126" cy="70" r="16" fill={asFill} />
          </>
        );
      case "Ape":
        return (
          <>
            <ellipse cx="100" cy="105" rx="52" ry="50" fill={asFill} />
            <circle cx="52" cy="90" r="14" fill={asFill} />
            <circle cx="148" cy="90" r="14" fill={asFill} />
            <ellipse cx="100" cy="118" rx="30" ry="24" fill={asFill} opacity="0.75" />
          </>
        );
      case "Bull":
        return (
          <>
            <ellipse cx="100" cy="108" rx="52" ry="46" fill={asFill} />
            <path d="M52 78 Q30 65 34 45 Q52 55 62 70 Z" fill={asFill} />
            <path d="M148 78 Q170 65 166 45 Q148 55 138 70 Z" fill={asFill} />
            <ellipse cx="100" cy="132" rx="26" ry="18" fill="#1A1A22" opacity="0.28" />
            <circle cx="92" cy="130" r="3.5" fill="#1A1A22" opacity="0.5" />
            <circle cx="108" cy="130" r="3.5" fill="#1A1A22" opacity="0.5" />
            <circle cx="100" cy="146" r="8" fill="none" stroke="#FFB627" strokeWidth="3" />
          </>
        );
      case "Human-like":
        return (
          <>
            <circle cx="100" cy="74" r="34" fill={asFill} />
            <path d="M66 176 Q66 122 100 122 Q134 122 134 176 Z" fill={asFill} />
            <path d="M70 130 Q48 146 46 172" fill="none" stroke={asFill} strokeWidth="12" strokeLinecap="round" />
            <path d="M130 130 Q152 146 154 172" fill="none" stroke={asFill} strokeWidth="12" strokeLinecap="round" />
          </>
        );
      case "Bear":
        return (
          <>
            <ellipse cx="100" cy="108" rx="52" ry="46" fill={asFill} />
            <circle cx="62" cy="62" r="15" fill={asFill} />
            <circle cx="138" cy="62" r="15" fill={asFill} />
          </>
        );
      case "Hamster":
        return (
          <>
            <ellipse cx="100" cy="112" rx="56" ry="46" fill={asFill} />
            <circle cx="70" cy="66" r="12" fill={asFill} />
            <circle cx="130" cy="66" r="12" fill={asFill} />
            <ellipse cx="66" cy="112" rx="14" ry="12" fill={asFill} opacity="0.7" />
            <ellipse cx="134" cy="112" rx="14" ry="12" fill={asFill} opacity="0.7" />
          </>
        );
      case "Penguin":
        return (
          <>
            <ellipse cx="100" cy="105" rx="46" ry="55" fill={asFill} />
            <ellipse cx="100" cy="118" rx="28" ry="34" fill="#FFFFFF" opacity="0.85" />
            <path d="M56 90 Q42 110 52 130 L64 118 Z" fill={asFill} />
            <path d="M144 90 Q158 110 148 130 L136 118 Z" fill={asFill} />
          </>
        );
      case "Ghost":
        return <path d="M50 150 V90 a50 50 0 0 1 100 0 V150 l-15 -15 -15 15 -15 -15 -15 15 -15 -15 -15 15 Z" fill={asFill} />;
      case "Zombie":
        return <path d="M50 60 Q50 45 65 45 H135 Q150 45 150 60 V135 l-12 12 -13 -8 -12 10 -13 -10 -12 10 -13 -8 -12 8 Z" fill={asFill} />;
      case "Fighter":
        return (
          <>
            <ellipse cx="100" cy="112" rx="48" ry="44" fill={asFill} />
            <ellipse cx="58" cy="98" rx="17" ry="15" fill={asFill} />
            <ellipse cx="142" cy="98" rx="17" ry="15" fill={asFill} />
          </>
        );
      case "Blob":
      case "Creature":
        return <path d="M100 40 C150 40 165 90 150 130 C140 160 60 160 50 130 C35 90 50 40 100 40 Z" fill={asFill} />;
      case "Insect":
        return <ellipse cx="100" cy="100" rx="45" ry="60" fill={asFill} />;
      case "Plant":
        return <path d="M100 150 V90 C60 90 55 50 55 50 C90 55 100 90 100 90 C100 90 110 55 145 50 C145 50 140 90 100 90 V150 Z" fill={asFill} />;
      case "Food":
        return <circle cx="100" cy="100" r="55" fill={asFill} />;
      case "Alien":
        return <path d="M100 45 C135 45 150 80 140 115 C133 140 67 140 60 115 C50 80 65 45 100 45 Z" fill={asFill} />;
      case "Dog":
        return (
          <>
            <ellipse cx="100" cy="108" rx="52" ry="48" fill={asFill} />
            <path d="M55 70 Q45 100 60 105 L75 80 Z" fill={asFill} />
            <path d="M145 70 Q155 100 140 105 L125 80 Z" fill={asFill} />
          </>
        );
      case "Cat":
        return (
          <>
            <ellipse cx="100" cy="110" rx="50" ry="46" fill={asFill} />
            <path d="M62 78 L58 45 L85 68 Z" fill={asFill} />
            <path d="M138 78 L142 45 L115 68 Z" fill={asFill} />
          </>
        );
      case "Panther":
        return (
          <>
            <ellipse cx="100" cy="112" rx="52" ry="42" fill={asFill} />
            <path d="M62 82 L56 54 L80 72 Z" fill={asFill} />
            <path d="M138 82 L144 54 L120 72 Z" fill={asFill} />
            <path d="M148 130 Q176 120 172 94" fill="none" stroke={asFill} strokeWidth="10" strokeLinecap="round" />
          </>
        );
      case "Goat":
        return (
          <>
            <ellipse cx="100" cy="110" rx="50" ry="45" fill={asFill} />
            <path d="M72 68 Q56 46 68 30 Q73 48 84 60 Z" fill={asFill} />
            <path d="M128 68 Q144 46 132 30 Q127 48 116 60 Z" fill={asFill} />
            <path d="M92 148 L100 170 L108 148 Z" fill={asFill} opacity="0.85" />
          </>
        );
      case "Snake":
        return (
          <>
            <ellipse cx="100" cy="72" rx="34" ry="26" fill={asFill} />
            <path d="M78 90 Q40 108 62 130 Q84 150 124 138 Q158 128 150 154 Q144 172 108 172 L108 158 Q134 158 137 150 Q140 140 122 148 Q80 162 54 138 Q28 112 66 88 Z" fill={asFill} />
            <path d="M96 46 L100 34 L104 46 Z" fill="#FF4D6D" />
          </>
        );
      case "Sports Car":
        return (
          <>
            <path d="M28 122 Q34 104 60 100 L140 100 Q166 104 172 122 L178 126 Q182 130 180 136 L20 136 Q18 130 22 126 Z" fill={asFill} />
            <path d="M68 100 Q74 82 96 82 L116 82 Q134 82 140 100 Z" fill={asFill} />
            <path d="M74 97 Q79 86 96 86 L114 86 Q127 86 132 97 Z" fill="#1A1A22" opacity="0.55" />
            <circle cx="58" cy="136" r="13" fill="#1A1A22" />
            <circle cx="58" cy="136" r="5" fill="#8A8F98" />
            <circle cx="142" cy="136" r="13" fill="#1A1A22" />
            <circle cx="142" cy="136" r="5" fill="#8A8F98" />
            <circle cx="172" cy="122" r="4" fill="#FFF3B0" />
            <circle cx="28" cy="122" r="3.5" fill="#FF4D4D" />
          </>
        );
      default:
        return <ellipse cx="100" cy="105" rx="55" ry="50" fill={asFill} />;
    }
  };

  const eyes = () => {
    if (accessories.includes("Laser Eyes")) {
      return (
        <>
          <rect x="74" y="90" width="16" height="8" rx="2" fill="#FF2D2D" />
          <rect x="110" y="90" width="16" height="8" rx="2" fill="#FF2D2D" />
          <rect x="88" y="92" width="60" height="3" fill="#FF2D2D" opacity="0.6" transform="rotate(8 88 92)" />
        </>
      );
    }
    return (
      <>
        <circle cx="82" cy="95" r="7" fill={INK} />
        <circle cx="118" cy="95" r="7" fill={INK} />
      </>
    );
  };

  const overlayFor = (acc, i) => {
    switch (acc) {
      case "Wif Hat (Knit Beanie)":
        return (
          <g key={i}>
            <path d="M60 62 Q100 20 140 62 L140 72 Q100 58 60 72 Z" fill="#FF9BD2" />
            <rect x="58" y="66" width="84" height="12" rx="6" fill="#FF7AC0" />
            <circle cx="100" cy="26" r="8" fill="#FFD1E8" />
          </g>
        );
      case "Laser Eyes":
        return null;
      case "Diamond Hands":
        return (
          <g key={i}>
            <path d="M38 118 L48 108 L58 118 L48 134 Z" fill="#9BE8FF" stroke="#5EC9FF" strokeWidth="2" />
            <path d="M142 118 L152 108 L162 118 L152 134 Z" fill="#9BE8FF" stroke="#5EC9FF" strokeWidth="2" />
          </g>
        );
      case "Green Candle":
        return (
          <g key={i}>
            <rect x="158" y="80" width="12" height="50" fill="#3DDC84" />
            <rect x="163" y="60" width="2" height="20" fill="#3DDC84" />
            <rect x="163" y="130" width="2" height="14" fill="#3DDC84" />
          </g>
        );
      case "Golden Wif Hat":
        return (
          <g key={i}>
            <path d="M60 62 Q100 20 140 62 L140 72 Q100 58 60 72 Z" fill="#FFD700" />
            <rect x="58" y="66" width="84" height="12" rx="6" fill="#E6B800" />
            <circle cx="100" cy="26" r="8" fill="#FFF3B0" />
            <circle cx="100" cy="26" r="12" fill="none" stroke="#FFD700" strokeWidth="2" opacity="0.5" />
          </g>
        );
      case "Cyber Visor":
        return (
          <g key={i}>
            <rect x="62" y="85" width="76" height="20" rx="10" fill="#0AF0FF" opacity="0.85" />
            <rect x="62" y="85" width="76" height="20" rx="10" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
            <rect x="70" y="91" width="24" height="3" fill="#FFFFFF" opacity="0.8" />
          </g>
        );
      case "Dragon Aura":
        return (
          <g key={i}>
            <circle cx="100" cy="100" r="78" fill="none" stroke="#FF6A00" strokeWidth="3" opacity="0.5" strokeDasharray="10 6" />
            <circle cx="100" cy="100" r="88" fill="none" stroke="#FFB627" strokeWidth="2" opacity="0.35" strokeDasharray="4 8" />
          </g>
        );
      case "Ultimate Aura":
        return (
          <g key={i}>
            <circle cx="100" cy="100" r="76" fill="none" stroke="#FF3EA5" strokeWidth="3" opacity="0.55" strokeDasharray="14 5" />
            <circle cx="100" cy="100" r="84" fill="none" stroke="#5EC9FF" strokeWidth="2.5" opacity="0.45" strokeDasharray="8 8" />
            <circle cx="100" cy="100" r="92" fill="none" stroke="#C6FF3D" strokeWidth="2" opacity="0.35" strokeDasharray="3 10" />
          </g>
        );
      case "Blessed Aura":
        return (
          <g key={i}>
            <circle cx="100" cy="100" r="80" fill="none" stroke="#FFF3B0" strokeWidth="4" opacity="0.5" />
            <circle cx="100" cy="100" r="90" fill="none" stroke="#FFD700" strokeWidth="2" opacity="0.35" />
            <path d="M100 8 L104 18 L114 18 L106 24 L109 34 L100 28 L91 34 L94 24 L86 18 L96 18 Z" fill="#FFD700" opacity="0.85" />
          </g>
        );
      case "Gun":
        return (
          <g key={i}>
            <rect x="138" y="112" width="34" height="10" rx="3" fill="#3A3A44" />
            <rect x="138" y="120" width="10" height="16" rx="3" fill="#3A3A44" transform="rotate(12 143 128)" />
            <rect x="166" y="113" width="7" height="4" fill="#5A5A66" />
          </g>
        );
      case "Long Lashes":
        return (
          <g key={i}>
            <path d="M70 86 L64 78 M76 84 L72 75 M84 83 L82 74" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M130 86 L136 78 M124 84 L128 75 M116 83 L118 74" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </g>
        );
      case "Glam Nails":
        return (
          <g key={i}>
            {[38, 46, 54].map((x, n) => (
              <ellipse key={`l${n}`} cx={x} cy={128 - n * 4} rx="4" ry="7" fill="#FF3EA5" transform={`rotate(-20 ${x} ${128 - n * 4})`} />
            ))}
            {[162, 154, 146].map((x, n) => (
              <ellipse key={`r${n}`} cx={x} cy={128 - n * 4} rx="4" ry="7" fill="#FF3EA5" transform={`rotate(20 ${x} ${128 - n * 4})`} />
            ))}
          </g>
        );
      case "Long Flowing Hair":
        return (
          <g key={i}>
            <path d="M55 70 Q45 60 50 45 Q70 30 100 32 Q130 30 150 45 Q155 60 145 70 Q150 110 142 155 Q136 168 128 158 Q134 115 130 85 Q100 70 70 85 Q66 115 72 158 Q64 168 58 155 Q50 110 55 70 Z" fill="#8B5CF6" opacity="0.9" />
          </g>
        );
      case "Designer Purse":
        return (
          <g key={i}>
            <path d="M138 128 Q150 118 162 128" fill="none" stroke={AMBER} strokeWidth="3" />
            <rect x="134" y="128" width="32" height="24" rx="6" fill={MAGENTA} />
            <rect x="146" y="136" width="8" height="6" rx="2" fill={AMBER} />
          </g>
        );
      case "Earrings":
        return (
          <g key={i}>
            <circle cx="47" cy="112" r="3" fill={AMBER} />
            <ellipse cx="47" cy="122" rx="5" ry="8" fill="none" stroke={AMBER} strokeWidth="2.5" />
            <circle cx="153" cy="112" r="3" fill={AMBER} />
            <ellipse cx="153" cy="122" rx="5" ry="8" fill="none" stroke={AMBER} strokeWidth="2.5" />
          </g>
        );
      case "Basic Sneakers":
        return (
          <g key={i}>
            <path d="M70 178 Q68 170 76 170 L92 170 Q98 170 98 178 Z" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
            <path d="M102 178 Q102 170 108 170 L124 170 Q132 170 130 178 Z" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
            <rect x="70" y="175" width="28" height="3" fill={INK} opacity="0.3" />
            <rect x="102" y="175" width="28" height="3" fill={INK} opacity="0.3" />
          </g>
        );
      case "Hype Kicks":
        return (
          <g key={i}>
            <path d="M66 178 Q64 166 76 166 L94 166 Q100 168 100 178 Z" fill="#FF3EA5" stroke={INK} strokeWidth="2" />
            <path d="M100 178 Q100 168 106 166 L124 166 Q136 166 134 178 Z" fill="#5EC9FF" stroke={INK} strokeWidth="2" />
            <path d="M70 172 Q80 168 92 171" fill="none" stroke="#FFD700" strokeWidth="2.5" />
            <path d="M108 172 Q118 168 130 171" fill="none" stroke="#FFD700" strokeWidth="2.5" />
            <circle cx="72" cy="164" r="2" fill="#FFD700" />
            <circle cx="128" cy="164" r="2" fill="#FFD700" />
          </g>
        );
      case "Rolex":
        return (
          <g key={i}>
            <rect x="36" y="120" width="20" height="7" rx="3" fill="#2E2E38" transform="rotate(-18 46 123)" />
            <rect x="39" y="112" width="15" height="14" rx="4" fill="#FFD700" stroke="#B8860B" strokeWidth="1.5" transform="rotate(-18 46 119)" />
            <circle cx="46.5" cy="119" r="4" fill="#F5F5F5" transform="rotate(-18 46 119)" />
          </g>
        );
      case "Harp":
        return (
          <g key={i}>
            <path d="M150 148 Q140 110 158 74" fill="none" stroke="#FFD700" strokeWidth="5" strokeLinecap="round" />
            <path d="M150 148 L172 92" fill="none" stroke="#FFD700" strokeWidth="4" strokeLinecap="round" />
            {[0, 1, 2, 3, 4].map((n) => (
              <line
                key={n}
                x1={149 + n * 4.5}
                y1={144 - n * 9}
                x2={158 + n * 3}
                y2={132 - n * 9}
                stroke="#FFF3B0"
                strokeWidth="1.2"
                opacity="0.9"
              />
            ))}
          </g>
        );
      case "Sword":
        return (
          <g key={i}>
            <rect x="152" y="52" width="7" height="70" rx="2" fill="#DADADA" transform="rotate(15 155 87)" />
            <path d="M150 45 L156 32 L162 45 Z" fill="#DADADA" transform="rotate(15 156 40)" />
            <rect x="142" y="118" width="26" height="6" rx="3" fill={AMBER} transform="rotate(15 155 121)" />
            <rect x="151" y="122" width="9" height="16" rx="3" fill="#8B5A2B" transform="rotate(15 155 130)" />
          </g>
        );
      case "Guitar":
        return (
          <g key={i}>
            <ellipse cx="140" cy="135" rx="18" ry="15" fill="#B5651D" transform="rotate(-30 140 135)" />
            <ellipse cx="152" cy="120" rx="12" ry="10" fill="#B5651D" transform="rotate(-30 152 120)" />
            <circle cx="143" cy="131" r="5" fill={INK} />
            <rect x="152" y="72" width="5" height="52" rx="2" fill="#8B5A2B" transform="rotate(-30 154 98)" />
            <rect x="170" y="60" width="10" height="8" rx="2" fill={INK} transform="rotate(-30 175 64)" />
            <path d="M144 128 L168 84" stroke="#F2F0F5" strokeWidth="1" transform="rotate(0)" />
          </g>
        );
      case "Lollipop":
        return (
          <g key={i}>
            <rect x="151" y="98" width="4" height="42" rx="2" fill="#FFFFFF" />
            <circle cx="153" cy="88" r="15" fill="#FF3EA5" />
            <path d="M153 88 m-11 0 a11 11 0 0 1 22 0 a7 7 0 0 1 -14 0 a4 4 0 0 1 8 0" fill="none" stroke="#FFFFFF" strokeWidth="3" />
          </g>
        );
      case "Sunglasses":
        return <rect key={i} x="68" y="88" width="64" height="16" rx="6" fill={INK} />;
      case "Crown":
        return <path key={i} d="M65 55 L75 75 L100 50 L125 75 L135 55 L130 80 H70 Z" fill={AMBER} stroke={INK} strokeWidth="2" />;
      case "Chain":
        return <circle key={i} cx="100" cy="148" r="10" fill="none" stroke={AMBER} strokeWidth="4" />;
      case "Cape":
        return <path key={i} d="M55 110 Q40 160 60 175 L100 145 L140 175 Q160 160 145 110 Z" fill={MAGENTA} opacity="0.85" />;
      case "Headphones":
        return (
          <g key={i}>
            <path d="M55 90 Q100 40 145 90" fill="none" stroke={INK} strokeWidth="6" />
            <rect x="45" y="85" width="16" height="24" rx="6" fill={INK} />
            <rect x="139" y="85" width="16" height="24" rx="6" fill={INK} />
          </g>
        );
      case "Cowboy Hat":
        return (
          <g key={i}>
            <ellipse cx="100" cy="62" rx="46" ry="10" fill="#8B5A2B" />
            <path d="M75 60 Q78 30 100 30 Q122 30 125 60 Z" fill="#A9702F" />
            <rect x="80" y="52" width="40" height="6" rx="3" fill="#5C3A1A" />
          </g>
        );
      case "Sweater":
        return (
          <g key={i}>
            <path d="M52 130 Q100 145 148 130 L148 158 Q100 168 52 158 Z" fill="#C6392B" />
            <path d="M52 130 L38 118 L48 108 L62 118 Z" fill="#C6392B" />
            <path d="M148 130 L162 118 L152 108 L138 118 Z" fill="#C6392B" />
            <path d="M64 132 L136 132 M64 142 L136 142 M64 152 L136 152" stroke="#8E2519" strokeWidth="2" opacity="0.6" />
          </g>
        );
      case "Shorts":
        return (
          <g key={i}>
            <path d="M68 158 L68 180 L84 180 L86 167 L88 180 L104 180 L104 158 Z" fill="#3D9EFF" transform="translate(8,0)" />
            <rect x="66" y="156" width="46" height="8" rx="3" fill="#2B7ACC" transform="translate(8,0)" />
          </g>
        );
      case "Boxing Gloves":
        return (
          <g key={i}>
            <circle cx="45" cy="120" r="16" fill={MAGENTA} />
            <circle cx="155" cy="120" r="16" fill={MAGENTA} />
          </g>
        );
      case "Halo":
        return <ellipse key={i} cx="100" cy="40" rx="22" ry="7" fill="none" stroke={AMBER} strokeWidth="4" />;
      case "Devil Horns":
        return (
          <g key={i}>
            <path d="M75 55 L65 30 L85 45 Z" fill={MAGENTA} />
            <path d="M125 55 L135 30 L115 45 Z" fill={MAGENTA} />
          </g>
        );
      case "Cigar":
        return <rect key={i} x="125" y="105" width="26" height="7" rx="3" fill="#C89B6B" />;
      case "Katana":
        return <rect key={i} x="140" y="60" width="6" height="90" fill="#DADADA" transform="rotate(20 143 105)" />;
      case "Axe":
        return (
          <g key={i}>
            <rect x="148" y="70" width="6" height="70" rx="2" fill="#8B5A2B" transform="rotate(18 151 105)" />
            <path d="M138 62 Q160 48 168 66 Q158 74 146 76 Z" fill="#C8CDD6" stroke="#8A8F98" strokeWidth="1.5" transform="rotate(18 152 68)" />
          </g>
        );
      case "Umbrella":
        return (
          <g key={i}>
            <path d="M120 52 Q150 30 180 52 Q172 46 165 52 Q158 44 150 52 Q142 44 135 52 Q128 46 120 52 Z" fill="#FF3EA5" stroke="#C22A7F" strokeWidth="1.5" />
            <rect x="148" y="52" width="3" height="60" fill="#5A5A66" />
            <path d="M148 112 q0 8 8 8" fill="none" stroke="#5A5A66" strokeWidth="3" />
          </g>
        );
      case "Baseball Bat":
        return (
          <g key={i}>
            <path d="M150 140 L172 64 Q175 54 168 52 Q161 50 158 60 L140 136 Z" fill="#C89B6B" stroke="#8B5A2B" strokeWidth="1.5" />
            <rect x="139" y="134" width="14" height="8" rx="4" fill="#8B5A2B" />
          </g>
        );
      case "Bow & Arrow":
        return (
          <g key={i}>
            <path d="M150 55 Q178 100 150 145" fill="none" stroke="#8B5A2B" strokeWidth="4" strokeLinecap="round" />
            <line x1="150" y1="55" x2="150" y2="145" stroke="#F2F0F5" strokeWidth="1.5" />
            <line x1="128" y1="100" x2="168" y2="100" stroke="#C8CDD6" strokeWidth="3" />
            <path d="M168 100 L160 95 M168 100 L160 105" stroke="#C8CDD6" strokeWidth="2.5" fill="none" />
            <path d="M128 100 L134 96 L134 104 Z" fill="#FF4D4D" />
          </g>
        );
      case "Meme Corps Armor":
        return (
          <g key={i}>
            <path d="M58 118 Q100 132 142 118 L142 152 Q100 164 58 152 Z" fill="#E8E8E8" stroke="#9A9A9A" strokeWidth="2" />
            <path d="M58 118 L44 108 L52 98 L64 108 Z" fill="#E8E8E8" stroke="#9A9A9A" strokeWidth="2" />
            <path d="M142 118 L156 108 L148 98 L136 108 Z" fill="#E8E8E8" stroke="#9A9A9A" strokeWidth="2" />
            <rect x="88" y="126" width="24" height="18" rx="3" fill="#2E2E38" />
            <circle cx="100" cy="135" r="5" fill="#C6FF3D" />
            <path d="M64 128 L136 128 M64 140 L136 140" stroke="#B8B8B8" strokeWidth="1.5" opacity="0.7" />
          </g>
        );
      case "Flute":
        return (
          <g key={i}>
            <rect x="112" y="102" width="56" height="6" rx="3" fill="#C8CDD6" transform="rotate(-12 140 105)" />
            {[122, 132, 142, 152].map((x, n) => (
              <circle key={n} cx={x} cy={103 - n * 2} r="1.6" fill="#5A5A66" transform="rotate(-12 140 105)" />
            ))}
          </g>
        );
      case "Bamboo Hand Fan":
        return (
          <g key={i}>
            <path d="M150 130 L128 92 A34 34 0 0 1 172 92 Z" fill="#F5E9C8" stroke="#C9B37E" strokeWidth="1.5" />
            <path d="M150 130 L134 96 M150 130 L150 90 M150 130 L166 96" stroke="#C9B37E" strokeWidth="1.5" />
            <rect x="147" y="128" width="6" height="14" rx="3" fill="#8B5A2B" />
          </g>
        );
      case "Jersey":
        return (
          <g key={i}>
            <path d="M58 120 Q100 134 142 120 L142 154 Q100 166 58 154 Z" fill="#3D9EFF" stroke="#2B7ACC" strokeWidth="2" />
            <path d="M58 120 L46 110 L54 100 L66 110 Z" fill="#3D9EFF" stroke="#2B7ACC" strokeWidth="2" />
            <path d="M142 120 L154 110 L146 100 L134 110 Z" fill="#3D9EFF" stroke="#2B7ACC" strokeWidth="2" />
            <text x="100" y="146" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#FFFFFF" fontFamily="sans-serif">11</text>
          </g>
        );
      case "Stereo":
        return (
          <g key={i}>
            <rect x="60" y="150" width="80" height="26" rx="4" fill="#2E2E38" stroke="#4A4A56" strokeWidth="1.5" />
            <circle cx="76" cy="163" r="8" fill="#4A4A56" stroke="#6A6A78" strokeWidth="1.5" />
            <circle cx="124" cy="163" r="8" fill="#4A4A56" stroke="#6A6A78" strokeWidth="1.5" />
            <rect x="92" y="156" width="16" height="6" rx="2" fill="#C6FF3D" />
            <path d="M64 150 L72 142 M136 150 L128 142" stroke="#4A4A56" strokeWidth="2.5" />
          </g>
        );
      case "Baseball Hat":
        return (
          <g key={i}>
            <path d="M68 62 Q70 36 100 36 Q130 36 132 62 Z" fill="#3D9EFF" stroke="#2B7ACC" strokeWidth="2" />
            <path d="M126 58 Q160 58 164 66 Q140 70 124 66 Z" fill="#2B7ACC" />
            <circle cx="100" cy="38" r="3" fill="#2B7ACC" />
          </g>
        );
      case "Shield":
        return (
          <g key={i}>
            <path d="M40 96 Q40 84 58 84 Q76 84 76 96 L76 118 Q76 138 58 146 Q40 138 40 118 Z" fill="#8A8F98" stroke="#4A4A56" strokeWidth="2.5" />
            <path d="M44 98 Q44 89 58 89 Q72 89 72 98 L72 116 Q72 132 58 139 Q44 132 44 116 Z" fill="#C8CDD6" />
            <circle cx="58" cy="110" r="7" fill="#FFD700" stroke="#B8860B" strokeWidth="1.5" />
          </g>
        );
      case "Scarf":
        return (
          <g key={i}>
            <path d="M62 138 Q100 152 138 138 L138 148 Q100 162 62 148 Z" fill="#FF4D4D" stroke="#B82E2E" strokeWidth="1.5" />
            <path d="M120 146 L126 176 L114 176 L112 150 Z" fill="#FF4D4D" stroke="#B82E2E" strokeWidth="1.5" />
            <path d="M114 170 L126 170 M113 163 L125 163" stroke="#B82E2E" strokeWidth="1.5" />
          </g>
        );
      case "Angel Wings":
        return (
          <g key={i}>
            <path d="M46 118 Q10 92 16 58 Q34 70 44 84 Q38 66 46 52 Q58 72 58 96 Z" fill="#FFF8E7" stroke="#E5D9B6" strokeWidth="2" opacity="0.95" />
            <path d="M154 118 Q190 92 184 58 Q166 70 156 84 Q162 66 154 52 Q142 72 142 96 Z" fill="#FFF8E7" stroke="#E5D9B6" strokeWidth="2" opacity="0.95" />
            <path d="M28 74 Q40 82 48 94 M172 74 Q160 82 152 94" stroke="#E5D9B6" strokeWidth="1.5" fill="none" />
          </g>
        );
      case "Nunchucks":
        return (
          <g key={i}>
            <rect x="148" y="94" width="7" height="34" rx="3" fill="#4A2F1A" stroke="#2E1C0F" strokeWidth="1" transform="rotate(25 151 111)" />
            <rect x="164" y="120" width="7" height="34" rx="3" fill="#4A2F1A" stroke="#2E1C0F" strokeWidth="1" transform="rotate(-15 167 137)" />
            <path d="M156 124 Q162 130 168 124" stroke="#C8CDD6" strokeWidth="2" fill="none" />
          </g>
        );
      case "Chef Apron":
        return (
          <g key={i}>
            <rect x="88" y="98" width="24" height="14" rx="3" fill="#FFFFFF" stroke="#D8D8D8" strokeWidth="2" />
            <path d="M76 112 L124 112 L128 162 Q100 172 72 162 Z" fill="#FFFFFF" stroke="#D8D8D8" strokeWidth="2" />
            <path d="M82 124 L118 124" stroke="#D8D8D8" strokeWidth="2" />
            <rect x="90" y="134" width="20" height="14" rx="2" fill="none" stroke="#D8D8D8" strokeWidth="1.5" />
          </g>
        );
      case "Police Suit":
        return (
          <g key={i}>
            <path d="M58 120 Q100 134 142 120 L142 154 Q100 166 58 154 Z" fill="#1E2A5A" stroke="#141C3D" strokeWidth="2" />
            <path d="M94 128 L100 120 L106 128 L100 136 Z" fill="#FFD700" stroke="#B8860B" strokeWidth="1" />
            <rect x="60" y="146" width="80" height="6" fill="#0E142B" />
            <rect x="94" y="147" width="12" height="5" rx="1" fill="#FFD700" />
          </g>
        );
      case "Scrubs":
        return (
          <g key={i}>
            <path d="M58 120 Q100 134 142 120 L142 156 Q100 168 58 156 Z" fill="#2E9E8F" stroke="#1F6E63" strokeWidth="2" />
            <path d="M92 122 L100 132 L108 122" fill="none" stroke="#1F6E63" strokeWidth="2.5" />
            <rect x="106" y="136" width="16" height="12" rx="2" fill="none" stroke="#1F6E63" strokeWidth="1.5" />
          </g>
        );
      case "Trench Coat":
        return (
          <g key={i}>
            <path d="M62 112 L80 106 L80 174 L62 168 Z" fill="#B99A6B" stroke="#8F7546" strokeWidth="2" />
            <path d="M138 112 L120 106 L120 174 L138 168 Z" fill="#B99A6B" stroke="#8F7546" strokeWidth="2" />
            <path d="M80 106 Q100 116 120 106 L120 120 Q100 128 80 120 Z" fill="#A8874F" stroke="#8F7546" strokeWidth="1.5" />
            <rect x="66" y="130" width="9" height="4" rx="1" fill="#8F7546" />
            <rect x="125" y="130" width="9" height="4" rx="1" fill="#8F7546" />
          </g>
        );
      case "Sports Car":
        return (
          <g key={i}>
            <path d="M114 158 Q120 144 138 144 L164 144 Q182 144 188 154 L194 157 Q198 160 196 166 L116 166 Q110 162 114 158 Z" fill="#E33131" stroke="#9E1F1F" strokeWidth="2" />
            <path d="M130 144 Q136 134 150 134 L160 134 Q170 134 174 144 Z" fill="#7ACBFF" stroke="#9E1F1F" strokeWidth="2" />
            <circle cx="130" cy="166" r="7" fill="#222" stroke="#888" strokeWidth="2" />
            <circle cx="180" cy="166" r="7" fill="#222" stroke="#888" strokeWidth="2" />
            <path d="M118 158 L128 158" stroke="#FFF3B0" strokeWidth="2" />
          </g>
        );
      case "Cosmic Aura":
        return (
          <g key={i}>
            <circle cx="100" cy="100" r="78" fill="none" stroke="#8B5CF6" strokeWidth="3" opacity="0.5" strokeDasharray="12 6" />
            <circle cx="100" cy="100" r="88" fill="none" stroke="#5EC9FF" strokeWidth="2" opacity="0.4" strokeDasharray="4 9" />
            <circle cx="40" cy="52" r="2" fill="#FFFFFF" opacity="0.9" />
            <circle cx="162" cy="60" r="1.6" fill="#FFFFFF" opacity="0.8" />
            <circle cx="52" cy="150" r="1.8" fill="#FFFFFF" opacity="0.8" />
            <circle cx="158" cy="146" r="2.2" fill="#FFFFFF" opacity="0.9" />
            <path d="M28 92 l4 4 m-4 0 l4 -4" stroke="#FFF3B0" strokeWidth="1.5" opacity="0.8" />
          </g>
        );
      case "Dark Aura":
        return (
          <g key={i}>
            <circle cx="100" cy="100" r="76" fill="none" stroke="#1A1A22" strokeWidth="6" opacity="0.75" />
            <circle cx="100" cy="100" r="86" fill="none" stroke="#4B0082" strokeWidth="3" opacity="0.55" strokeDasharray="14 6" />
            <path d="M30 96 Q26 84 34 76 M170 96 Q174 84 166 76 M100 180 Q92 174 94 164" stroke="#4B0082" strokeWidth="3" fill="none" opacity="0.6" />
          </g>
        );
      // ================= THE 26 THAT HAD NO ART =========================
      // These shipped with stats and prompt text but never a drawn overlay,
      // so picking one changed the battle card and the AI art while the live
      // preview silently ignored it. Hair and clothing sit in the BEHIND /
      // BODY layers via LAYER below, so they stack in a sane order instead of
      // in whatever order they happened to be clicked.
      case "Dreadlocks":
        return (
          <g key={i}>
            <path d="M58 68 Q52 44 74 36 Q100 26 126 36 Q148 44 142 68 Z" fill="#2E2118" />
            {[62,74,86,100,114,126,138].map((x, k) => (
              <path key={k} d={`M${x} 60 q${k % 2 ? 6 : -6} 34 ${k % 2 ? 2 : -2} 62`} stroke="#2E2118" strokeWidth="7" fill="none" strokeLinecap="round" />
            ))}
          </g>
        );
      case "Braids":
        return (
          <g key={i}>
            <path d="M58 68 Q52 44 74 36 Q100 26 126 36 Q148 44 142 68 Z" fill="#3B2A1E" />
            {[66,82,100,118,134].map((x, k) => (
              <g key={k}>
                <path d={`M${x} 62 L${x} 132`} stroke="#3B2A1E" strokeWidth="6" strokeLinecap="round" />
                {[76,94,112,128].map((y, q) => <circle key={q} cx={x} cy={y} r="4" fill="#4A3626" />)}
              </g>
            ))}
          </g>
        );
      case "Mohawk":
        return (
          <g key={i}>
            <path d="M88 46 L100 14 L112 46 Z" fill="#FF3EA5" />
            <path d="M78 54 L100 20 L122 54 Q100 44 78 54 Z" fill="#FF3EA5" opacity="0.9" />
          </g>
        );
      case "Beard":
        return (
          <g key={i}>
            <path d="M66 100 Q68 148 100 156 Q132 148 134 100 Q118 118 100 118 Q82 118 66 100 Z" fill="#3B2A1E" />
            <path d="M84 96 q16 8 32 0" stroke="#2A1D14" strokeWidth="3" fill="none" opacity="0.6" />
          </g>
        );
      case "Durag":
        return (
          <g key={i}>
            <path d="M58 68 Q54 40 100 34 Q146 40 142 68 Z" fill="#1B1B24" />
            <path d="M142 62 q26 8 30 34 q-16 -12 -34 -18 Z" fill="#1B1B24" opacity="0.9" />
            <path d="M62 60 Q100 48 138 60" stroke="#2E2E3C" strokeWidth="3" fill="none" />
          </g>
        );
      case "Top Hat":
        return (
          <g key={i}>
            <ellipse cx="100" cy="58" rx="48" ry="9" fill="#12121A" />
            <rect x="74" y="12" width="52" height="46" rx="4" fill="#1B1B24" />
            <rect x="74" y="46" width="52" height="8" fill="#C81E76" />
          </g>
        );
      case "Bucket Hat":
        return (
          <g key={i}>
            <ellipse cx="100" cy="60" rx="50" ry="11" fill="#4E7A3A" />
            <path d="M72 58 Q72 28 100 28 Q128 28 128 58 Z" fill="#5E8F45" />
            <path d="M74 48 L126 48" stroke="#3E6330" strokeWidth="3" />
          </g>
        );
      case "Bandana":
        return (
          <g key={i}>
            <path d="M60 62 Q100 46 140 62 L140 74 Q100 62 60 74 Z" fill="#C81E76" />
            <path d="M140 68 q22 4 24 24 q-14 -10 -28 -14 Z" fill="#C81E76" opacity="0.9" />
            <circle cx="78" cy="66" r="2.5" fill="#fff" opacity="0.8" />
            <circle cx="104" cy="62" r="2.5" fill="#fff" opacity="0.8" />
            <circle cx="126" cy="68" r="2.5" fill="#fff" opacity="0.8" />
          </g>
        );
      case "Eyepatch":
        return (
          <g key={i}>
            <path d="M56 78 L144 92" stroke="#1B1B24" strokeWidth="4" />
            <rect x="70" y="84" width="26" height="22" rx="5" fill="#12121A" />
          </g>
        );
      case "Face Mask":
        return (
          <g key={i}>
            <path d="M70 100 Q100 96 130 100 Q130 128 100 134 Q70 128 70 100 Z" fill="#DFF3FF" />
            <path d="M70 104 L54 96 M130 104 L146 96" stroke="#B9D8E8" strokeWidth="3" />
            <path d="M76 112 Q100 116 124 112" stroke="#B9D8E8" strokeWidth="2" fill="none" />
          </g>
        );
      case "Ski Goggles":
        return (
          <g key={i}>
            <path d="M58 84 Q100 74 142 84 L142 104 Q100 116 58 104 Z" fill="#12121A" />
            <path d="M66 88 Q100 80 134 88 L134 100 Q100 110 66 100 Z" fill="#5EC9FF" opacity="0.85" />
            <path d="M58 92 L44 96 M142 92 L156 96" stroke="#2E2E3C" strokeWidth="5" />
          </g>
        );
      case "Hoodie":
        return (
          <g key={i}>
            <path d="M50 128 Q100 144 150 128 L150 160 Q100 172 50 160 Z" fill="#3A3A4A" />
            <path d="M64 62 Q100 44 136 62 Q136 84 100 88 Q64 84 64 62 Z" fill="#46465A" opacity="0.95" />
            <path d="M88 134 q12 16 24 0" stroke="#2A2A38" strokeWidth="3" fill="none" />
            <path d="M50 128 L36 118 L46 106 L60 116 Z" fill="#3A3A4A" />
            <path d="M150 128 L164 118 L154 106 L140 116 Z" fill="#3A3A4A" />
          </g>
        );
      case "Leather Jacket":
        return (
          <g key={i}>
            <path d="M52 128 Q100 142 148 128 L148 160 Q100 170 52 160 Z" fill="#1B1B24" />
            <path d="M86 128 L100 150 L114 128" fill="#2E2E3C" />
            <path d="M100 132 L100 162" stroke="#8B8598" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M52 128 L38 118 L48 108 L62 118 Z" fill="#1B1B24" />
            <path d="M148 128 L162 118 L152 108 L138 118 Z" fill="#1B1B24" />
          </g>
        );
      case "Varsity Jacket":
        return (
          <g key={i}>
            <path d="M52 128 Q100 142 148 128 L148 160 Q100 170 52 160 Z" fill="#8B1E2E" />
            <path d="M52 128 L38 118 L48 108 L62 118 Z" fill="#EDEAF5" />
            <path d="M148 128 L162 118 L152 108 L138 118 Z" fill="#EDEAF5" />
            <path d="M56 154 Q100 164 144 154" stroke="#EDEAF5" strokeWidth="5" fill="none" />
            <text x="118" y="150" fontSize="17" fontWeight="800" fill="#EDEAF5" fontFamily="sans-serif">M</text>
          </g>
        );
      case "Denim Vest":
        return (
          <g key={i}>
            <path d="M58 128 Q76 140 84 138 L84 162 L58 160 Z" fill="#3F6EA5" />
            <path d="M142 128 Q124 140 116 138 L116 162 L142 160 Z" fill="#3F6EA5" />
            <path d="M62 134 L62 156 M138 134 L138 156" stroke="#2C5480" strokeWidth="2" strokeDasharray="3 3" />
          </g>
        );
      case "Overalls":
        return (
          <g key={i}>
            <path d="M74 132 Q100 140 126 132 L126 168 L74 168 Z" fill="#3F6EA5" />
            <path d="M78 132 L72 108 M122 132 L128 108" stroke="#3F6EA5" strokeWidth="7" strokeLinecap="round" />
            <rect x="88" y="140" width="24" height="18" rx="3" fill="#35608F" />
            <circle cx="74" cy="112" r="3.5" fill="#FFB020" />
            <circle cx="126" cy="112" r="3.5" fill="#FFB020" />
          </g>
        );
      case "Cargo Pants":
        return (
          <g key={i}>
            <path d="M72 146 L128 146 L124 182 L106 182 L100 160 L94 182 L76 182 Z" fill="#5E6B44" />
            <rect x="70" y="154" width="12" height="14" rx="2" fill="#4C5738" />
            <rect x="118" y="154" width="12" height="14" rx="2" fill="#4C5738" />
          </g>
        );
      case "Kneepads":
        return (
          <g key={i}>
            <ellipse cx="84" cy="168" rx="12" ry="10" fill="#2E2E3C" />
            <ellipse cx="116" cy="168" rx="12" ry="10" fill="#2E2E3C" />
            <path d="M74 168 h20 M106 168 h20" stroke="#8B8598" strokeWidth="2.5" />
          </g>
        );
      case "Flip Flops":
        return (
          <g key={i}>
            <ellipse cx="80" cy="182" rx="15" ry="7" fill="#5EC9FF" />
            <ellipse cx="120" cy="182" rx="15" ry="7" fill="#5EC9FF" />
            <path d="M80 178 L74 184 M80 178 L86 184" stroke="#2C86C4" strokeWidth="2.5" />
            <path d="M120 178 L114 184 M120 178 L126 184" stroke="#2C86C4" strokeWidth="2.5" />
          </g>
        );
      case "Wristband":
        return (
          <g key={i}>
            <rect x="36" y="122" width="18" height="10" rx="4" fill="#C6FF3D" />
            <rect x="146" y="122" width="18" height="10" rx="4" fill="#C6FF3D" />
          </g>
        );
      case "Backpack":
        return (
          <g key={i}>
            <rect x="34" y="112" width="26" height="38" rx="7" fill="#4C5738" />
            <rect x="38" y="122" width="18" height="12" rx="3" fill="#3B4429" />
            <path d="M60 118 Q76 126 76 142" stroke="#3B4429" strokeWidth="5" fill="none" />
          </g>
        );
      case "Messenger Bag":
        return (
          <g key={i}>
            <path d="M66 74 Q104 106 138 130" stroke="#6B4A2E" strokeWidth="6" fill="none" />
            <rect x="126" y="126" width="34" height="26" rx="5" fill="#8B5A2B" />
            <path d="M126 134 h34" stroke="#6B4A2E" strokeWidth="4" />
          </g>
        );
      case "Fanny Pack":
        return (
          <g key={i}>
            <path d="M62 146 Q100 154 138 146" stroke="#C81E76" strokeWidth="5" fill="none" />
            <rect x="86" y="142" width="30" height="18" rx="5" fill="#FF3EA5" />
            <path d="M86 150 h30" stroke="#C81E76" strokeWidth="3" />
          </g>
        );
      case "Toolbelt":
        return (
          <g key={i}>
            <path d="M60 148 Q100 158 140 148" stroke="#6B4A2E" strokeWidth="7" fill="none" />
            <rect x="68" y="150" width="14" height="18" rx="3" fill="#8B5A2B" />
            <rect x="118" y="150" width="14" height="18" rx="3" fill="#8B5A2B" />
            <rect x="94" y="146" width="14" height="10" rx="2" fill="#FFB020" />
          </g>
        );
      case "Prayer Beads":
        return (
          <g key={i}>
            <path d="M78 106 Q100 138 122 106" stroke="#8B5A2B" strokeWidth="2" fill="none" />
            {[80,88,96,104,112,120].map((x, k) => (
              <circle key={k} cx={x} cy={112 + Math.sin((k - 2.5) * 0.9) * -12 + 14} r="4" fill="#C08B4A" />
            ))}
            <circle cx="100" cy="140" r="5.5" fill="#FFB020" />
          </g>
        );
      case "Fishing Rod":
        return (
          <g key={i}>
            <path d="M150 168 L168 58" stroke="#8B5A2B" strokeWidth="4" strokeLinecap="round" />
            <path d="M168 58 Q152 74 156 102" stroke="#EDEAF5" strokeWidth="1.5" fill="none" opacity="0.8" />
            <circle cx="156" cy="104" r="4" fill="#C81E76" />
            <circle cx="158" cy="140" r="6" fill="#5E6B44" />
          </g>
        );
      case "MMA Gloves":
        return (
          <g key={i}>
            <path d="M34 112 q-6 10 2 18 q10 8 20 0 q6 -8 0 -16 q-10 -8 -22 -2 Z" fill="#FF4D4D" stroke="#B82E2E" strokeWidth="2" />
            <path d="M40 118 L52 118 M40 124 L52 124" stroke="#B82E2E" strokeWidth="2" />
            <path d="M166 112 q6 10 -2 18 q-10 8 -20 0 q-6 -8 0 -16 q10 -8 22 -2 Z" fill="#FF4D4D" stroke="#B82E2E" strokeWidth="2" />
            <path d="M160 118 L148 118 M160 124 L148 124" stroke="#B82E2E" strokeWidth="2" />
          </g>
        );
      default:
        return null;
    }
  };

  // ---- DEPTH BANDS ---------------------------------------------------------
  // Which visual plane each accessory lives on. Anything not listed defaults to
  // "front", which is the safe choice for held objects and new additions.
  // HAIR sits in `head` BEFORE hats, so a hat covers the hair rather than the
  // other way round; masks and glasses come after the eyes so they read as worn.
  const LAYER = {
    behind: ["Dragon Aura", "Ultimate Aura", "Blessed Aura", "Cosmic Aura", "Dark Aura",
             "Cape", "Angel Wings", "Long Flowing Hair", "Backpack", "Messenger Bag", "Fishing Rod"],
    body:   ["Sweater", "Hoodie", "Jersey", "Trench Coat", "Police Suit", "Scrubs", "Chef Apron",
             "Leather Jacket", "Varsity Jacket", "Denim Vest", "Overalls", "Shorts", "Cargo Pants",
             "Meme Corps Armor", "Scarf", "Chain", "Prayer Beads", "Fanny Pack", "Toolbelt",
             "Wristband", "Kneepads", "Flip Flops", "Basic Sneakers", "Hype Kicks"],
    head:   ["Dreadlocks", "Braids", "Mohawk", "Durag", "Wif Hat (Knit Beanie)", "Golden Wif Hat",
             "Cowboy Hat", "Baseball Hat", "Top Hat", "Bucket Hat", "Bandana", "Crown", "Halo",
             "Devil Horns", "Earrings"],
    face:   ["Sunglasses", "Cyber Visor", "Ski Goggles", "Eyepatch", "Face Mask", "Long Lashes",
             "Laser Eyes", "Beard", "Cigar"],
  };
  const bandOf = (a) =>
    LAYER.behind.includes(a) ? "behind"
    : LAYER.body.includes(a) ? "body"
    : LAYER.head.includes(a) ? "head"
    : LAYER.face.includes(a) ? "face"
    : "front";
  // Keep the original index as the React key so re-orders never remount a node.
  const sortedAccessories = { behind: [], body: [], head: [], face: [], front: [] };
  (accessories || []).forEach((a, i) => sortedAccessories[bandOf(a)].push([a, i]));

  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <linearGradient id="rainbowGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF3EA5" />
          <stop offset="50%" stopColor="#C6FF3D" />
          <stop offset="100%" stopColor="#5EC9FF" />
        </linearGradient>
        {c2 && !isRainbow && (
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1 === "RAINBOW" ? "#FF3EA5" : c1} />
            <stop offset="100%" stopColor={c2 === "RAINBOW" ? "#5EC9FF" : c2} />
          </linearGradient>
        )}
      </defs>
      {/* ---- LAYER 0: everything that belongs BEHIND the mascot ----------
           Auras, capes, wings and long hair used to draw in whatever order the
           user happened to CLICK them, which put capes in front of chests and
           auras on top of faces. Now every accessory is sorted into a depth
           band first, so the stack is correct no matter what order it was
           picked in. */}
      {sortedAccessories.behind.map(([a, i]) => overlayFor(a, i))}

      {/* ---- LAYER 1: the body itself (hybrid ghost behind the primary) --- */}
      {archetypes[1] && <g opacity="0.35" transform="translate(8,-6) scale(0.95)">{shapeFor(archetypes[1], fill)}</g>}
      {shapeFor(archetypes[0] || "Animal", fill)}

      {/* ---- LAYER 2: clothing sits ON the body, under the face ---------- */}
      {sortedAccessories.body.map(([a, i]) => overlayFor(a, i))}

      {/* ---- LAYER 3: the face ------------------------------------------- */}
      {eyes()}

      {/* ---- LAYER 4: worn on the head — hair, then hats over the hair ---- */}
      {sortedAccessories.head.map(([a, i]) => overlayFor(a, i))}

      {/* ---- LAYER 5: on the face — glasses, masks, beards --------------- */}
      {sortedAccessories.face.map(([a, i]) => overlayFor(a, i))}

      {/* ---- LAYER 6: held in front of everything ------------------------ */}
      {sortedAccessories.front.map(([a, i]) => overlayFor(a, i))}
    </svg>
  );
}

function WebsitePreview({ result, traits, token }) {
  if (!result) return null;
  const fill = COLOR_HEX[traits.colors[0]] === "RAINBOW" ? LIME : COLOR_HEX[traits.colors[0]] || LIME;
  // Live once the user has LINKED a token they launched on pump.fun; a mockup
  // (labeled as such) until then. MascotGen never launches the token itself.
  const buyUrl = token && token.address ? (token.url || `https://pump.fun/coin/${token.address}`) : null;
  const tgUrl = token && token.telegram ? token.telegram : null;
  return (
    <div className="w-full rounded-xl border overflow-hidden" style={{ borderColor: HAIRLINE, backgroundColor: PANEL }}>
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: HAIRLINE }}>
        <span className="font-bold text-sm" style={{ color: fill }}>
          ${result.ticker}
        </span>
        <div className="flex gap-4 text-xs" style={{ color: MUTED }}>
          <span>About</span>
          <span>Tokenomics</span>
          <span>Community</span>
        </div>
      </div>

      <div className="flex flex-col items-center text-center px-6 py-12">
        <MascotSVG archetypes={traits.archetypes} colors={traits.colors} accessories={traits.accessories} size={140} />
        <h1 className="text-2xl font-bold mt-4" style={{ color: OFFWHITE }}>
          {result.tokenName}
        </h1>
        <p className="text-sm mt-2 italic" style={{ color: fill }}>
          "{result.tagline}"
        </p>
        <div className="flex gap-3 mt-6">
          {buyUrl ? (
            <a href={buyUrl} target={EXT_TAB} rel="noopener noreferrer" className="px-5 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: fill, color: INK }}>
              BUY ON PUMP.FUN
            </a>
          ) : (
            <span className="px-5 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: fill, color: INK, opacity: 0.45 }} title="Link a launched token to activate">
              BUY ON PUMP.FUN
            </span>
          )}
          {tgUrl ? (
            <a href={tgUrl} target={EXT_TAB} rel="noopener noreferrer" className="px-5 py-2 rounded-lg text-xs font-bold border" style={{ borderColor: fill, color: fill }}>
              JOIN TELEGRAM
            </a>
          ) : (
            <span className="px-5 py-2 rounded-lg text-xs font-bold border" style={{ borderColor: fill, color: fill, opacity: 0.45 }}>
              JOIN TELEGRAM
            </span>
          )}
        </div>
        {!buyUrl && (
          <p className="text-[10px] mt-3" style={{ color: MUTED }}>
            Preview — this is what your token page could look like. Launch a token on pump.fun and link it in the Studio to make these buttons live.
          </p>
        )}
      </div>

      <div className="px-6 py-8 border-t" style={{ borderColor: HAIRLINE }}>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: MUTED }}>
          About {result.characterName}
        </p>
        <p className="text-sm leading-relaxed" style={{ color: OFFWHITE }}>
          {result.bio}
        </p>
      </div>

      <div className="px-6 py-8 border-t grid grid-cols-3 gap-4 text-center" style={{ borderColor: HAIRLINE }}>
        {[
          ["Supply", "1,000,000,000"],
          ["Tax", "0%"],
          ["LP", "Locked"],
        ].map(([label, val]) => (
          <div key={label}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>
              {label}
            </p>
            <p className="text-sm font-bold" style={{ color: fill }}>
              {val}
            </p>
          </div>
        ))}
      </div>

      <div className="px-6 py-4 border-t text-center text-xs" style={{ borderColor: HAIRLINE, color: MUTED }}>
        Auto-generated preview — connect a real domain + wallet before launch
      </div>
    </div>
  );
}

function CRTStyles() {
  return (
    <style>{`
      @keyframes crtFlicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.82} 94%{opacity:1} 97%{opacity:0.93} 98%{opacity:1} }
      @keyframes memeFall {
        0% { transform: translateY(-90px); opacity: 0; }
        8% { opacity: 0.9; }
        90% { opacity: 0.9; }
        100% { transform: translateY(110vh); opacity: 0; }
      }
      @keyframes matrixFall {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100%); }
      }
      .crt { animation: crtFlicker 6s infinite; position: relative; }
      .crt::after {
        content:""; position:absolute; inset:0; pointer-events:none; z-index: 30;
        background: repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 2px, transparent 4px);
      }
      .meme-drop { position: absolute; top: 0; animation: memeFall linear infinite; filter: grayscale(1) contrast(1.25); z-index: 1; }
      .matrix-col { position: absolute; top: 0; animation: matrixFall linear infinite; font-family: monospace; color: #FFF; font-size: 9px; line-height: 11px; white-space: pre; opacity: 0.8; }
    `}</style>
  );
}

function MatrixScreen() {
  const cols = [
    { left: "6%", dur: "3.2s", delay: "0s", chars: "1 0 1 1 0 0 1 0 1 1 0 1" },
    { left: "20%", dur: "2.4s", delay: "0.6s", chars: "0 1 0 0 1 1 0 1 0 0 1 0" },
    { left: "34%", dur: "3.8s", delay: "0.2s", chars: "1 1 0 1 0 1 1 0 0 1 0 1" },
    { left: "48%", dur: "2.8s", delay: "1.1s", chars: "0 0 1 0 1 0 1 1 0 1 1 0" },
    { left: "62%", dur: "3.5s", delay: "0.4s", chars: "1 0 0 1 1 0 0 1 1 0 0 1" },
    { left: "76%", dur: "2.6s", delay: "0.9s", chars: "0 1 1 0 0 1 0 0 1 1 0 1" },
    { left: "88%", dur: "3.1s", delay: "0.3s", chars: "1 1 0 0 1 0 1 0 1 0 1 1" },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {cols.map((c, i) => (
        <div key={i} className="matrix-col" style={{ left: c.left, animationDuration: c.dur, animationDelay: c.delay }}>
          {c.chars.split(" ").join("\n")}
        </div>
      ))}
    </div>
  );
}

// 📡 THE BROADCAST — the landing page as a live transmission from the
// Pentaverse. Live ticker (real ecosystem numbers), a scrolling roster of
// REAL minted mascots, the four pillars, and the doors that close. The CRT
// idea survives as a film grade (scanlines + vignette) over a real page
// instead of a cartoon TV set.
// Mascots kept OFF the landing-page roster (by exact character name). The home
// page is the first impression, so anything off-brand or awaiting a burn stays
// out of it — this does NOT remove them from the Market or anyone's Legion.
const HOME_ROSTER_HIDE = ["Calyx Redline"];

function BroadcastStyles() {
  return (
    <style>{`
      @keyframes bcSlide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      @keyframes bcBlink { 0%,50% { opacity: 1; } 51%,100% { opacity: .15; } }
      @keyframes bcPulse { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
    `}</style>
  );
}

function HomePage({ onStart, onWhitepaper, fullscreen }) {
  const [eco, setEco] = useState(null);
  const [roster, setRoster] = useState([]);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await fetch("/api/battle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ecosystem" }) });
        const d = await r.json();
        if (!dead && r.ok) setEco(d);
      } catch (e) {}
      try {
        const r = await fetch("/api/battle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "gallery" }) });
        const d = await r.json();
        if (!dead && r.ok) setRoster(((d.items || []).filter((m) => !m.sealed && m.image && !HOME_ROSTER_HIDE.includes(m.name))).slice(0, 14));
      } catch (e) {}
    })();
    return () => { dead = true; };
  }, []);

  const line = "#26232F";
  const founding = eco && eco.founding;
  const totals = eco && eco.totals;
  const marked = eco && eco.marked;
  const nextAge = eco && eco.nextAge;

  // Ticker items — live when the API answers, lore-true placeholders until.
  const ticks = [
    <span key="t1">⭐ <b style={{ color: OFFWHITE }}>Founding 333</b> — <span style={{ color: AMBER }}>{founding ? `${founding.remaining} seats remain` : "all Legendary, then the door welds shut"}</span></span>,
    <span key="t2">✧ God thrones — <b style={{ color: "#FF9DF2" }}>{totals ? `${totals.thronesSeated} / ${totals.thronesTotal} seated` : "12 exist"}</b> · 0.01% per paid mint</span>,
    <span key="t3">✋ God-Marked — <b style={{ color: "#FFF3B0" }}>{marked ? `${marked.claimed} / 777` : "777 will ever exist"}</b></span>,
    <span key="t4">⚔️ <b style={{ color: OFFWHITE }}>{totals ? totals.battles : "—"}</b> battles fought · <span style={{ color: LIME }}>0</span> NFTs harmed</span>,
    <span key="t5">⏳ Next age: <b style={{ color: "#C084FC" }}>{nextAge ? `${nextAge.name.replace("The Champions — Season 1", "The Champions")} in ${nextAge.remaining.toLocaleString()} mints` : "The Champions at mint 11,111"}</b></span>,
    <span key="t6">👥 The Mirror Realm is watching</span>,
  ];

  const pillars = [
    { tag: "DETERMINISTIC", tc: LIME, t: "Stats you can verify", d: "Every card's numbers come from its traits through the same open engine — nothing random at battle time, nothing editable after the mint. What you hold is exactly what you play." },
    { tag: "SERVER-ROLLED", tc: AMBER, t: "Rarity you can't buy", d: "Tier, birth universe and every god throne are rolled on our servers the moment a pack opens. Published odds. A pity system. Nobody — including us — can tilt a single roll." },
    { tag: "PERMANENT", tc: MAGENTA, t: "A canon that travels", d: "Chapters, battles and resurrections attach to the NFT itself. Sell it and the whole saga goes with it. Nothing is ever deleted — not even death." },
    { tag: "FREE FOREVER", tc: "#5EC9FF", t: "Games with no house edge", d: "Battle Arena and the Grand Circuit cost nothing to play. No wagering, no entry fees, no stakes. Losing never touches your NFT or your story." },
  ];

  const doors = [
    { ic: "⭐", t: "The Founding 333", d: "The first 333 mints in history are ALL Legendary. Then it welds shut, forever.", n: founding ? `${founding.claimed} / ${founding.target}` : "— / 333", c: AMBER },
    { ic: "✧", t: "The Twelve Thrones", d: "Super Legendary gods. 0.01% on every paid mint — even a $19.99 one.", n: totals ? `${totals.thronesSeated} / ${totals.thronesTotal}` : "— / 12", c: "#FF9DF2" },
    { ic: "✋", t: "The God-Marked", d: "777 mortals, ever. Lands on any rarity. +77 HP and a power lent by a god.", n: marked ? `${marked.claimed} / 777` : "— / 777", c: "#FFF3B0" },
    { ic: "⏳", t: "The Ages", d: "Champions at 11,111 · Demons at 66,666 · Archangels at 111,111. Automatic.", n: nextAge ? `${nextAge.remaining.toLocaleString()} TO GO` : "LOCKED", c: "#C084FC" },
  ];

  const rosterCards = roster.length ? [...roster, ...roster] : [];

  return (
    <div
      className={fullscreen ? "overflow-hidden" : "rounded-xl border overflow-hidden"}
      style={{ borderColor: fullscreen ? "transparent" : HAIRLINE, backgroundColor: "#0B0A0F", position: "relative", minHeight: fullscreen ? "100vh" : "70vh", color: OFFWHITE }}
    >
      <BroadcastStyles />
      {/* Film grade: glow field + vignette + scanlines. Absolute (not fixed)
          so the non-fullscreen home tab doesn't paint over the app chrome. */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(circle at 22% 26%, rgba(255,62,165,0.13), transparent 46%), radial-gradient(circle at 78% 34%, rgba(198,255,61,0.10), transparent 44%), radial-gradient(circle at 50% 84%, rgba(255,182,39,0.09), transparent 52%)" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40, background: "radial-gradient(ellipse at 50% 42%, transparent 42%, rgba(0,0,0,0.72) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 41, background: "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0 2px, rgba(0,0,0,0.16) 2px 4px)", mixBlendMode: "multiply", opacity: 0.6 }} />

      {/* LIVE TICKER */}
      <div style={{ position: "relative", zIndex: 10, borderBottom: `1px solid ${line}`, backgroundColor: "rgba(0,0,0,0.55)", overflow: "hidden", height: 32, display: "flex", alignItems: "center" }}>
        <div style={{ flex: "none", backgroundColor: MAGENTA, color: "#0B0A0F", fontWeight: 900, fontSize: 9.5, letterSpacing: "0.14em", padding: "0 11px", height: "100%", display: "flex", alignItems: "center", zIndex: 2 }}>◉ LIVE</div>
        <div style={{ display: "flex", gap: 44, whiteSpace: "nowrap", animation: "bcSlide 34s linear infinite", paddingLeft: 26, fontSize: 11, color: MUTED }}>
          {[...ticks, ...ticks].map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 10, maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}>
        {/* HERO */}
        <section style={{ textAlign: "center", padding: "72px 0 54px" }}>
          <p className="font-mono" style={{ fontSize: 10.5, letterSpacing: "0.3em", color: MUTED, marginBottom: 26, fontFamily: "ui-monospace, monospace" }}>
            [ SIGNAL <span style={{ color: MAGENTA }}>LIVE</span> · CH 11 · THE PENTAVERSE · EST. 2026 <span style={{ animation: "bcBlink 1.4s steps(1) infinite" }}>▌</span> ]
          </p>
          <h1 style={{ fontSize: "clamp(40px, 7.4vw, 78px)", lineHeight: 0.92, fontWeight: 900, letterSpacing: "-0.03em" }}>
            MEME COINS DIE.
            <span style={{ display: "block", background: `linear-gradient(96deg, ${LIME}, ${AMBER} 48%, ${MAGENTA})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              LEGENDS DON'T.
            </span>
          </h1>
          <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.68, maxWidth: 600, margin: "26px auto 0" }}>
            You build the character. The Pentaverse decides the rest — its rarity, its birth
            universe, whether one of the twelve gods reaches down. After that it's yours to write,
            and <b style={{ color: OFFWHITE }}>it can't die</b>: every chapter, every fight, even
            death itself becomes permanent canon that travels with the NFT.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 34, flexWrap: "wrap" }}>
            <button onClick={onStart} style={{ cursor: "pointer", border: 0, fontWeight: 800, fontSize: 13.5, letterSpacing: "0.04em", padding: "15px 30px", borderRadius: 10, backgroundColor: OFFWHITE, color: "#0B0A0F" }}>
              ▶ ENTER THE STUDIO
            </button>
            <button onClick={onWhitepaper || onStart} style={{ cursor: "pointer", fontWeight: 800, fontSize: 13.5, letterSpacing: "0.04em", padding: "15px 30px", borderRadius: 10, backgroundColor: "transparent", color: OFFWHITE, border: "1px solid #38343F" }}>
              Read the whitepaper
            </button>
          </div>
          <p style={{ fontSize: 11, color: "#5F5B72", marginTop: 15 }}>Free tier · 5 generations · no wallet required to start</p>
        </section>
      </div>

      {/* THE ROSTER — real minted mascots, endless scroll. Hidden until the
          gallery answers; placeholders would undercut "everything is real". */}
      {rosterCards.length > 0 && (
        <div style={{ position: "relative", zIndex: 10, borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}`, padding: "22px 0", overflow: "hidden", backgroundColor: PANEL2 }}>
          <div style={{ display: "flex", gap: 14, animation: "bcSlide 40s linear infinite", width: "max-content" }}>
            {rosterCards.map((m, i) => {
              const c = rarityColorMap[m.tier] || "#5EC9FF";
              return (
                <div key={i} style={{ width: 150, flex: "none", borderRadius: 12, padding: 2, background: `linear-gradient(135deg, ${c}, transparent 72%)` }}>
                  <div style={{ backgroundColor: "#141218", borderRadius: 10, overflow: "hidden" }}>
                    <img src={m.image} alt={m.name} loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                    <div style={{ padding: "8px 9px 10px" }}>
                      <p style={{ fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.god ? "✧ " : ""}{m.name}</p>
                      <p style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.1em", marginTop: 2, color: c, textTransform: "uppercase" }}>{m.tier}</p>
                      <p style={{ fontSize: 8.5, color: MUTED, marginTop: 4 }}>{m.universe || "Genesis Era"}{m.markNumber ? ` · ✋ #${m.markNumber}` : ""}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ position: "relative", zIndex: 10, maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}>
        {/* PILLARS */}
        <section style={{ padding: "66px 0" }}>
          <p style={{ fontSize: 10.5, letterSpacing: "0.22em", color: AMBER, fontWeight: 800, marginBottom: 14 }}>WHY THIS ISN'T ANOTHER PFP</p>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.08 }}>
            Four things nobody else<br />gives your character.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14, marginTop: 36, display: "grid" }}>
            {pillars.map((p, i) => (
              <div key={p.tag} style={{ backgroundColor: "#16141D", border: `1px solid ${line}`, borderRadius: 16, padding: 26, position: "relative", overflow: "hidden" }}>
                <span style={{ position: "absolute", right: 16, bottom: 2, fontSize: 62, fontWeight: 900, color: "rgba(255,255,255,0.035)", lineHeight: 1 }}>0{i + 1}</span>
                <span style={{ display: "inline-block", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 5, marginBottom: 12, backgroundColor: `${p.tc}24`, color: p.tc }}>{p.tag}</span>
                <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 9 }}>{p.t}</h3>
                <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.65 }}>{p.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* THE DOORS */}
        <section style={{ padding: "0 0 66px" }}>
          <p style={{ fontSize: 10.5, letterSpacing: "0.22em", color: AMBER, fontWeight: 800, marginBottom: 14 }}>THE DOORS THAT CLOSE</p>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.08, marginBottom: 30 }}>
            Scarcity written in code,<br />not in a tweet.
          </h2>
          <div style={{ backgroundColor: "#16141D", border: `1px solid ${line}`, borderRadius: 18, padding: "8px 30px" }}>
            {doors.map((d, i) => (
              <div key={d.t} style={{ display: "flex", alignItems: "center", gap: 16, padding: "15px 0", borderBottom: i < doors.length - 1 ? `1px solid ${line}` : "none" }}>
                <div style={{ fontSize: 22, width: 34, flex: "none", textAlign: "center" }}>{d.ic}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 800 }}>{d.t}</p>
                  <p style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>{d.d}</p>
                </div>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 800, flex: "none", color: d.c }}>{d.n}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CLOSER */}
        <section style={{ textAlign: "center", padding: "10px 0 84px" }}>
          <h2 style={{ fontSize: "clamp(30px, 5vw, 46px)", fontWeight: 900, marginBottom: 16 }}>Tune in.</h2>
          <p style={{ color: MUTED, maxWidth: 540, margin: "0 auto 30px", lineHeight: 1.66, fontSize: 15 }}>
            Five universes on a five-point star. {totals ? `${totals.thronesSeated} gods seated, ${totals.thronesUnclaimed} thrones hungry.` : "Nine gods seated, three thrones hungry."} Your
            character starts as a blank — what it becomes is on you.
          </p>
          <button onClick={onStart} style={{ cursor: "pointer", border: 0, fontWeight: 800, fontSize: 13.5, letterSpacing: "0.04em", padding: "15px 30px", borderRadius: 10, backgroundColor: OFFWHITE, color: "#0B0A0F" }}>
            ▶ ENTER THE STUDIO
          </button>
          <p className="font-mono" style={{ fontSize: 10, color: "#4E4A5E", marginTop: 28, letterSpacing: "0.2em", fontFamily: "ui-monospace, monospace" }}>
            [ SIGNAL: LIVE · CH 11 · EST. 2026 ]
          </p>
        </section>
      </div>
    </div>
  );
}

function TradingCardView({ entry, stats, onClose }) {
  const tier = entry.mintTier || null;
  const universe = entry.mintUniverse || null;
  const isGenesis = !!entry.mintAddress && !universe;
  // Metallic border palettes per rarity — the "pops off the page" lining.
  // Super Legendary (the 11 gods) gets the animated-feel holographic frame.
  const frames = {
    "Super Legendary": { border: "linear-gradient(115deg,#FF9DF2,#7DF9FF,#FFF3B0,#C084FC,#7DF9FF,#FF9DF2)", glow: "0 0 44px rgba(255,157,242,0.65)", label: "#FF9DF2" },
    Legendary: { border: "linear-gradient(135deg,#F5D46A,#B8860B,#FFF3C4,#D4AF37)", glow: "0 0 34px rgba(245,212,106,0.55)", label: "#F5D46A" },
    Epic: { border: "linear-gradient(135deg,#C084FC,#7C3AED,#E9D5FF,#A855F7)", glow: "0 0 30px rgba(168,85,247,0.5)", label: "#C084FC" },
    Rare: { border: "linear-gradient(135deg,#7DD3FC,#0284C7,#E0F2FE,#38BDF8)", glow: "0 0 26px rgba(56,189,248,0.45)", label: "#7DD3FC" },
    Common: { border: "linear-gradient(135deg,#D1D5DB,#6B7280,#F9FAFB,#9CA3AF)", glow: "0 0 18px rgba(209,213,219,0.35)", label: "#D1D5DB" },
    default: { border: "linear-gradient(135deg,#E5E4E2,#A8A9AD,#FFFFFF,#C0C0C5)", glow: "0 0 22px rgba(229,228,226,0.4)", label: "#E5E4E2" },
  };
  const f = frames[tier] || frames.default;
  const cardArt = entry.mintedArtUrl || entry.artUrl;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <HoloStyles />
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-[5px]"
        style={{ background: f.border, backgroundSize: "300% 300%", animation: "holoShift 6s linear infinite", boxShadow: f.glow }}
      >
        <div className="rounded-[11px] overflow-hidden" style={{ backgroundColor: "#141218" }}>
          {/* Header: name + rarity + universe */}
          <div className="flex items-center justify-between px-3 py-2" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.07),transparent)" }}>
            <div className="min-w-0">
              <p className="font-black text-sm truncate" style={{ color: OFFWHITE }}>{entry.result.characterName}</p>
              <p className="text-[10px]" style={{ color: MUTED }}>${entry.result.ticker} · {entry.result.tokenName}</p>
              {universe && universe === "Empyrion" && (
                <p className="text-[10px] holo-text">⭐ EMPYRION — NORTH UNIVERSE</p>
              )}
              {universe && universe !== "Empyrion" && (
                <p className="text-[10px] font-bold" style={{ color: UNIVERSE_COLORS[universe] || MUTED }}>
                  {UNIVERSE_ICONS[universe] || "◈"} {universe.toUpperCase()}
                </p>
              )}
              {isGenesis && (
                <p className="text-[10px] font-bold" style={{ color: "#C8CDD6" }}>✦ GENESIS ERA — pre-Pentaverse</p>
              )}
            </div>
            <div className="text-right shrink-0">
              {tier && (
                <p className="text-xs font-black" style={{ color: f.label }}>
                  {tier === "Super Legendary" ? "✧ SUPER LEGENDARY ✧" : tier === "Legendary" ? "⭐ LEGENDARY" : tier.toUpperCase()}
                </p>
              )}
              {entry.mintSeason && <p className="text-[9px]" style={{ color: f.label }}>Season {entry.mintSeason}</p>}
              {entry.markNumber && (
                <p className="text-[9px] font-black" style={{ color: "#FFF3B0", textShadow: "0 0 8px rgba(255,243,176,0.8)" }}>
                  ✋ GOD-MARKED #{entry.markNumber}/777
                </p>
              )}
              {!tier && <p className="text-[10px]" style={{ color: MUTED }}>UNMINTED</p>}
            </div>
          </div>
          {/* Art */}
          {cardArt ? (
            <div className="mx-2 rounded-lg overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
              <img src={cardArt} alt={entry.result.characterName} className="w-full block" />
            </div>
          ) : (
            <div className="mx-2 rounded-lg flex items-center justify-center py-10" style={{ backgroundColor: "#1D1B24" }}>
              <MascotSVG archetypes={entry.traits.archetypes || ["Frog"]} colors={entry.traits.colors || ["Neon Green"]} accessories={entry.traits.accessories || []} size={140} />
            </div>
          )}
          {/* Stats */}
          <div className="px-3 py-2">
            <div className="grid grid-cols-4 gap-1 text-center mb-2">
              {[["PWR", stats.power], ["HP", stats.hp], ["SPD", stats.speed], ["SPC", stats.special]].map(([k, v]) => (
                <div key={k} className="rounded py-1" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                  <p className="text-[9px]" style={{ color: MUTED }}>{k}</p>
                  <p className="text-sm font-black" style={{ color: f.label }}>{v}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px]" style={{ color: MUTED }}>Battle HP <span style={{ color: "#4DFF88", fontWeight: 800 }}>{stats.hpPoints}</span></span>
              {stats.element && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${stats.element.color}22`, color: stats.element.color, border: `1px solid ${stats.element.color}` }}>
                  {stats.element.icon} {stats.element.id}
                </span>
              )}
            </div>
            {[...stats.signatures, ...stats.abilities].slice(0, tier === "Super Legendary" ? 7 : 4).map((a, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] py-0.5" style={{ borderTop: i === 0 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <span style={{ color: a.kind === "god" ? "#FF9DF2" : OFFWHITE }}>{a.icon} {a.name}</span>
                <span className="font-bold" style={{ color: a.kind === "god" ? "#FF9DF2" : f.label }}>{a.label}</span>
              </div>
            ))}
            <p className="text-[9px] italic mt-1.5 leading-snug" style={{ color: MUTED }}>"{entry.result.tagline}"</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhitepaperPage() {
  const S = ({ n, title, children }) => (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: LIME }}>
        {n} · {title}
      </p>
      <div className="text-sm leading-relaxed" style={{ color: OFFWHITE }}>{children}</div>
    </div>
  );
  const B = ({ children }) => <strong style={{ color: AMBER }}>{children}</strong>;
  return (
    <div className="rounded-xl border p-5 md:p-8 max-w-3xl mx-auto" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
      <h1 className="text-xl font-bold mb-1" style={{ color: LIME }}>MascotGen ($MGEN) — Whitepaper</h1>
      <p className="text-xs mb-6" style={{ color: MUTED }}>v1.0 · The Pentaverse, the Twelve Thrones, and the war that drowned the five</p>

      <S n="01" title="The Cord">
        <span style={{ color: MUTED, fontStyle: "italic" }}>This is the origin myth of the world your character will be born into. If you'd rather know what MascotGen actually does first, start at 02 and come back.</span>
        <br /><br />
        Before the five universes learned to call themselves the Pentaverse, a waterfall ran from Empyrion's highest terrace <em>upward</em> — the only current in creation that refused to fall. That was the cord to heaven. <B>Toro Maximus</B> — the first and greatest of the gods — ruled there the way a mountain occupies a valley — not by pressing down, but by being the thing everything else arranged itself around. His four half-brothers held the lower thrones, and that arithmetic ate at them for a very long time.
        <br /><br />
        So they built <B>vessels</B> — five devices that drained the source of every universe into containers the size of a fist — and came north. The fight happened in the streets where people lived. The market cobbles came up like teeth. But four is four: they killed him, and as his soul climbed the waterfall they aimed all five stolen sources at it. The light didn't scatter. It <em>organized</em> — a wheel within a wheel, rims crowded with unblinking eyes — and it spun the five universes into a whirlpool that dragged him down into the void at the speed of light.
        <br /><br />
        He fell for seven billion years. Not floated. <B>Fell</B> — the dark kept giving. Above him everything ended, and in the silence the <B>Old One</B> restored the five universes and gave creation a second chance.
        <br /><br />
        At the very bottom of the dark, something began to climb.
        <br /><br />
        <span style={{ color: MUTED }}>This is the world your mascot is born into. Not a theme. A history — and the prophecy says it will need more warriors than it has.</span>
      </S>

      <S n="02" title="What MascotGen Is">
        MascotGen is a creative studio that gives a meme character everything a real one has: a name, a face, a voice, a home universe, battle statistics, and an ongoing story that keeps being written after launch day.
        <br /><br />
        You describe a character. The studio generates its identity, its origin, its artwork, and a playable trading card. You can mint it as an NFT on Solana, fight it in the Arena, and expand its saga chapter by chapter — forever, or until you stop.
        <br /><br />
        <B>The premise:</B> most meme tokens die quietly and leave nothing behind. A chart flatlines and the character evaporates. MascotGen is built so the story outlives the chart.
      </S>

      <S n="03" title="The Pentaverse">
        Every mascot is born into one of five universes, arranged as a five-point star and stamped on its card at mint — you cannot choose it.
        <br /><br />
        <B>Ignivar</B> (Fire) · <B>Abyssia</B> (Water) · <B>Terravok</B> (Earth) · <B>Zephyrion</B> (Air) — the four lower realms, each with a throne whoever is strong enough to hold it. And <B>Empyrion</B>, the god-adjacent north point where all four elements mix. About 1 in 20 mascots are born there.
        <br /><br />
        The universes are not distant planets. <B>They are this world, in five layers.</B> Terravok has deserts and neon strips and a colony on Mars; Abyssia has oceans and drowned cities; Zephyrion has storms and architecture that never touches the ground. A casino, a boxing ring, an airport — every place your mascot comes from exists <em>inside</em> the five, which is why a Vegas kingpin and a star-born angel can share one pantheon.
        <br /><br />
        Elements decide battles: Fire beats Earth, Earth beats Air, Air beats Water, Water beats Fire. Birth universe decides where your mascot goes when it dies — Purgatory for the lower four, rest above the waterfall for Empyrion.
      </S>

      <S n="04" title="The Twelve Thrones">
        The pantheon has twelve seats. Nine are occupied. Gods are ✧ Super Legendary: maxed 10/10/10/10 statistics, unique god-tier abilities, and Battle HP far beyond any mortal card.
        <br /><br />
        There are two kinds of god, and the difference matters. <B>The Primordials</B> were born to it — Toro Maximus and the four half-brothers who built the vessels and killed him. That word, <em>brother</em>, belongs to those five and nobody else. <B>The Ascended</B> took it — mortals who claimed vacant thrones after the Restoration. Blaze Malpherion usurped the Fire throne. Gravel Mortis died, went somewhere below Purgatory, and came back holding Terravok's seat with a contract nobody has read. <B>A throne is an office, not a bloodline</B> — which is why one can be yours.
        <br /><br />
        Throne numbers are ledger entries, not rank — thrones are numbered in the order the ledger recorded them, which is why the first and greatest of the gods sits at #6. The house keeps the book. The book does not care who you used to be.
        <br /><br />
        <B>Three thrones remain unclaimed.</B> Every paid mint — including a single $19.99 Starter — carries a <B>0.01% chance</B> of ascension. When those three are taken, the pantheon closes forever and no god card can ever be minted again.
        <br /><br />
        One throne is occupied by a name the Pentaverse has not agreed to speak. The count reconciles; the identity does not. Nobody who has seen it will say more.
      </S>

      <S n="05" title="The Founding 333">
        The first <B>333 mints in MascotGen history are all Legendary</B> — every plan, guaranteed, no exceptions. Then the door closes forever and normal odds begin.
        <br /><br />
        This is not a marketing line that quietly expires. It is enforced in code, the counter is public on the Stats page, and when it ends it can never be reopened. The Founding 333 will always be the oldest cards in existence.
      </S>

      <S n="05b" title="The God-Marked — 777, forever">
        A god cannot be born. A throne opens once in an age and the Pentaverse holds twelve of them, nine seated. But a god can <em>reach down</em>.
        <br /><br />
        <B>777 mortals will ever carry a god's mark.</B> Not gods — mortals the gods have touched. The mark lands on any card at any rarity: a Common from a nowhere province can be marked while a Legendary beside it is not. It grants <B>+77 Battle HP</B> and one borrowed power lent by the throne that marked them, and the twelve thrones each lend something different — so which god reached for you is written into what you can do.
        <br /><br />
        Every paid mint rolls a <B>0.1% chance</B> at a mark. When the 777th is claimed the gods stop reaching, permanently, and no mark can ever be minted again. Unlike the Founding 333 this door does not close in a week — it stays open for years, and the counter on the Stats page is live.
        <br /><br />
        Gods cannot be marked. Nobody lends power to something that already has more of it.
      </S>

      <S n="06" title="The Battle Arena">
        Ghost battles: assemble up to <B>seven</B> minted mascots and challenge any wallet, or a random rival. The arena simulates the whole war server-side using your cards' real statistics, elements, abilities, and god powers.
        <br /><br />
        Your squad fights <em>in the order you pick them</em> — first pick leads, the rest step in as each falls. Glowing deck-health bars track both sides toward defeat. Win +25 rating, lose −25.
        <br /><br />
        <B>Losing never touches your NFT.</B> No wagering, no stakes, no entry fee. Ratings and leaderboard positions have no cash value and cannot be redeemed. This is a game, not a casino.
        <br /><br />
        <B>🏁 The Grand Circuit</B> — the second game. Squads of minted mascots race armed vehicles across 8 Pentaverse circuits: weapons go live on lap 2, lap-3 wrecks are final, elements favor certain tracks, and Sports Car mascots race in true form with their equipped mods while everyone else drives a Battle Kart. Racing keeps its own rating ladder, and the same law applies: no wagering, no stakes, and a wreck never touches the NFT.
      </S>

      <S n="07" title="Meme Wars — victories become canon">
        When you win, you can write the battle into your mascot's permanent story. The saga engine reads the <em>actual</em> combat log — the real moves, the knockouts, the turning points, in order — and writes a chapter naming the opponents you defeated.
        <br /><br />
        That chapter joins the character's portable canon, which travels with the NFT to whoever owns it next. Your card carries the record of who it beat, forever.
      </S>

      <S n="08" title="The Graveyard">
        A mascot silent for 30 days drifts out of the living Pentaverse. Empyrion-born go <B>At Rest</B> above the cosmic waterfall; the lower four wait in <B>Purgatory</B>. The Graveyard is public — every resident is listed with how long they've been quiet.
        <br /><br />
        <B>Nothing is ever deleted.</B> One battle or one new chapter brings any of them back, and a returned mascot wears the mark of its resurrection permanently.
        <br /><br />
        This is the promise underneath everything: in most of crypto, dying means disappearing. Here it means waiting.
      </S>

      <S n="09" title="Rarity — and the odds we publish">
        After the Founding 333, every mint rolls its rarity <B>on our servers</B> at the moment a pack is opened. You cannot choose it, influence it, or buy it. Every paid mint also rolls a separate <B>0.1% chance at a God-Mark</B> (777 total, ever) and a <B>0.01% chance at a god throne</B>.
        <br /><br />
        Starter rolls 77% Common / 23% Rare. Platinum carries a 3% base Legendary chance, Elite 7%. After 5 misses in a row your odds start climbing +1% per miss, capped at 25% — over a full run that works out to about 1 Legendary in 14 mints on Platinum, 1 in 10 on Elite. Legendaries release in limited seasons of roughly 2,000, each card stamped with its season number.
        <br /><br />
        <B>The odds are published on the Pricing page.</B> They are identical for everyone on the same plan, and they are never adjusted per person. We publish them because they're honest.
      </S>

      <S n="10" title="Access & the $MGEN token">
        Four tiers: Free, Starter ($19.99 once — 1 mint), Platinum ($49.99 per 30-day cycle — 3 mints), Elite ($99.99 per 30-day cycle — 7 mints). Each unlocks more of the attribute vault, more generations, more mints, and better Legendary odds. Full detail lives on the Pricing page, which is the authoritative source.
        <br /><br />
        <B>$MGEN has not launched.</B> When it does, holding it will unlock tiers as an alternative to subscribing. It is a utility and access token — not an investment, not a security, and not a promise of return. Anyone telling you otherwise is not us.
      </S>

      <S n="11" title="What we will not do">
        No wagering, betting, or staking anything of value on battle outcomes. No pay-to-win rarity. No adjusting odds per user. No selling your data. No promises about the price of anything. No deleting a character because it went quiet.
      </S>

      <S n="12" title="The Barrier & the Prophecy">
        When the Old One restored the five universes, a barrier was raised around Empyrion — set to hold for <B>7,777,777,777 years</B>. Toro Maximus fell for seven billion of them. The barrier holds for <B>777,777,777 more</B>, and a prophecy written before the war names what must happen before it falls: <em>assemble all the greatest warriors — the Champions, and the angels.</em>
        <br /><br />
        The ages will arrive on mint milestones, each rarer than the last relative to its moment, each stronger than the age before it — because the war the prophecy prepares for demands it:
        <br /><br />
        <B>The Champions (Season 1)</B> — at mint #11,111, the top 33 of the arena are raised: ⚜️ mortals who touched the gods' number, 333 Battle HP, combat-sports blooded. Every Champion carries <B>Giant-Slayer</B> — damage that scales with how far the enemy's HP bar outreaches its own, up to half again — and nothing at all against anything smaller. They were assembled to fight things bigger than themselves; the prophecy is not decoration. 300 more Champion cards release to all paid tiers at published odds — 333 in total, once.
        <br /><br />
        <B>Champions Season 2</B> — at mint #33,333.
        <br /><br />
        <B>The Demon Age</B> — at mint #66,666, the void answers: 666 demons, 666 Battle HP, each bearing a unique named ability — Blood Pact, Void Howl, Dragging Chains, Feast of Embers. Twice a Champion's health and the deepest ability pool in the game: across two seasons 666 Champions will one day face 666 demons, and the demons go in as the favourites. What fell with Toro did not all stay down.
        <br /><br />
        <B>The Archangels</B> — at mint #111,111, they come down the cosmic waterfall: 1,111 at 777 Battle HP. Heaven is rarer than what the void sent first.
        <br /><br />
        And the pattern continues — the counter runs as long as the Pentaverse does. One more thing is written in the oldest layer of the prophecy, and it is not about an age. It is about a visitor. <span style={{ color: MUTED }}>Nobody who has read that far will describe him.</span>
      </S>

      <S n="13" title="Fusion">
        Two mascots enter, one emerges — traits inherited, the parents burned on-chain. Fusion is how the supply breathes: every age adds cards above while Fusion retires them below, so early cards grow scarcer as the world grows larger. Ages trigger on <em>cumulative mints ever created</em>, so burning never slows the story. (In development.)
      </S>

      <S n="14" title="Roadmap">
        <B>Live now:</B> the Studio, the saga engine in 9 languages, artwork generation, NFT minting on Solana with permanent Arweave storage, the Battle Arena, the 🏁 Grand Circuit, Meme Wars canon, the Graveyard, 🛡 The Legion collection gallery, the public Stats page, and the Founding 333.
        <br /><br />
        <B>Next:</B> a verified on-chain collection and marketplace trading · manual turn-by-turn battle mode as the foundation for live PvP · breeding · seasonal war brackets · the $MGEN launch.
        <br /><br />
        <B>At mint #11,111:</B> the Champion age begins — see The Barrier & the Prophecy above. Further out: Fusion, live PvP, and the long war the prophecy names.
      </S>

      <p className="text-xs mt-8 pt-4" style={{ color: MUTED, borderTop: "1px solid #26232F" }}>
        MascotGen is in Alpha. NFTs are digital collectibles, not investments — nothing in this document is financial advice. Terms of Service and Privacy Policy are in University → ⚖️ Legal.
      </p>
    </div>
  );
}

function PricingPage({ tier, onBuy, onPortal }) {
  const Card = ({ name, price, per, tagline, color, cta, plan, features, note }) => (
    <div className="rounded-lg border p-4 flex flex-col" style={{ borderColor: color }}>
      <p className="text-sm font-bold" style={{ color }}>{name}</p>
      <p className="text-xl font-bold my-1" style={{ color: OFFWHITE }}>
        {price}
        <span className="text-xs font-normal" style={{ color: MUTED }}> {per}</span>
      </p>
      <p className="text-xs mb-2" style={{ color: OFFWHITE }}>{tagline}</p>
      <ul className="text-xs mb-3 flex-1 flex flex-col gap-1" style={{ color: MUTED }}>
        {features.map((f, i) => (
          <li key={i}>
            <span style={{ color: f.startsWith("No ") ? "#6B6880" : color }}>{f.startsWith("No ") ? "·" : "✓"}</span> {f}
          </li>
        ))}
      </ul>
      {note && <p className="text-xs mb-2" style={{ color: "#6B6880" }}>{note}</p>}
      {cta && (
        <button onClick={() => onBuy(plan)} className="w-full py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: color, color: INK }}>
          {cta}
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-1" style={{ color: LIME }}>Plans</h1>
      <p className="text-sm mb-6" style={{ color: MUTED }}>
        Current tier: <span style={{ color: tier === "Alpha" ? AMBER : tier === "Creator" ? LIME : OFFWHITE }}>{tier}</span> · Holding $MGEN can also unlock tiers once the token launches.
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          name="Free" price="$0" per="forever" color="#8B87A0"
          tagline="Build characters and play the arena."
          features={[
            "5 AI generations — lifetime total",
            "Pick 2 per category (base attributes)",
            "Full battle card — stats, element, abilities",
            "⚔️ Battle Arena + 🏁 The Grand Circuit — unlimited play, no fees",
            "🌐 Stories in 9 languages",
            "No origin story or Story Studio",
            "No minting — and both games need at least one minted mascot to enter",
          ]}
        />
        <Card
          name="Starter" price="$19.99" per="one-time" color="#5EC9FF"
          tagline="Mint one character, keep it forever."
          features={[
            "15 AI generations — lifetime total",
            "1 NFT mint (one-time, does not refill) — your ticket into the Arena and the Grand Circuit",
            "4-panel origin story",
            "⭐ Story Studio — chapters draw from your 15",
            "Pick 2 arch · 3 vibe · 7 world · 2 color · 4 accessories",
            "25 art generations — lifetime",
            "Base attributes only",
            "Card tier: 77% Common · 23% Rare (no Epic or Legendary)",
          ]}
          cta="Get Starter" plan="starter"
        />
        <Card
          name="Platinum" price="$49.99" per="/ 30-day cycle" color={AMBER}
          tagline="The ⭐ attribute vault opens."
          features={[
            "5 AI generations per day — characters, chapters, rebuilds",
            "3 mints per 30-day cycle (refills) — $16.66 a mint",
            "⭐ Elite attributes unlocked — dragons, aliens, planets, gods' gear",
            "Pick 2 arch · 4 vibe · 9 world · 2 color · 5 accessories",
            "🔥 Trending Mode — live web-sourced concepts",
            "⚔️ Crossover Sagas between your minted mascots",
            "50 art generations per cycle",
            "3% base Legendary roll — ~7.3% with pity",
            "Extra-mint packs are an Elite perk",
            "No auras",
          ]}
          note="Renews automatically. Cancel anytime."
          cta="Get Platinum" plan="platinum"
        />
        <Card
          name="Elite" price="$99.99" per="/ 30-day cycle" color={MAGENTA}
          tagline="Everything unlocked. Nothing held back."
          features={[
            "10 AI generations per day — characters, chapters, rebuilds",
            "7 mints per 30-day cycle (refills) — $14.28 a mint, the best rate",
            "Everything in Platinum, plus:",
            "🌟 All 5 auras — Dragon, Ultimate, Blessed, Cosmic, Dark",
            "Maximum picks: 2 arch · 5 vibe · 11 world · 2 color · 7 accessories",
            "100 art generations per cycle",
            "7% base Legendary roll — ~10% with pity",
            "＋5 extra mints — $29.99 (Elite perk, never expire)",
          ]}
          note="Renews automatically. Cancel anytime."
          cta="Get Elite" plan="elite"
        />
      </div>

      <p className="text-xs mt-4 p-3 rounded-lg" style={{ backgroundColor: "rgba(94,201,255,0.06)", color: MUTED }}>
        <strong style={{ color: OFFWHITE }}>About the games:</strong> the ⚔️ Battle Arena and 🏁 The Grand Circuit are free to play with no entry fees, no wagering, and no limit on how often you play — but you fight and race with <em>minted</em> mascots, so you need at least one NFT mint to take part. Any paid plan includes mints.
      </p>

      {/* 🎁 THE CREATOR PACK — ONE add-on instead of two. Bundling wins here:
          it's a single decision rather than two, somebody who burns through art
          usually needs story generations soon after, and one clean add-on keeps
          the Pricing page from turning into a vending machine. Subscribers only
          — a free account can't mint, so selling it generations helps nobody. */}
      <div className="mt-4 rounded-lg border p-4" style={{ borderColor: LIME, backgroundColor: "rgba(198,255,61,0.04)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <span className="text-sm font-black block" style={{ color: LIME }}>🎁 The Creator Pack</span>
            <span className="text-xs block mt-1" style={{ color: OFFWHITE }}>
              <b>10 art generations</b> + <b>15 story generations</b>, in one go.
            </span>
            <span className="text-xs block mt-1" style={{ color: MUTED }}>
              Run dry mid-chapter and keep going. Both never expire. Starter and above.
            </span>
          </div>
          <button onClick={() => onBuy("creator")} className="btn-a px-5 py-2.5 rounded-lg text-sm font-black flex-none" style={{ backgroundColor: LIME, color: INK }}>
            $9.99
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border p-3" style={{ borderColor: MAGENTA }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <span className="text-xs font-bold block" style={{ color: OFFWHITE }}>💎 Out of mints? <span style={{ color: MAGENTA }}>Elite perk</span></span>
            <span className="text-xs" style={{ color: MUTED }}>Extra-mint packs are exclusive to active Elite subscribers.</span>
          </div>
          <button onClick={() => onBuy("mints5")} className="px-3 py-1.5 rounded-lg text-xs font-bold flex-none" style={{ backgroundColor: MAGENTA, color: INK }}>
            ＋5 mints · $29.99
          </button>
        </div>
        <span className="text-xs block mt-2" style={{ color: MUTED }}>Mint credits and art credits never expire — they sit in your account until you spend them.</span>
      </div>

      {/* ---- Published odds: honest, checkable, and the same for everyone ---- */}
      <div className="mt-4 rounded-lg border p-4" style={{ borderColor: AMBER, backgroundColor: "rgba(255,182,39,0.04)" }}>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: AMBER }}>⭐ The Founding 333 — happening now</p>
        <p className="text-xs mb-3" style={{ color: OFFWHITE }}>
          The first 333 mints in MascotGen history are <strong>ALL Legendary</strong> — every plan, guaranteed, until mint #333. Then the door closes forever and the odds below begin.
        </p>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: LIME }}>Rarity odds after mint #333</p>
        <div className="grid sm:grid-cols-3 gap-2 mb-3">
          {[
            ["Starter", "77% Common · 23% Rare", "#5EC9FF"],
            ["Platinum", "3% Legendary", AMBER],
            ["Elite", "7% Legendary", MAGENTA],
          ].map(([p, odds, c]) => (
            <div key={p} className="rounded-lg p-2" style={{ backgroundColor: PANEL2 }}>
              <p className="text-xs font-bold" style={{ color: c }}>{p}</p>
              <p className="text-xs" style={{ color: MUTED }}>{odds}</p>
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: MUTED }}>
          Rarity is rolled on our servers at mint — never chosen, never bought, never adjusted per person. <strong>Published odds.</strong> <strong>Starter — Common 77% · Rare 23%</strong> (Epic and Legendary are subscription tiers). Platinum's base Legendary roll is 3%, Elite's is 7%; after 5 consecutive misses each further miss adds +1% to your next roll, hard-capped at 25%, and a Legendary resets it to zero. Across a full run that averages out to <strong>Platinum — Common 54.5% · Rare 28.7% · Epic 9.6% · Legendary 7.3%</strong> and <strong>Elite — Common 43.2% · Rare 31.9% · Epic 14.9% · Legendary 10.0%</strong>. Legendaries release in limited seasons (~2,000 each, stamped on the card). Every paid mint — Starter included — also carries a 0.01% roll at one of the last <strong>3 god thrones</strong> (✧ Super Legendary), capped forever.
        </p>
      </div>

      <div className="mt-4 rounded-lg border p-3 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: "#5EC9FF" }}>
        <div>
          <p className="text-xs font-bold" style={{ color: OFFWHITE }}>Already subscribed?</p>
          <p className="text-xs" style={{ color: MUTED }}>Update your card, switch plans, or cancel — takes effect at the end of the cycle you've paid for.</p>
        </div>
        <button
          onClick={onPortal}
          className="px-4 py-2 rounded-lg text-xs font-bold flex-none"
          style={{ backgroundColor: "#5EC9FF", color: INK }}
        >
          ⚙️ MANAGE SUBSCRIPTION
        </button>
      </div>

      <div className="mt-4 rounded-lg border p-3" style={{ borderColor: HAIRLINE }}>
        <p className="text-xs" style={{ color: MUTED }}>
          <strong style={{ color: OFFWHITE }}>Refunds:</strong> unhappy within 7 days and haven't minted with that plan's allowance? Email <span style={{ color: "#5EC9FF" }}>support@mascotgen.studio</span> and we'll refund it, no questions asked. Solana network fees are paid to the blockchain, not to us, and can't be refunded by anyone.
          {" "}<strong style={{ color: OFFWHITE }}>Monthly plans renew automatically</strong> and can be cancelled anytime — access continues to the end of the cycle you've paid for. Full terms are in University → ⚖️ Legal.
        </p>
      </div>

      <p className="text-xs mt-4" style={{ color: MUTED }}>
        <strong style={{ color: OFFWHITE }}>About generations:</strong> a generation is one AI creation — a new character, a story chapter, or a rebuilt profile. Free and Starter are one-time plans, so their generations are a lifetime total. Platinum and Elite are subscriptions, so theirs refill every day at midnight UTC. A full ⚔️ 12-16 panel fight scene is about three times the work, so it counts as 3.
      </p>
      <p className="text-xs mt-3" style={{ color: "#6B6880" }}>
        MascotGen is in Alpha. NFTs are digital collectibles, not investments — nothing here is financial advice.
      </p>
    </div>
  );
}

const CURRICULUM = [
  { g: 1, title: "What Even Is Crypto?", pts: [
    "Crypto is digital money that lives on a public ledger called a blockchain — a shared record book nobody can secretly edit.",
    "No bank sits in the middle: the network of computers checks every transaction together.",
    "Bitcoin was the first. Thousands of others followed, each with different purposes (and wildly different quality).",
  ]},
  { g: 2, title: "Meet Solana & SOL", pts: [
    "Solana is a blockchain known for being fast and cheap — transactions cost fractions of a cent.",
    "SOL is its currency. You'll use small amounts of SOL to pay for everything you do on Solana, including launching tokens.",
    "MascotGen and pump.fun both live on Solana — that's why you'll need a little SOL to launch.",
  ]},
  { g: 3, title: "Wallets 101", pts: [
    "A wallet (like Phantom or Solflare — free apps) holds your crypto and is your identity on Solana. No username, no password resets — the wallet IS your account.",
    "When you create one, you get a seed phrase: 12-24 words. Write it on paper. Store it somewhere safe.",
    "THE GOLDEN RULE: never type your seed phrase into any website, never share it with anyone, ever. No legit person or app will ask for it. Anyone who does is stealing from you.",
  ]},
  { g: 4, title: "Getting Your First SOL", pts: [
    "Buy SOL on a major exchange (Coinbase, Kraken, etc.) with regular money after creating an account there.",
    "Then withdraw it to your wallet: copy your wallet's address from Phantom, paste it as the withdrawal destination, send a tiny test amount first.",
    "Start small. You only need a few dollars of SOL to launch a token on pump.fun.",
  ]},
  { g: 5, title: "What Are Meme Tokens?", pts: [
    "Meme tokens are cryptocurrencies built around characters, jokes, and communities rather than technology.",
    "Their value comes from culture and attention — which makes them fun, fast, and extremely volatile.",
    "Hard truth up front: most meme tokens go to zero. Never put in money you can't afford to lose completely.",
  ]},
  { g: 6, title: "Safety School (Required Course)", pts: [
    "Scammers target beginners. Common attacks: fake support DMs, fake airdrop links, fake versions of real sites, and anyone asking for your seed phrase.",
    "Nobody legit DMs you first offering help or money. Close those messages.",
    "Only click links from official, verified sources. Bookmark the real pump.fun and MascotGen instead of googling them each time.",
    "If a token promises guaranteed profits, it's a scam. If someone pressures you to act fast, it's a scam.",
  ]},
  { g: 7, title: "Using MascotGen", pts: [
    "Pick your traits — mix two archetypes for hybrids, blend vibes, stack accessories by tier.",
    "Hit Generate: you get a character, lore, origin story, art prompt, a full launch package, and a playable battle card with stats, an element, and abilities.",
    "Save concepts you love to your Collection, generate real art in the Studio, and mint your favorites as NFTs on Solana — rarity AND birth universe are rolled at mint. Check the 'How to Play' tab to understand the battle card.",
  ]},
  { g: 8, title: "How pump.fun Works", pts: [
    "Pump.fun lets anyone create a token in minutes for a small fee — no coding.",
    "New tokens start on a bonding curve: an automatic pricing system where the price rises as more people buy in.",
    "If a token grows enough, it 'graduates' to a full exchange listing automatically.",
    "Creating a token there requires: a name, ticker, description, an image, and optional social links — exactly what MascotGen generates for you.",
  ]},
  { g: 9, title: "Launching Your Token", pts: [
    "Generate your concept in MascotGen and open the 🚀 Launch Package on your card.",
    "Create your token image using the Art Prompt with any AI image tool, or your own art.",
    "On pump.fun: connect your wallet, hit create, and paste each field from your Launch Package. Review everything, then launch.",
    "Congratulations — you're a token creator. Now the real work starts.",
  ]},
  { g: 10, title: "Building a Community", pts: [
    "A token without a community is a ghost town. Set up a Telegram group and an X account (MascotGen generates your bios and welcome message).",
    "Post consistently: character content, milestones, memes. Your generated origin story is week one of content.",
    "Be present and answer questions. Creators who vanish are the #1 reason communities die.",
  ]},
  { g: 11, title: "After Launch: Do's and Don'ts", pts: [
    "DO: pin your contract address everywhere immediately (scammers clone new tokens fast).",
    "DO: be transparent about any tokens you hold as creator, and announce before selling any.",
    "DON'T: buy fake volume, pay for 'guaranteed trending,' or pay anyone for CoinGecko/CMC listings — listings are free and volume bots are fraud.",
    "DON'T: make price predictions or profit promises to your community. Ever.",
  ]},
  { g: 12, title: "Graduation: Where to Go Next", pts: [
    "You now know more than most people who launch tokens. Next frontiers: liquidity, market cap mechanics, NFTs, and reading on-chain data.",
    "MascotGen keeps growing with you: minting your characters as NFTs and the battle-card game are live now — see the 'How to Play' guide. Trending Mode, on-chain battles, wallet sync, and more are on the roadmap.",
    "Final lesson: in crypto, the ones who survive are the ones who stay curious AND stay skeptical. Be both. Class dismissed. 🎓",
  ]},
];

// 🎓 THE ACADEMY — the college wing of the University. Deep courses on every
// system the platform has, with worked examples, so nobody ever needs to ask
// "how do I…" in the Telegram. If a feature exists, its course lives here.
const ACADEMY = [
  {
    key: "acad_bible",
    title: "COURSE 101 · The Writer's Bible — make the AI write YOUR character",
    pts: [
      "The Writer's Bible is a notes box in the Story Studio that gets handed to the story AI with EVERY chapter you generate. It outranks the AI's own invention: whatever you write there is treated as canon law for voice, motives, backstory, and rules. Minted mascots sync it across all your devices.",
      "What belongs in it: (1) VOICE — how they talk, with 2-3 example lines. (2) WANTS — what they're chasing and what they fear. (3) FACTS — relationships, home, injuries, debts, secrets. (4) RULES — things the AI must never do with them.",
      "A worked example for a casino-boss character: \"VOICE: flat, dry, never raises his voice, never uses exclamation points. Talks about magic like accounting. Example: 'That curse carries 11% interest.' WANTS: to collect what he's owed — from gods, if necessary. FEARS: an unbalanced ledger. FACTS: died once; runs the Velvet Vault casino; owes nobody. RULES: never begs, never explains twice, never loses his composure even while losing a fight.\"",
      "Keep it under ~1,500 characters — tight bibles beat long ones. The AI follows 10 sharp rules better than 40 vague ones. Update it as the saga grows: when a chapter establishes something important, add one line to the bible so it can never be contradicted later.",
      "The #1 mistake: describing the character's APPEARANCE in the bible. Looks are already locked by the traits and art. Spend the space on how they think, speak, and decide — that's what the story engine actually uses.",
    ],
  },
  {
    key: "acad_prompt",
    title: "COURSE 102 · Prompting chapters — directing the saga engine",
    pts: [
      "The custom request box under the Studio buttons is a director's chair, not a search bar. You're giving stage directions for the NEXT chapter. The engine already knows the character, their bible, their life status, and every prior chapter title — you only supply what happens next.",
      "The formula that works: SITUATION + PRESSURE + ONE SPECIFIC DETAIL. Weak: \"another chapter.\" Strong: \"He enters an underground tournament in Terravok to pay off a debt, but his opponent in round one is the only person he's ever apologized to. End mid-fight.\"",
      "You control pacing with endings: ask for cliffhangers (\"end before the door opens\"), time skips (\"open three years later\"), or flashbacks (\"a childhood memory that explains why he never swims\"). The engine honors structural asks like these very reliably.",
      "Continuity is automatic BUT you can steer it: reference any earlier chapter by what happened (\"the rival from the storm chapter returns, and he remembers the insult\"). The engine receives your recent canon and will connect the threads.",
      "Life status is law: a mascot set to ⚰️ Purgatory writes Purgatory chapters — 1,000 years inside, one minute outside. Use it. Purgatory arcs are where training arcs, debts to the dead, and transformations happen. Flip the status back and the return chapter writes itself.",
      "Language: the saga engine writes in 9 languages — set yours in the Studio and every chapter, title included, arrives in it.",
    ],
  },
  {
    key: "acad_crossover",
    title: "COURSE 201 · Crossovers — sagas that share a universe",
    pts: [
      "Crossover chapters weave OTHER mascots from your Legion into a character's story — a rival, an ally, a sibling. Platinum and Elite include crossover sagas: pick the mascots in the Studio and the engine writes them in with their real traits, elements and universes intact.",
      "Crossovers respect the cards: a Fire mascot from Ignivar meeting a Water mascot from Abyssia carries a real elemental tension the engine knows about. Universe origins matter too — an Empyrion-born walking into a Terravok story is an EVENT, and the engine treats it like one.",
      "The strongest pattern: give each mascot a WANT that collides. In your request: \"Crossover with Brixa the Slime — she wants the artifact he's guarding. Neither can win outright. End with an uneasy alliance.\" Shared canon then exists in BOTH sagas going forward.",
      "Battle results are canon fuel: after an Arena match between your own mascots, write the crossover chapter about it — the winner gloats, the loser trains. The ⚔️ FIGHT SCENE button generates a 12-16 panel battle chapter for exactly this.",
      "Publishing crossovers: each chapter publishes under the mascot whose Studio it was written in. Publish the same event from both characters' Studios — two perspectives on one moment is the oldest comic trick there is, and readers love it.",
    ],
  },
  {
    key: "acad_battle",
    title: "COURSE 301 · Battle Arena mechanics — the full engine",
    pts: [
      "Turn order: Speed decides who acts first each round, and the Momentum passive raises Speed every round it's active. Element triangle: Fire beats Earth, Earth beats Air, Air beats Water, Water beats Fire — a favorable matchup deals 1.25×, an unfavorable one 0.8×.",
      "Damage scales with Power; shields absorb before HP; heals restore a fixed cut of the pool. Once-per-battle effects (Stun, Double Strike, Reflect, Lifesteal, Element Flip, Void Send, Undying) fire when their conditions hit — Reflect, for example, only triggers on a big incoming hit.",
      "Squads run up to 7: your picked ORDER is the fight order — first pick leads, the rest step in as each falls. Void Send banishes the strongest BENCHED enemy, so deep squads carry real risk against banish cards. A banished fighter is gone for the whole battle.",
      "Ratings are Elo now, not flat points: beating a stronger wallet pays big, beating a fresh 1000-rated wallet pays almost nothing, and grinding the same opponent more than 3 times a day pays half each repeat, then half again. The daily arena limit is 60 battles. All of this is enforced server-side.",
      "The Champion cut reads these ladders: to be ELIGIBLE for the top-33 snapshot at mint #11,111 you need at least 20 rated battles against at least 8 different opponents (15 races / 6 rivals on the racing board). Farming one friend's wallet does not qualify — by design.",
      "Mirror Realm: with no rivals available, the void fields doppelgangers of your own roster. Mirror matches are real fights but never rated — you can't farm your own reflection.",
    ],
  },
  {
    key: "acad_race",
    title: "COURSE 302 · Grand Circuit mechanics — reading the race",
    pts: [
      "Stats translate: SPD is top speed, PWR is weapon damage, HP is armor, SPC gates fire rate and unlocks shortcuts (SPC 7+ takes the Cyberpunk neon alley). Sports Car mascots race in true form with up to 3 real car mods from their accessories; everyone else gets a Battle Kart with a reinforced stock frame.",
      "The race is 3 laps. Weapons go LIVE on lap 2. Lap-3 wrecks are permanent — no respawn. On every other lap a wreck costs you 2 ticks and you rejoin at 40% armor (Butterfly Doors halve the wait, Ejector Seat survives one kill outright).",
      "Tracks have favored elements (+6% speed, +20% armor) and hazards: Volcano lava breaches, Snow Peaks whiteouts (Fog Lights ignore them), Desert sandstorms, Wild West cattle, zero-G straights where raw SPD counts double. The ☠ GRAND CIRCUIT is the rare 8th track: damage up 25%, no respawns at all.",
      "Team scoring: P1=10, P2=7, P3=5, P4=3, P5=2, everyone else 1. Your squad's points against theirs decides the match — so a safe P2+P3 beats a hero P1 with two wrecks. Racing has its own Elo ladder, its own daily 60, and its own 11 seats in the Champion cut.",
      "Mods that win races: Nitro Boost (2 charges, spent smart on the final lap), Rocket Launcher (once a lap, double damage), Smoke Screen (vanish from targeting when under 45% armor), Hydraulics (hops lava AND oil slicks). Mods only work on true Sports Car mascots — choose accessories at creation accordingly.",
    ],
  },
  {
    key: "acad_rarity",
    title: "COURSE 401 · Rarity, marks, and the Ages — every door and its odds",
    pts: [
      "Rarity is rolled SERVER-SIDE at pack-open, never chosen, never buyable. Starter rolls 77% Common / 23% Rare — a Rare adds +1 to every stat and one rare ability — but never Epic or Legendary, which are what a subscription buys. Platinum's base Legendary roll is 3%, Elite's is 7%. Your first 5 misses change nothing — after that each miss adds +1% to your next roll, capped at 25%, and a Legendary resets it to zero. Averaged over a long run that lands at about 7.3% Legendary on Platinum and 10% on Elite.",
      "The Founding 333: the first 333 mints in MascotGen history are ALL guaranteed Legendary, any paid plan. At #334 that door welds shut forever. Check the live counter on Stats.",
      "The god thrones: 12 exist, and every paid mint — even a $19.99 Starter — carries a 0.01% roll at one of the last 3 public thrones. Gods are Super Legendary: all stats maxed, both super-rare effects, a unique god ability, and Undying. No god sits below 888 Battle HP — above the Archangels' 777, because a god has to read like one. The seated lower-realm powers hold 999, Blaze Malpherion 1,111, and Toro Maximus and Gravel Mortis 1,333 apiece: the ceiling of the known pantheon.",
      "✋ The God-Marked: separate 0.1% roll on every paid mint. 777 will ever exist. A mark lands on ANY rarity — a marked Common is real and glorious — granting +77 Battle HP and one Borrowed Power decided by which of the Twelve reached down. Which throne marked you is written into the NFT forever.",
      "⏳ The Ages arrive on lifetime mint milestones and release AUTOMATICALLY — no announcement needed, the code watches the counter: Champions at #11,111 (333 cards · 333 HP · top-33 granted to the ladders, 300 rolled at 1.5%), Season 2 at #33,333, the Demon Age at #66,666 (666 demons · 666 HP · 2%), the Archangels at #111,111 (1,111 · 777 HP · 2%). Live progress bars for every age are on the Stats page.",
      "⚖️ AGE COMBAT — an age card is not just a bigger HP bar. Champions carry GIANT-SLAYER intrinsically: their damage scales with how far the enemy outweighs them, capped at 1.5x, and is worth exactly nothing against anything smaller. That is what lets 333 HP stand in front of 666 without the fight being decided in advance — simulated across thousands of battles the demons still win it, roughly 53 to 47. Demons lead with control (Chains, Void Howl) then press with Blood Pact and Feast of Embers. Archangels answer both: 777 HP, Choir Shield, Higher Mercy, and Waterfall Descent — the only attack in the game that cannot be blocked, dodged or shielded.",
      "🐜 UNDERDOG + WEIGHT CLASSES — two rules protect the lower tiers. Anything facing an opponent more than 1.15x its size hits harder, scaling with the gap up to double. And random Arena and Circuit matchmaking is banded by weight class (Common/Rare · Epic/Legendary · Champion · Demon/Archangel/God): you are drawn against your own class first, one class away only if the pool is thin. Naming a wallet directly still lets you challenge anything you like — the band only governs the random draw.",
      "Stacking: an age card REPLACES rolled Battle HP with its fixed number, and a God-Mark still adds its +77 on top. A God-Marked Demon at 743 Battle HP is possible, absurd, and exactly the point.",
    ],
  },
  {
    key: "acad_publish",
    title: "COURSE 405 · Saga Mode — making many characters read as ONE book",
    body: [
      "A chapter normally belongs to one character. SAGA MODE overrides that: in the Library, name a saga and set a part number, and every chapter you publish joins THAT book in order — no matter whose character it came from. It's how a main plot that jumps between four leads still reads front-to-back.",
      "Turn it on before you publish, not after: type the saga name, set the number the NEXT chapter should be, then hit PUBLISH. The counter ticks up on its own, so you just work down your list.",
      "Readers landing on any part of a saga get the full table of contents across every character, in order, with ← Previous / Next → and a 'you are here' marker. Leave the saga name blank and chapters publish as each character's own solo story — that's the default, and it's the right one for a single-character arc.",
      "Every mascot's 4-panel ORIGIN STORY publishes as its Chapter 1. If you took a saga live in the wrong order, the Library's 'chapters live' panel has a TAKE DOWN button on each one — taking a chapter down removes it from the public Library only; the writing stays in your canon and can be republished any time.",
    ],
  },
  {
    title: "COURSE 406 · Verse News — the official broadcast",
    body: [
      "Player chapters are the world's stories. VERSE NEWS is the world's newspaper: the one place the studio speaks in its own voice — age openings, season drops, canon announcements, the Champion cut, the barrier.",
      "It sits at the top of the Library and it is public and gateless: no wallet, no login, anyone can read it. Only the studio can post, and that gate is a signed wallet check on the server — not a setting anyone can flip.",
      "Why it matters more than any single age: ages are milestones and milestones are far apart. A broadcast is the heartbeat between them, and it costs nothing but the writing.",
    ],
  },
  {
    title: "COURSE 402 · Publishing — from private canon to the public Library",
    pts: [
      "The pipeline: write chapters in the Story Studio (private) → claim your author name (the @name chip in the header — one wallet, one name) → hit 📖 PUBLISH on any chapter of a MINTED mascot → it appears in the public Library, on your author page at /?a=yourname, and on the mascot's Market card as READ THE SAGA.",
      "Your author page is gateless — anyone with the link can read it, no wallet, no login. Every chapter also has its own permalink (/?c=…) with a copy button: that single-chapter link is the thing to post on X, because it shows the mascot's card art, tier, and universe at the top.",
      "Unpublishing removes only the public copy — the chapter stays in your Studio canon untouched. Republishing after an edit: unpublish first, then publish the new version (the Library enforces one live copy per chapter title per mascot).",
      "The bulk publisher at the top of the Library scans every minted mascot you own and lists every unpublished chapter with one-click PUBLISH buttons — the fast lane when you've written a backlog.",
      "Strategy: publish your best 2-3 chapters, not all 30. The Library is a storefront — a tight saga that hooks readers sends them to your Market card, and a wall of filler doesn't. You can rotate what's public anytime.",
    ],
  },
  {
    key: "acad_pvp",
    title: "COURSE 403 · Manual PvP — the duel, move by move",
    pts: [
      "Manual PvP is turn-by-turn against a real person: post an open challenge (anyone answers) or address one to a specific wallet. Both players pick ONE minted fighter. Speed decides who moves first.",
      "Your move list comes from your real card: a basic Strike (always available, scales with Power), plus up to 5 of your signatures and abilities — damage moves, heals, shields, and stuns, each once per battle. The element triangle applies at full strength, and Undying still saves you from the first lethal hit.",
      "The clock: 24 hours per move. If your opponent goes silent on their turn, the CLAIM TIMEOUT WIN button hands you the result. Forfeiting is always available and always honorable — the house respects a folded hand.",
      "PvP is UNRATED during beta, deliberately: manual matches are the easiest thing in the platform to script, so they touch no ladder the Champion cut reads. When rating arrives it will come with its own anti-farm rules. The daily PvP limit is 30 matches.",
      "Etiquette that will become law: accepting a challenge and never moving is what the timeout exists for. Serial abandoners will meet consequences when PvP graduates from beta.",
    ],
  },
  {
    key: "acad_lifecycle",
    title: "COURSE 404 · Death, the Graveyard, and coming back",
    pts: [
      "Nothing on MascotGen is ever deleted. A mascot silent for 30 days drifts into the public Graveyard on the Stats page — Empyrion-born rest above the cosmic waterfall, everyone else waits in Purgatory. It's a state, not a punishment.",
      "One battle, one race, or one new published chapter brings any resident back — and the return is COUNTED. The ⟲ resurrection badge on a card is permanent and stacks. A mascot with 3 returns wears proof it was loved enough to be brought back three times.",
      "Story deaths are separate and voluntary: set Life Status to ⚰️ Purgatory in the Studio and the saga engine writes within the rules — 1,000 years inside per minute outside. Death is a training arc, not an ending. The status flip back to 🟢 Alive is the comeback chapter.",
      "Collectors read Graveyard data: a card's dormancy and return history is visible on the Stats page. Active sagas are living assets — the platform is built so that USING your mascot is always what makes it more, never less.",
    ],
  },
];

const GAMEPLAY_GUIDE = [
  {
    key: "card",
    title: "Reading the Battle Card",
    pts: [
      "Every mascot is a playable battle card. The four bars — PWR (Power), HP, SPD (Speed), SPC (Special) — rate the character from 1 to 7 based on its traits. Higher-value traits push these up.",
      "Battle HP is the actual health pool the mascot fights with (roughly 70–230). It's separate from the HP bar rating — a higher HP rating means a bigger Battle HP pool.",
      "No two mascots are exactly alike: even cards with the same ratings deal slightly different damage, because each mascot has a unique built-in variance tied to its identity. Your card's numbers never change — they're locked to that character forever.",
    ],
  },
  {
    key: "pentaverse",
    title: "The Pentaverse — Five Universes",
    pts: [
      "Every mascot is born into one of five universes at mint, stamped on its card. They sit on a five-point star: ⭐ Empyrion at the North, with 🔥 Ignivar, 💧 Abyssia, 🌍 Terravok, and 💨 Zephyrion as the four lower points.",
      "Empyrion is the god-adjacent realm where all four elements mix — only about 1 in 20 mascots are born there, and Empyrion cards carry holographic lettering. The four lower universes each match one element, and parallels oppose each other across the star: Ignivar (Fire) vs Abyssia (Water), Terravok (Earth) vs Zephyrion (Air).",
      "Death matters. A mascot from the lower universes that dies in the story serves 1,000 years in Purgatory — but only 1 minute passes in the living realm. Empyrion-born dead instead rest above the cosmic waterfall at heaven's portal, under the same time warp. And killing has a price: for every 1,000 years the victim serves, the killer may live only 1 minute of realm-time.",
      "Cards minted before the Pentaverse was revealed carry no universe — they are the GENESIS ERA, the oldest beings in existence, and no more can ever be made.",
      "⏳ ELDER — the Genesis Era's mechanical edge: they take NO elemental disadvantage, ever, and carry +55 Battle HP. Fire beats Earth and Earth beats Air, but not for something that existed before the elements were sorted into a wheel. They still GAIN an advantage when they hold one; they simply never suffer one. It cannot be farmed and it can never be minted again.",
    ],
  },
  {
    key: "element",
    title: "Elements & Type Advantage",
    pts: [
      "Every mascot has one of four elements: 🔥 Fire, 💧 Water, 🌍 Earth, or 💨 Air, shown on the battle card next to Battle HP.",
      "Elements form a triangle of advantage: Fire beats Earth, Earth beats Air, Air beats Water, and Water beats Fire. Attacking an element you counter hits harder; attacking into one that counters you hits weaker.",
      "Element is assigned when the mascot is created and locked forever — and it decides which lower universe a mascot can be born into.",
    ],
  },
  {
    key: "race",
    title: "🏁 The Grand Circuit — Combat Racing",
    pts: [
      "Free to play with no entry fee or limit — you just need at least one MINTED mascot, since you race the actual NFT. Pick up to 3 minted mascots and race a rival wallet — or a random grid — across 8 circuits rolled at lights-out. SPD is top speed, PWR is weapon damage, HP is your armor, SPC charges your abilities.",
      "Lap 1 is clean racing. Weapons go LIVE on lap 2. On lap 3, wrecks are permanent — and on the rare ☠ Post-Apocalyptic track, there are no respawns on any lap. Wrecked racers 'visit Purgatory for a thousand years and are back in a minute' — the time warp makes it canon.",
      "Sports Car mascots race in their true form and can equip up to 3 car mods (Nitro Boost, Machine Gun Turret, Rocket Launcher, Ejector Seat and more). Every other mascot drives a standard Battle Kart with a reinforced frame — the whole collection can race, cars just have the home-field edge.",
      "Elements matter: each circuit favors one element (+speed, +armor) and punishes its opposite. Racing has its OWN rating ladder, separate from battles — a great fighter isn't automatically a great driver. And as always: no wagering, and losing never touches your NFT.",
    ],
  },
  {
    key: "abilities",
    title: "Signatures & Abilities",
    pts: [
      "Every mascot has 2 Signature abilities — its core moves, each showing an effect and a value (like ⚡ Burst — 85 dmg or 🛡 Iron Wall — +40 shield).",
      "Rare-tier cards and above unlock extra Abilities on top: effects like ⚔️ Double Strike, 👥 Reflect (bounces an attack back), 🔗 Lifesteal (damage that heals you), or 🔥 Element Flip.",
      "Epic cards add an always-on passive (like 🌿 Regeneration or 🌵 Thorns). Legendary cards get two rare abilities and a 33% chance at a Super-Rare effect.",
      "Super-Rare effects are the rarest in the game: 💀 Void Send instantly banishes an opponent's mascot to the graveyard, and ♾️ Undying lets you survive a lethal hit once. Only found on some Legendary cards — and on every God.",
    ],
  },
  {
    key: "rarity",
    title: "Rarity Tiers",
    pts: [
      "Cards come in five tiers: Common, Rare, Epic, Legendary — and above them all, ✧ SUPER LEGENDARY: the 11 Gods of the Pentaverse. Higher tiers get a stat bonus (Rare +1, Epic +2, Legendary +3 to every stat), so a Legendary is genuinely stronger, not just prettier. Gods are maxed outright: 10/10/10/10, and no god sits below 888 Battle HP.",
      "⭐ THE FOUNDING 333: the first 333 mints ever made on MascotGen are ALL Legendary — guaranteed, on every plan. Nothing extra is printed on the card; being Season 1 with a mint number under 333 IS the flex, provable on-chain forever. At mint #334 the door closes and normal odds begin.",
      "You can't build or buy a specific tier — rarity is rolled at the moment you mint, never chosen. Legendaries release in limited SEASONS of roughly 2,000, each card stamped with its season number — early seasons become the vintage pulls, and a new season only opens when the last one fills.",
      "Your odds of pulling a Legendary climb the more you mint without success (a 'pity' system) — the first 5 misses are free, then +1% each, hard-capped at 25%. Persistence is rewarded, but a Legendary is NEVER guaranteed: the cap is a ceiling, not a promise.",
      "Super Legendary can NEVER be rolled through normal odds. Eight of the 11 god thrones are already taken; the last three are hidden in the mints — every paid mint carries a 0.01% (1-in-10,000) roll at one, and when the third is claimed, godhood closes forever.",
    ],
  },
  {
    key: "doppel",
    title: "Doppelgangers",
    pts: [
      "Because names are AI-generated, sometimes two mascots end up with the same name — a Doppelganger event.",
      "Each mascot still gets a unique on-chain identity, so Doppelgangers are a rare piece of lore rather than a conflict. The affected creator earns a special 'Doppelganger Survivor' mark.",
      "It's a nod to how rare true originality is — and a badge of honor when it happens to you.",
    ],
  },
];

// ⚔️ THE BATTLE STAGE — plays the server's structured events like a broadcast:
// two live cards, HP bars, floating damage, god-ability banners.
// Tier colors — module scope so BattleStage (outside App) can read them too.
const rarityColorMap = { "Super Legendary": "#FF9DF2", Legendary: "#FFD700", Epic: "#C77DFF", Rare: "#5EC9FF", Common: "#9A94AD" };

function BattleStage({ events, upTo, yourTeam, theirTeam }) {
  // Fold events 0..upTo into a stage snapshot.
  const roster = {};
  [...(yourTeam || []), ...(theirTeam || [])].forEach((f) => {
    roster[f.name] = { ...f, hp: f.maxHp, shield: 0, down: false, banished: false };
  });
  let activeA = (yourTeam || [])[0]?.name, activeB = (theirTeam || [])[0]?.name;
  let last = null;
  for (let i = 0; i < upTo && i < events.length; i++) {
    const e = events[i];
    last = e;
    const f = e.name && roster[e.name], tgt = e.target && roster[e.target];
    if (e.t === "enter") { if (e.side === "a") activeA = e.name; else activeB = e.name; }
    if ((e.t === "hit" || e.t === "godBanner") && tgt && typeof e.hpAfter === "number") tgt.hp = e.hpAfter;
    if (e.t === "reflect" && e.attacker && roster[e.attacker] && typeof e.hpAfter === "number") roster[e.attacker].hp = e.hpAfter;
    if (e.t === "heal" && f && typeof e.hpAfter === "number") f.hp = e.hpAfter;
    if (e.t === "shield" && f) f.shield = e.amount || 0;
    if (e.t === "shieldAbsorb" && tgt) tgt.shield = e.shieldAfter || 0;
    if (e.t === "godBanner" && e.banish && tgt) { tgt.banished = true; tgt.hp = 0; }
    if (e.t === "ko" && f) f.down = true;
  }
  const A = roster[activeA], B = roster[activeB];
  if (!A || !B) return null;

  // Overall DECK HEALTH per side — total remaining HP across the whole squad,
  // so you can see at a glance who's closing on defeat.
  const deckHealth = (team) => {
    const members = (team || []).map((t) => roster[t.name]).filter(Boolean);
    const cur = members.reduce((s, m) => s + Math.max(0, m.hp), 0);
    const max = members.reduce((s, m) => s + (m.maxHp || 1), 0);
    return { cur, max, pct: max ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0 };
  };
  const dhA = deckHealth(yourTeam), dhB = deckHealth(theirTeam);
  const dhColor = (pct) => (pct > 55 ? "#9CFF3C" : pct > 25 ? "#FFB627" : "#FF5A5A");
  const deckBar = (dh, label, alignRight) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between gap-2" style={{ flexDirection: alignRight ? "row-reverse" : "row" }}>
        <span className="text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>{label}</span>
        <span className="text-[10px] font-black" style={{ color: dhColor(dh.pct) }}>{dh.cur} / {dh.max}</span>
      </div>
      <div className="h-2.5 rounded-full mt-0.5 overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${dh.pct}%`,
            marginLeft: alignRight ? "auto" : 0,
            background: `linear-gradient(90deg, ${dhColor(dh.pct)}, ${dhColor(dh.pct)}CC)`,
            boxShadow: `0 0 ${dh.pct <= 25 ? 14 : 8}px ${dhColor(dh.pct)}${dh.pct <= 25 ? "" : "AA"}`,
            animation: dh.pct <= 25 ? "holoShift 1.2s linear infinite" : undefined,
          }}
        />
      </div>
    </div>
  );

  const elemColors = { Fire: "#FF5A3C", Water: "#3CA9FF", Earth: "#B98A3C", Air: "#9FE6FF" };
  const tierFrame = (fg) =>
    fg.isGod
      ? { background: "linear-gradient(115deg,#FF9DF2,#7DF9FF,#FFF3B0,#C084FC,#FF9DF2)", backgroundSize: "300% 300%", animation: "holoShift 5s linear infinite" }
      : { background: rarityColorMap[fg.tier] || HAIRLINE };

  const card = (fg, side) => {
    const isTarget = last && (last.target === fg.name || (last.t === "reflect" && last.attacker === fg.name));
    const isHealer = last && last.t === "heal" && last.name === fg.name;
    const isEntering = last && last.t === "enter" && last.name === fg.name;
    const isKO = last && last.t === "ko" && last.name === fg.name;
    const isBanished = last && last.t === "godBanner" && last.banish && last.target === fg.name;
    const anim = isBanished
      ? "banishOut 1.1s ease-in forwards"
      : isKO
      ? "koFall 0.9s ease-out forwards"
      : isTarget && (last.t === "hit" || last.t === "godBanner" || last.t === "reflect")
      ? "stageShake 0.55s ease, hitFlash 0.7s ease"
      : isHealer
      ? "healPulse 0.8s ease"
      : isEntering
      ? "stageEnter 0.6s ease"
      : "none";
    const hpPct = Math.max(0, Math.min(100, (fg.hp / fg.maxHp) * 100));
    const dmgToShow = isTarget && (last.t === "hit" || (last.t === "godBanner" && last.dmg)) ? last.dmg : isTarget && last.t === "reflect" ? last.dmg : null;
    const healToShow = isHealer ? last.amount : null;
    return (
      <div className="relative flex-1 max-w-[240px]" key={fg.name + side}>
        {dmgToShow != null && (
          <span className="absolute left-1/2 -translate-x-1/2 top-2 z-20 font-black text-xl pointer-events-none" style={{ color: "#FF5A5A", animation: "floatDmg 1s ease-out forwards", textShadow: "0 0 10px rgba(0,0,0,0.9)" }}>
            −{dmgToShow}
          </span>
        )}
        {healToShow != null && (
          <span className="absolute left-1/2 -translate-x-1/2 top-2 z-20 font-black text-xl pointer-events-none" style={{ color: "#5AFF8F", animation: "floatDmg 1s ease-out forwards", textShadow: "0 0 10px rgba(0,0,0,0.9)" }}>
            +{healToShow}
          </span>
        )}
        <div className="rounded-xl p-[3px]" style={{ ...tierFrame(fg), animation: `${tierFrame(fg).animation || "none"}` }}>
          <div className="rounded-[10px] p-2" style={{ backgroundColor: "#141218", animation: anim }}>
            {fg.image ? (
              <img src={fg.image} alt={fg.name} className="w-full aspect-square object-cover rounded-lg" />
            ) : (
              <div className="w-full aspect-square rounded-lg flex items-center justify-center text-4xl font-black" style={{ backgroundColor: "#1E1B26", color: MUTED }}>
                {fg.name.slice(0, 1)}
              </div>
            )}
            <p className="text-xs font-bold mt-1.5 truncate" style={{ color: OFFWHITE }}>{fg.isGod ? "✧ " : ""}{fg.name}</p>
            <div className="flex items-center justify-between text-[10px] mt-0.5">
              <span style={{ color: rarityColorMap[fg.tier] || MUTED, fontWeight: 800 }}>{fg.isGod ? "GOD" : fg.tier}</span>
              <span style={{ color: elemColors[fg.element] || MUTED }}>{fg.element}</span>
            </div>
            <div className="h-2.5 rounded mt-1.5 overflow-hidden" style={{ backgroundColor: HAIRLINE }}>
              <div className="h-full rounded transition-all duration-500" style={{ width: `${hpPct}%`, backgroundColor: hpPct > 50 ? "#5AFF8F" : hpPct > 22 ? "#FFB627" : "#FF5A5A" }} />
            </div>
            <div className="flex items-center justify-between text-[10px] mt-0.5">
              <span style={{ color: MUTED }}>{Math.max(0, Math.round(fg.hp))}/{fg.maxHp} HP</span>
              {fg.shield > 0 && <span style={{ color: "#7DF9FF" }}>🛡 {fg.shield}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const bench = (team, activeName) => (
    <div className="flex gap-1.5 justify-center mt-2">
      {(team || []).map((f) => {
        const st = roster[f.name];
        return (
          <span
            key={f.name}
            title={f.name}
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{
              backgroundColor: st.banished ? "#4B0082" : st.down || st.hp <= 0 ? "#3A3542" : f.name === activeName ? LIME : "#6B6577",
              boxShadow: f.name === activeName ? `0 0 8px ${LIME}` : "none",
            }}
          />
        );
      })}
    </div>
  );

  const banner = last && last.t === "godBanner" ? last : last && last.t === "undying" ? { god: "UNDYING", icon: "♾️" } : last && last.t === "flip" ? { god: "ELEMENT FLIP", icon: "🔥" } : null;

  return (
    <div className="relative rounded-xl border p-4 mb-3 overflow-hidden" style={{ borderColor: HAIRLINE, background: "radial-gradient(ellipse at 50% 120%, rgba(255,62,165,0.14), transparent 60%), radial-gradient(ellipse at 50% -20%, rgba(125,249,255,0.10), transparent 60%), #0E0C12" }}>
      {banner && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-30 text-center pointer-events-none" style={{ animation: "bannerPop 1.4s ease forwards" }}>
          <span className="inline-block px-4 py-1.5 rounded-lg font-black text-sm tracking-widest" style={{ backgroundColor: "rgba(0,0,0,0.75)", color: "#FFD700", border: "1px solid #FFD700", textShadow: "0 0 14px rgba(255,215,0,0.7)" }}>
            {banner.icon} {banner.god}
          </span>
        </div>
      )}
      <div className="flex items-center gap-3 md:gap-6 mb-3">
        {deckBar(dhA, "Your deck", false)}
        <span className="text-[9px] font-black tracking-widest" style={{ color: MUTED }}>DECK HP</span>
        {deckBar(dhB, "Rival deck", true)}
      </div>
      <div className="flex items-center justify-center gap-3 md:gap-8">
        <div className="flex-1 max-w-[240px]">
          {card(A, "a")}
          {bench(yourTeam, activeA)}
        </div>
        <span className="font-black text-lg md:text-2xl" style={{ color: MAGENTA, textShadow: "0 0 12px rgba(255,62,165,0.6)" }}>VS</span>
        <div className="flex-1 max-w-[240px]">
          {card(B, "b")}
          {bench(theirTeam, activeB)}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 🏁 RACE STAGE — Tron-style broadcast: a glowing neon circuit drawn per track,
// with every car as a live chip sliding along the road. Pure playback of the
// server's event log — the browser can't fake a single overtake.
// ============================================================================
const TRACK_THEMES = {
  Racetrack: { neon: "#C6FF3D", sky: "#0B0F0A", icon: "🏁",
    path: "M200,32 C318,32 372,72 372,116 C372,160 318,200 200,200 C82,200 28,160 28,116 C28,72 82,32 200,32 Z",
    decor: [{ x: 200, y: 116, e: "🏟", s: 22 }, { x: 320, y: 44, e: "📸", s: 11 }, { x: 70, y: 190, e: "🚩", s: 11 }] },
  Volcano: { neon: "#FF5A3C", sky: "#140A08", icon: "🌋",
    path: "M200,34 C290,26 358,66 366,112 C374,158 320,196 236,202 C200,206 168,188 140,198 C92,214 30,178 32,124 C34,74 110,42 200,34 Z",
    decor: [{ x: 200, y: 112, e: "🌋", s: 34 }, { x: 140, y: 140, e: "🔥", s: 12 }, { x: 265, y: 90, e: "🔥", s: 12 }, { x: 320, y: 176, e: "🪨", s: 12 }] },
  "Snow Peaks": { neon: "#9FE6FF", sky: "#080D14", icon: "🏔",
    path: "M200,30 L288,52 L368,108 L322,168 L232,152 L200,202 L130,160 L36,132 L70,66 Z",
    decor: [{ x: 190, y: 105, e: "🏔", s: 30 }, { x: 110, y: 100, e: "🌨", s: 12 }, { x: 285, y: 120, e: "❄️", s: 11 }, { x: 250, y: 190, e: "🌲", s: 12 }] },
  Desert: { neon: "#FFB627", sky: "#120D06", icon: "🏜",
    path: "M200,36 C300,20 374,80 360,128 C348,170 280,164 232,182 C186,198 108,212 60,176 C16,142 40,84 108,60 C140,48 160,42 200,36 Z",
    decor: [{ x: 205, y: 110, e: "🏜", s: 26 }, { x: 130, y: 130, e: "🌵", s: 13 }, { x: 280, y: 80, e: "🌵", s: 11 }, { x: 320, y: 190, e: "💀", s: 10 }] },
  "Wild West": { neon: "#D9A05B", sky: "#100C07", icon: "🤠",
    path: "M110,44 C200,20 320,40 356,100 C376,140 340,186 268,196 C224,202 216,160 200,150 C184,160 176,202 132,196 C60,186 24,140 44,100 C58,72 80,52 110,44 Z",
    decor: [{ x: 200, y: 100, e: "🏚", s: 20 }, { x: 120, y: 120, e: "🌵", s: 12 }, { x: 290, y: 140, e: "🐄", s: 12 }, { x: 62, y: 62, e: "🦅", s: 10 }] },
  Cyberpunk: { neon: "#FF3EA5", sky: "#0C0714", icon: "🌃",
    path: "M96,36 L304,36 L368,100 L368,140 L304,200 L240,200 L212,168 L188,168 L160,200 L96,200 L32,140 L32,100 Z",
    decor: [{ x: 200, y: 118, e: "🏙", s: 26 }, { x: 110, y: 120, e: "🌆", s: 15 }, { x: 290, y: 120, e: "🛸", s: 11 }, { x: 340, y: 62, e: "🌃", s: 12 }] },
  Space: { neon: "#C084FC", sky: "#070510", icon: "🛰",
    path: "M104,116 C104,50 180,60 200,100 C220,140 296,182 296,116 C296,50 220,92 200,132 C180,172 104,182 104,116 Z",
    decor: [{ x: 152, y: 116, e: "🪐", s: 18 }, { x: 248, y: 116, e: "🌌", s: 16 }, { x: 60, y: 60, e: "✨", s: 10 }, { x: 340, y: 70, e: "☄️", s: 11 }, { x: 330, y: 190, e: "⭐", s: 9 }, { x: 70, y: 190, e: "✨", s: 9 }] },
  "Post-Apocalyptic": { neon: "#FF4D4D", sky: "#0F0606", icon: "☠",
    path: "M200,34 L266,50 L342,70 L366,122 L330,158 L344,190 L268,182 L200,204 L128,184 L58,192 L70,152 L34,120 L62,68 L138,52 Z",
    decor: [{ x: 200, y: 115, e: "☢️", s: 22 }, { x: 130, y: 100, e: "🔥", s: 12 }, { x: 280, y: 105, e: "💀", s: 13 }, { x: 90, y: 165, e: "🏚", s: 13 }] },
};

function RaceStage({ events, upTo, track, yourTeam, theirTeam }) {
  const theme = TRACK_THEMES[track?.id] || TRACK_THEMES.Racetrack;
  const pathRef = useRef(null);
  const [geo, setGeo] = useState(null); // { len, pts } — pre-sampled path points
  const [cam, setCam] = useState("chase"); // "chase" follows the pack · "map" shows all
  useEffect(() => {
    if (!pathRef.current) return;
    const p = pathRef.current;
    const len = p.getTotalLength();
    const pts = [];
    for (let i = 0; i <= 240; i++) pts.push(p.getPointAtLength((len * i) / 240));
    setGeo({ len, pts });
  }, [track?.id]);

  const byName = {};
  [...(yourTeam || []), ...(theirTeam || [])].forEach((r) => { byName[r.name] = r; });

  // Fold events up to the playhead: latest tick = TARGET positions.
  let snap = null, last = null, podiumEv = null;
  for (let i = 0; i < upTo && i < events.length; i++) {
    const e = events[i];
    if (e.t === "tick") snap = e;
    if (e.t === "podium") podiumEv = e;
    last = e;
  }
  const targets = snap
    ? snap.positions
    : [...(yourTeam || []).map((r) => ({ name: r.name, progress: 0, armor: r.maxArmor, maxArmor: r.maxArmor, wrecked: false, place: null, side: "a" })),
       ...(theirTeam || []).map((r) => ({ name: r.name, progress: 0, armor: r.maxArmor, maxArmor: r.maxArmor, wrecked: false, place: null, side: "b" }))];

  // ---- SMOOTH MOTION ENGINE -------------------------------------------------
  // The server sends 18 snapshots; raw playback lurches ~1/6 of a lap per step.
  // Instead, every car's DISPLAYED progress chases its target each animation
  // frame, so cars glide continuously — even while the ticker reveals events.
  const dispRef = useRef({});      // name -> displayed progress (float)
  const trailRef = useRef({});     // name -> recent [{x,y}] for speed trails
  const camRef = useRef({ x: 200, y: 116 });
  const [, setFrame] = useState(0); // rAF heartbeat re-render
  useEffect(() => {
    let raf, lastT = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.06, (now - lastT) / 1000);
      lastT = now;
      let moved = false;
      targets.forEach((p) => {
        const cur = dispRef.current[p.name] ?? 0;
        const target = p.progress;
        const next = cur + (target - cur) * Math.min(1, dt * 2.6);
        if (Math.abs(next - cur) > 0.01) moved = true;
        dispRef.current[p.name] = next;
      });
      if (moved) setFrame((f) => (f + 1) % 100000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets.map((p) => `${p.name}:${p.progress}`).join("|")]);

  const LAP_UNITS = 156; // 6 segments × 26 progress units = one full loop
  const chipXY = (name, place, idx, count) => {
    if (!geo) return { x: 30, y: 116 };
    const prog = dispRef.current[name] ?? 0;
    const t = place ? 0.002 : ((prog % LAP_UNITS) / LAP_UNITS) % 1;
    const i = Math.min(239, Math.max(0, Math.floor(t * 240)));
    const a = geo.pts[i], b = geo.pts[Math.min(240, i + 2)];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const lane = (idx - (count - 1) / 2) * 9;
    return { x: a.x + (-dy / d) * lane, y: a.y + (dx / d) * lane };
  };

  const order = [...targets].sort((x, y) => {
    if (x.place && y.place) return x.place - y.place;
    if (x.place) return -1;
    if (y.place) return 1;
    return (dispRef.current[y.name] ?? 0) - (dispRef.current[x.name] ?? 0);
  });

  // Lap readout follows the LEADER'S DISTANCE, not the server clock — so the
  // number on screen always matches the loops you can see.
  const leadProg = Math.max(0, ...targets.map((p) => dispRef.current[p.name] ?? 0));
  const lapShown = podiumEv ? 3 : Math.min(3, Math.floor(leadProg / LAP_UNITS) + 1);
  const weaponsLive = snap ? snap.lap >= 2 : false;

  const sideColor = (sd) => (sd === "a" ? LIME : MAGENTA);
  const dramatic = last && ["overtake", "wreck", "nitro", "finalLap", "godBanner", "eject", "spin", "smoke", "hazard", "shortcut", "respawn", "finish", "start"].includes(last.t) ? last : null;
  const bannerColor = last && (last.t === "wreck" ? "#FF5A5A" : last.t === "godBanner" ? "#FFD700" : last.t === "nitro" ? "#7DF9FF" : last.t === "finish" ? "#FFD700" : theme.neon);

  // ---- BROADCAST CAMERA -----------------------------------------------------
  // Chase mode: the viewBox glides after the live leader — the track scrolls
  // past like a chase cam. Map mode: the whole circuit.
  let viewBox = "0 0 400 232";
  if (cam === "chase" && geo && !podiumEv) {
    const lead = order.find((p) => !p.place && !p.wrecked) || order[0];
    if (lead) {
      const { x, y } = chipXY(lead.name, lead.place, 0, 1);
      camRef.current.x += (x - camRef.current.x) * 0.12;
      camRef.current.y += (y - camRef.current.y) * 0.12;
      const W = 210, H = 122;
      const vx = Math.max(-10, Math.min(410 - W, camRef.current.x - W / 2));
      const vy = Math.max(-10, Math.min(242 - H, camRef.current.y - H / 2));
      viewBox = `${vx} ${vy} ${W} ${H}`;
    }
  }

  // Speed trails: remember each car's last few screen positions.
  order.forEach((p, idx) => {
    const { x, y } = chipXY(p.name, p.place, idx % 4, Math.min(4, order.length));
    const tr = trailRef.current[p.name] || [];
    const prev = tr[tr.length - 1];
    if (!prev || Math.abs(prev.x - x) + Math.abs(prev.y - y) > 2.5) {
      tr.push({ x, y });
      if (tr.length > 5) tr.shift();
      trailRef.current[p.name] = tr;
    }
  });

  return (
    <div className="relative rounded-xl border overflow-hidden mb-3" style={{ borderColor: HAIRLINE, backgroundColor: theme.sky }}>
      <HoloStyles />
      <style>{`
        @keyframes raceGridScroll { 0% { background-position: 0 0; } 100% { background-position: 0 44px; } }
        @keyframes racePulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes raceWreck { 0% { transform: scale(1); opacity: 1; } 30% { transform: scale(2.1); opacity: 1; } 100% { transform: scale(0.4); opacity: 0; } }
        @keyframes raceBanner { 0% { opacity: 0; transform: translateY(8px) scale(0.85); } 15% { opacity: 1; transform: translateY(0) scale(1.05); } 85% { opacity: 1; transform: scale(1); } 100% { opacity: 0; } }
        @keyframes decorDrift { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
      `}</style>

      {/* Scrolling Tron floor grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `linear-gradient(${theme.neon}26 1px, transparent 1px), linear-gradient(90deg, ${theme.neon}26 1px, transparent 1px)`,
        backgroundSize: "44px 44px", animation: "raceGridScroll 3.5s linear infinite", opacity: 0.65,
      }} />
      {/* Horizon glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 50% 115%, ${theme.neon}30, transparent 55%), radial-gradient(ellipse at 50% -15%, ${theme.neon}18, transparent 50%)`,
      }} />

      {/* Header strip */}
      <div className="relative flex items-center justify-between px-3 py-2" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55), transparent)" }}>
        <span className="text-xs font-black tracking-widest" style={{ color: theme.neon, textShadow: `0 0 12px ${theme.neon}` }}>
          {theme.icon} {track?.id?.toUpperCase() || "CIRCUIT"}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCam((c) => (c === "chase" ? "map" : "chase"))}
            className="text-[9px] font-black px-2 py-0.5 rounded border"
            style={{ borderColor: theme.neon, color: cam === "chase" ? INK : theme.neon, backgroundColor: cam === "chase" ? theme.neon : "transparent" }}
          >
            {cam === "chase" ? "📹 CHASE CAM" : "🗺 FULL MAP"}
          </button>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ color: lapShown === 3 ? "#FF5A5A" : OFFWHITE, border: `1px solid ${lapShown === 3 ? "#FF5A5A" : HAIRLINE}`, animation: lapShown === 3 && !podiumEv ? "racePulse 1s infinite" : "none" }}>
            {podiumEv ? "🏆 FINISH" : `LAP ${lapShown}/3${weaponsLive ? " · 🔫 WEAPONS LIVE" : ""}`}
          </span>
        </div>
      </div>

      <div className="relative flex flex-col md:flex-row">
        {/* The circuit */}
        <div className="flex-1 min-w-0">
          <svg viewBox={viewBox} className="w-full block" style={{ maxHeight: 340, transition: cam === "map" ? "all 0.5s ease" : "none" }}>
            <defs>
              <filter id="raceNeon" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {order.map((p) => {
                const info = byName[p.name];
                return info && info.image ? (
                  <clipPath key={`clip-${p.name}`} id={`rc-${p.name.replace(/[^a-zA-Z0-9]/g, "")}`}>
                    <circle cx="0" cy="0" r="10" />
                  </clipPath>
                ) : null;
              })}
            </defs>

            {/* Infield tint + scenery */}
            <path d={theme.path} fill={theme.neon} opacity="0.05" />
            {(theme.decor || []).map((d, i) => (
              <text key={i} x={d.x} y={d.y} textAnchor="middle" fontSize={d.s} opacity="0.9" style={{ animation: `decorDrift ${3 + (i % 3)}s ease-in-out infinite` }}>{d.e}</text>
            ))}

            {/* Road: wide dark bed + neon rails */}
            <path d={theme.path} fill="none" stroke="#000" strokeWidth="26" strokeLinejoin="round" opacity="0.78" />
            <path d={theme.path} fill="none" stroke={theme.neon} strokeWidth="26" strokeLinejoin="round" opacity="0.09" />
            <path ref={pathRef} d={theme.path} fill="none" stroke={theme.neon} strokeWidth="2" strokeLinejoin="round" filter="url(#raceNeon)" opacity="0.95" />
            <path d={theme.path} fill="none" stroke={theme.neon} strokeWidth="1" strokeLinejoin="round" strokeDasharray="3 9" opacity="0.5" />

            {/* Start / finish gate */}
            {geo && (
              <g transform={`translate(${geo.pts[0].x}, ${geo.pts[0].y})`}>
                <rect x="-3" y="-16" width="6" height="32" fill="#FFF" opacity="0.9" />
                <rect x="-3" y="-16" width="6" height="8" fill="#000" /><rect x="-3" y="0" width="6" height="8" fill="#000" />
                <text x="0" y="-22" textAnchor="middle" fontSize="9" fill="#FFF">🏁</text>
              </g>
            )}

            {/* Cars */}
            {order.map((p, idx) => {
              const { x, y } = chipXY(p.name, p.place, idx % 4, Math.min(4, order.length));
              const info = byName[p.name] || {};
              const col = sideColor(p.side);
              const wreckNow = last && last.t === "wreck" && last.name === p.name;
              const nitroNow = last && last.t === "nitro" && last.name === p.name;
              const clipId = `rc-${p.name.replace(/[^a-zA-Z0-9]/g, "")}`;
              const trail = trailRef.current[p.name] || [];
              return (
                <g key={p.name}>
                  {/* Speed trail */}
                  {!p.wrecked && !p.place && trail.slice(0, -1).map((tp, ti) => (
                    <circle key={ti} cx={tp.x} cy={tp.y} r={2 + ti * 0.7} fill={col} opacity={0.06 + ti * 0.05} />
                  ))}
                  <g transform={`translate(${x}, ${y})`}>
                    {nitroNow && <circle r="16" fill="none" stroke="#7DF9FF" strokeWidth="2" opacity="0.8" style={{ animation: "racePulse 0.4s infinite" }} />}
                    {wreckNow && <text textAnchor="middle" y="4" fontSize="22" style={{ animation: "raceWreck 1s ease-out forwards" }}>💥</text>}
                    <circle r="11.5" fill="#0B0B10" stroke={col} strokeWidth="2"
                      opacity={p.wrecked ? 0.35 : 1}
                      style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
                    {info.image ? (
                      <image href={info.image} x="-10" y="-10" width="20" height="20" clipPath={`url(#${clipId})`} opacity={p.wrecked ? 0.35 : 1} preserveAspectRatio="xMidYMid slice" />
                    ) : (
                      <text textAnchor="middle" y="4" fontSize="11" opacity={p.wrecked ? 0.4 : 1}>{info.isCar ? "🏎️" : "🛺"}</text>
                    )}
                    {p.place && <text textAnchor="middle" y="-16" fontSize="8" fontWeight="900" fill="#FFD700">P{p.place}</text>}
                    <text textAnchor="middle" y="21" fontSize="6.5" fontWeight="700" fill={col} style={{ textShadow: `0 0 6px ${col}` }}>
                      {p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Position tower + armor */}
        <div className="md:w-48 px-3 pb-3 md:py-2 shrink-0">
          <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: MUTED }}>Positions</p>
          {order.map((p, i) => {
            const col = sideColor(p.side);
            const pct = Math.max(0, Math.min(100, (p.armor / (p.maxArmor || 1)) * 100));
            return (
              <div key={p.name} className="mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black w-6" style={{ color: i === 0 ? "#FFD700" : MUTED }}>{p.place ? `P${p.place}` : `${i + 1}.`}</span>
                  <span className="text-[10px] font-bold truncate flex-1" style={{ color: p.wrecked ? "#6B6577" : col, textDecoration: p.wrecked ? "line-through" : "none" }}>
                    {p.name}
                  </span>
                  {p.wrecked && <span className="text-[9px]">💥</span>}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden ml-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: pct > 50 ? "#5AFF8F" : pct > 22 ? "#FFB627" : "#FF5A5A", boxShadow: pct <= 22 ? "0 0 8px #FF5A5A" : "none" }} />
                </div>
              </div>
            );
          })}
          <p className="text-[8px] mt-2" style={{ color: MUTED }}>
            <span style={{ color: LIME }}>■</span> your squad · <span style={{ color: MAGENTA }}>■</span> rivals
          </p>
        </div>
      </div>

      {/* Event banner */}
      {dramatic && !podiumEv && dramatic.text && (
        <div key={upTo} className="absolute inset-x-0 bottom-2 text-center pointer-events-none" style={{ animation: "raceBanner 1.6s ease forwards" }}>
          <span className="inline-block px-3 py-1 rounded-lg text-[11px] font-black tracking-wide" style={{ backgroundColor: "rgba(0,0,0,0.8)", color: bannerColor, border: `1px solid ${bannerColor}`, textShadow: `0 0 10px ${bannerColor}` }}>
            {dramatic.text}
          </span>
        </div>
      )}
      {/* Podium ceremony */}
      {podiumEv && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.78)" }}>
          <div className="text-center px-4">
            <p className="text-lg font-black mb-3" style={{ color: "#FFD700", textShadow: "0 0 18px rgba(255,215,0,0.7)" }}>🏆 {podiumEv.winner} WINS</p>
            <div className="flex items-end justify-center gap-2">
              {[2, 1, 3].map((want) => {
                const p = (podiumEv.podium || []).find((x) => x.place === want);
                if (!p) return null;
                const h = want === 1 ? 64 : want === 2 ? 46 : 34;
                const col = sideColor(p.side);
                return (
                  <div key={want} className="flex flex-col items-center">
                    {p.image
                      ? <img src={p.image} alt={p.name} className="w-10 h-10 rounded-full object-cover mb-1 border-2" style={{ borderColor: col, boxShadow: `0 0 10px ${col}` }} />
                      : <span className="text-xl mb-1">{p.isCar ? "🏎️" : "🛺"}</span>}
                    <span className="text-[9px] font-bold mb-1 max-w-[74px] truncate" style={{ color: col }}>{p.name}</span>
                    <div className="w-16 rounded-t flex items-start justify-center pt-1 font-black text-xs" style={{ height: h, backgroundColor: want === 1 ? "#FFD700" : want === 2 ? "#C8CDD6" : "#CD7F32", color: INK }}>
                      {want}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- ⚖️ Legal — Terms of Service & Privacy Policy --------------------------
const LEGAL_TOS = [{"h": "1. Who we are", "p": ["MascotGen (\"MascotGen,\" \"we,\" \"us\") is a software service operated by Ultra Freight Company LLC, a Texas limited liability company doing business as MascotGen, at 2025 Lakepointe Dr, Apt 31E, Lewisville, TX 75057.", "You can reach us at support@mascotgen.studio.", "These Terms are a binding agreement between you and us. By creating an account, subscribing, connecting a wallet, or using the service in any way, you agree to them. If you don't agree, don't use MascotGen."]}, {"h": "2. What MascotGen is", "p": ["MascotGen is a subscription creative studio. You use it to:", "•Generate original mascot characters using AI — names, tickers, biographies,", "origin stories, and artwork", "•Expand those characters into ongoing illustrated sagas", "•Optionally mint a character as an NFT on the Solana blockchain", "•Play the Battle Arena, a simulated card-battle game using your characters'", "statistics", "MascotGen is a creative tool. We are not a cryptocurrency exchange, a broker, an investment platform, a marketplace, or a financial service of any kind. We do not sell, offer, promote, or give advice about any token, coin, or investment."]}, {"h": "3. Alpha status", "p": ["MascotGen is currently in Alpha. That means:", "•Features may change, break, or be removed without notice", "•Data may be lost, reset, or corrupted despite our efforts", "•Prices, limits, and plan features may change as the product matures", "•The service may be unavailable at times", "You use MascotGen in this state at your own risk. If you mint an NFT, that NFT exists on the blockchain independently of us and is not affected by changes to the service — but everything else (your saved characters, stories, ratings, and in-app data) is subject to the risks above. Export anything you care about."]}, {"h": "4. Eligibility", "p": ["You must be at least 18 years old to use MascotGen. Because the service involves payments and blockchain transactions, we do not knowingly permit anyone under 18 to create an account. If we learn that a user is under 18, we will close the account.", "You must also be legally permitted to use blockchain services where you live. It is your responsibility to know whether that's true."]}, {"h": "5. Your account", "p": ["You identify yourself to MascotGen with an email address, and optionally by connecting a Solana wallet. You are responsible for:", "•Keeping your email account secure", "•Keeping your wallet, seed phrase, and private keys secure", "We never ask for your seed phrase or private keys, and we can never recover them. If you lose access to your wallet, we cannot restore your NFTs. Nobody can. That is how blockchains work."]}, {"h": "6. Plans, payments, and refunds", "p": ["§Plans", "We currently offer a free tier and paid plans. The authoritative description of what each plan includes — generation limits, mint allowances, and features — is the Pricing page on mascotgen.studio. We keep that page accurate and update it when plans change.", "Each plan carries generation and mint limits, always stated on the Pricing page. These limits exist to prevent abuse and runaway automated usage, not to ration normal creative work.", "§Billing", "•Subscriptions are billed in advance through Stripe, on a recurring basis", "until cancelled", "•Subscriptions renew automatically. You may cancel at any time; cancellation", "takes effect at the end of your current billing period", "•One-time purchases (such as the Starter plan) are charged once and are not", "recurring", "•We do not store your card number. Stripe handles all payment data", "§Refunds", "If you're unhappy within 7 days of a charge, and you have not yet used that plan's allowance to mint an NFT, email us at support@mascotgen.studio and we'll refund it — no questions asked. After 7 days, or once an allowance has been used to mint, charges are non-refundable.", "In all cases: blockchain network fees are never refundable, because they are paid to the Solana network, not to us, and cannot be reversed by anyone.", "§Price changes", "We may change prices. Existing subscribers will be notified before a price change takes effect on their plan, and may cancel before it applies."]}, {"h": "7. AI-generated content", "p": ["You need to understand how AI generation actually works before you rely on it:", "•Output is not guaranteed to be unique. Two users giving similar inputs may", "receive similar names, stories, or artwork. We reduce repetition where we can, but we cannot and do not promise uniqueness or originality.", "•Output is not guaranteed to be accurate, appropriate, or usable. AI systems", "make mistakes and occasionally produce unexpected results.", "•We do not pre-screen generated content.", "•You are responsible for what you do with output. Before using a generated", "name, ticker, or image commercially, it is your responsibility to check that it doesn't infringe anyone's trademark, copyright, or other rights. We do not perform trademark clearance and do not warrant that output is free to use.", "§Who owns what", "•You own your inputs — the trait selections and prompts you provide.", "•As between you and us, you own the outputs generated from your inputs, to", "the extent such ownership is legally possible. Note that in some jurisdictions, purely AI-generated material may not be eligible for copyright protection at all. We can't change that, and we don't promise otherwise.", "•You grant us a license to store, reproduce, and display your characters and", "their stories for the purpose of operating the service — including showing them in the Battle Arena, on public statistics pages, and in the portable canon that travels with a minted NFT. If you'd rather we didn't feature your character publicly, contact us.", "•We own MascotGen itself — the software, the game systems, the Pentaverse", "setting, the gods and their lore, the battle engine, the brand, and everything else that isn't your character. You may not copy, reverse-engineer, or resell it."]}, {"h": "8. NFTs and the blockchain", "p": ["If you choose to mint a character:", "•The NFT is a digital collectible, not an investment. We make no promise", "about its value, its resale price, or that any market for it will ever exist. Nothing on MascotGen should be read as a promise of financial return.", "•You pay Solana network fees directly from your own wallet. We don't collect", "or control those fees.", "•Minting is irreversible. Once a transaction is confirmed on Solana, neither", "we nor anyone else can undo it.", "•Data written to the blockchain is public and permanent. Your character's", "name, artwork, traits, and your wallet address become part of a public ledger we do not control and cannot erase. See the Privacy Policy for what this means for deletion requests.", "•We may set a creator royalty on newly minted NFTs (currently 5%). Solana", "marketplaces honor royalties voluntarily, so we can't guarantee any royalty is actually collected on a secondary sale.", "•We do not operate a marketplace. If you trade a MascotGen NFT on a", "third-party platform, that transaction is between you and that platform."]}, {"h": "9. Rarity, packs, and published odds", "p": ["Some plans include mints whose rarity tier is determined by a random roll performed on our servers at the moment a pack is opened. You cannot choose or influence your rarity, and neither can we after the roll.", "We publish the odds. The current probability of each rarity tier is listed on the Pricing page. If the odds change, we update that page.", "Two things we commit to:", "•We do not manipulate individual users' odds. Everyone on the same plan rolls", "against the same table.", "•Promotional guarantees are literal. Where we advertise a guarantee — such as", "\"the first 333 mints in MascotGen history are all Legendary\" — that statement is true as written, applies to every qualifying mint, and ends exactly where we say it ends.", "Randomized digital items are regulated differently in different countries. If randomized purchases are restricted where you live, do not purchase them."]}, {"h": "10. The Battle Arena & The Grand Circuit — no wagering", "p": ["The Battle Arena and The Grand Circuit are free features for entertainment. To be explicit:", "•There is no wagering, betting, or staking of anything of value.", "•**Ratings, wins, leaderboard positions, and any in-game titles have no cash", "value**, cannot be redeemed, and are not property.", "•Losing a battle or a race never affects your NFT or removes anything you own.", "•We may reset ratings and leaderboards between seasons.", "•Any prizes we award are gifts at our discretion, require no purchase or", "entry fee, and may be changed or cancelled.", "Attempting to use MascotGen to arrange wagers between users is a violation of these Terms and will get your account closed."]}, {"h": "11. Acceptable use", "p": ["Don't:", "•Use MascotGen to create content that is illegal, hateful, harassing, sexual", "content involving minors, or that impersonates a real person deceptively", "•Generate content designed to defraud people — including tokens or characters", "built to impersonate an existing project or brand", "•Automate, scrape, or script the service; use bots; or attempt to bypass usage", "limits, plan restrictions, or the rarity system", "•Attack the service — including probing for vulnerabilities, overloading it, or", "interfering with other users", "•Resell access to MascotGen or share paid account credentials", "•Use MascotGen to arrange gambling, wagering, or any real-money contest", "We can suspend or terminate any account that does these things, without refund."]}, {"h": "12. Third-party services", "p": ["MascotGen runs on services we don't control, including Stripe, Supabase, Vercel, Anthropic, fal.ai, Irys/Arweave, and the Solana network. Outages, failures, or changes at any of them can affect MascotGen. We're not liable for their conduct."]}, {"h": "13. Disclaimers", "p": ["MascotGen is provided \"as is\" and \"as available,\" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, non-infringement, and any warranty that the service will be uninterrupted, secure, error-free, or that generated content will be unique, accurate, or commercially usable.", "Some jurisdictions don't allow certain disclaimers, so parts of this may not apply to you."]}, {"h": "14. Limitation of liability", "p": ["To the fullest extent permitted by law:", "•We are not liable for indirect, incidental, special, consequential, or punitive", "damages, or for lost profits, lost data, lost tokens, lost NFTs, or lost value of any digital asset", "•**Our total liability to you for any claim is limited to the greater of (a) the", "amount you paid us in the 3 months before the claim arose, or (b) $50 USD**", "•We are specifically not liable for: blockchain network failures, wallet", "compromises, lost seed phrases, third-party marketplace conduct, the market value of any digital asset, or failures of the third-party services listed above"]}, {"h": "15. Indemnity", "p": ["You agree to defend and indemnify us against claims arising from your use of the service, your content, your violation of these Terms, or your violation of someone else's rights."]}, {"h": "16. Termination", "p": ["You can stop using MascotGen at any time and cancel from your account or by emailing us.", "We can suspend or terminate accounts that violate these Terms, or discontinue the service entirely. If we shut MascotGen down, we'll give reasonable notice so you can export your work. NFTs you have already minted are unaffected — they live on Solana, not on our servers."]}, {"h": "17. Changes to these Terms", "p": ["We may update these Terms. If a change is material, we'll notify you by email or in the app before it takes effect. Continuing to use MascotGen after that means you accept the new Terms."]}, {"h": "18. Governing law and disputes", "p": ["These Terms are governed by the laws of the State of Texas, without regard to conflict-of-laws rules. Any dispute will be brought in the state or federal courts located in Denton County, Texas, and you and we consent to that jurisdiction."]}, {"h": "19. Miscellaneous", "p": ["If any part of these Terms is unenforceable, the rest stays in effect. Our failure to enforce something isn't a waiver. You may not transfer your rights under these Terms; we may transfer ours in connection with a sale of the business. These Terms and the Privacy Policy are the entire agreement between us.", "---", "Questions? support@mascotgen.studio"]}];

const LEGAL_PRIVACY = [{"h": "The short version", "p": ["•We collect your email address, your wallet address if you connect one,", "the characters you create, and counts of how much you've generated.", "•We do not sell your data. We don't run ads. We don't share your information", "with advertisers or data brokers.", "•We never see your card number — Stripe handles payments.", "•We never see your seed phrase or private keys, ever, under any circumstances.", "•**Anything you mint to the blockchain is public and permanent, and we cannot", "delete it.** Not because we won't — because nobody can.", "The rest of this document is the detail behind those points."]}, {"h": "1. Who we are", "p": ["MascotGen is operated by Ultra Freight Company LLC, a Texas limited liability company doing business as MascotGen, at 2025 Lakepointe Dr, Apt 31E, Lewisville, TX 75057.", "For any privacy question or request: support@mascotgen.studio."]}, {"h": "2. What we collect", "p": ["§You give us directly", "§Generated automatically", "§We do NOT collect", "•Card numbers, CVVs, or bank details. Stripe collects and stores these. We", "receive only a subscription status and the email tied to it.", "•Seed phrases, private keys, or wallet passwords. These never touch our", "servers. Any message asking you for them is a scam and is not from us.", "•Your name, address, or phone number, unless you volunteer it in an email.", "•Precise location data."]}, {"h": "3. Data stored in your own browser", "p": ["MascotGen keeps a copy of your collection, your saved characters, and preferences (language, session state) in your browser's local storage. This is on your device, not our servers — it's what makes the studio fast and keeps your work available between visits.", "Consequences worth knowing:", "•Clearing your browser data will delete locally-stored characters that were never", "minted or synced. Minted characters can be restored by connecting your wallet and using Sync Wallet.", "•Anyone with access to your device can see your collection.", "We don't use advertising cookies or third-party tracking pixels."]}, {"h": "4. How we use your data", "p": ["We use it to run the service: create and store your characters, generate art and stories, enforce plan limits, process payments, record mints, run battles, restore your collection across devices, respond to support requests, detect abuse, and comply with the law.", "We do not: sell your data, rent it, share it with advertisers, use it to build advertising profiles, or use your private character data to train AI models of our own."]}, {"h": "5. Who we share it with", "p": ["We use third-party providers to operate. Each receives only what it needs:", "We may also disclose information if legally required (subpoena, court order, or other legal obligation), to protect our rights or someone's safety, or as part of a business sale — in which case we'll notify you."]}, {"h": "6. The blockchain problem", "p": ["This section matters more than any other. Please read it.", "When you choose to mint a character as an NFT, this information is written to the Solana blockchain and to permanent decentralized storage:", "•Your wallet address", "•The character's name, symbol, and description", "•The artwork", "•The character's traits and statistics", "Once written, this data is:", "•Public. Anyone in the world can view it, and services exist specifically to", "index it.", "•Permanent. It cannot be edited away or deleted — not by you, not by us, not", "by any court order. Arweave storage is designed to persist for centuries.", "•Outside our control. We do not operate Solana or Arweave.", "What this means practically: if you later ask us to delete your data, we can delete everything in our own database — your email, your account, your saved characters, your usage records. We cannot delete what is already on the blockchain, because no such capability exists for anyone.", "Wallet addresses are pseudonymous, not anonymous. If your wallet address is ever publicly linked to your identity elsewhere, your MascotGen activity becomes linkable to you too.", "Only mint what you are comfortable making public forever."]}, {"h": "7. Your rights", "p": ["Depending on where you live, you may have the right to:", "•Access the personal data we hold about you", "•Correct inaccurate data", "•Delete your data (subject to the blockchain limits in Section 6)", "•Export your data in a portable format", "•Object to or restrict certain processing", "•Withdraw consent where processing is based on consent", "To exercise any of these, email support@mascotgen.studio. We'll respond within 30 days. We may need to verify that you control the email address or wallet in question.", "If you are in the European Economic Area or the UK, you have these rights under GDPR, and you may complain to your local data protection authority. Our legal bases for processing are: performing our contract with you (running the service), legitimate interests (security, abuse prevention, improving the product), consent (where you've given it), and legal obligations.", "If you are in California, you have rights under the CCPA/CPRA, including the right to know, delete, and correct — and the right not to be discriminated against for exercising them. We do not sell or share personal information as those terms are defined by the CCPA."]}, {"h": "8. How long we keep it", "p": ["•Account data: as long as your account is active, plus a reasonable wind-down", "period after closure", "•Payment records: as long as required by tax and accounting law (typically 7", "years) — this is a legal obligation we can't waive", "•Usage counts: rolling basis, only as long as needed to enforce limits", "•Character and battle data: until you delete it or close your account", "•Blockchain data: forever, unavoidably (Section 6)"]}, {"h": "9. Security", "p": ["We protect your data with encrypted connections (HTTPS), server-side secret keys never exposed to browsers, service-role database access restricted to our servers, and payment handling delegated entirely to Stripe.", "That said: no system is perfectly secure. MascotGen is in Alpha. We cannot guarantee against every breach, and you should not store anything in the service that you could not tolerate becoming public.", "If a breach affects your personal data, we'll notify you and any required regulator as the law requires."]}, {"h": "10. Children", "p": ["MascotGen is not for anyone under 18. We don't knowingly collect data from children. If you believe a child has given us personal information, email support@mascotgen.studio and we'll delete it."]}, {"h": "11. International users", "p": ["We operate from the United States, and your data is processed there and in other countries where our providers operate. If you're outside the US, using MascotGen means your data is transferred to the US, which may have different privacy protections than your home country."]}, {"h": "12. Changes to this policy", "p": ["We may update this policy. Material changes will be announced by email or in the app before taking effect. The \"Last updated\" date at the top always reflects the current version."]}, {"h": "13. Contact", "p": ["Questions, requests, or concerns about privacy:", "support@mascotgen.studio Ultra Freight Company LLC dba MascotGen 2025 Lakepointe Dr, Apt 31E, Lewisville, TX 75057"]}];

function LegalDoc({ blocks }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) => (
        <div key={i}>
          <h3 className="text-sm font-bold mb-1" style={{ color: LIME }}>{b.h}</h3>
          {b.p.map((line, j) => {
            if (line.startsWith("§")) {
              return <p key={j} className="text-xs font-bold mt-2 mb-1" style={{ color: AMBER }}>{line.slice(1)}</p>;
            }
            if (line.startsWith("•")) {
              return (
                <p key={j} className="text-xs leading-relaxed pl-3" style={{ color: MUTED }}>
                  <span style={{ color: LIME }}>·</span> {line.slice(1)}
                </p>
              );
            }
            return <p key={j} className="text-xs leading-relaxed mb-1.5" style={{ color: MUTED }}>{line}</p>;
          })}
        </div>
      ))}
    </div>
  );
}

function LearnPage() {
  const [section, setSection] = useState("crypto");
  const [openGrade, setOpenGrade] = useState(1);
  const [openGuide, setOpenGuide] = useState("card");

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-1" style={{ color: LIME }}>Crypto University</h1>
      <p className="text-sm mb-4" style={{ color: MUTED }}>
        The University wing of MascotGen: learn crypto from zero, and learn how the battle-card game works.
      </p>

      {/* Sub-tab switcher */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSection("crypto")}
          className="px-4 py-2 rounded-lg text-xs font-bold"
          style={{ backgroundColor: section === "crypto" ? LIME : "transparent", color: section === "crypto" ? INK : MUTED, border: `1px solid ${section === "crypto" ? LIME : HAIRLINE}` }}
        >
          📚 Crypto Curriculum
        </button>
        <button
          onClick={() => setSection("play")}
          className="px-4 py-2 rounded-lg text-xs font-bold"
          style={{ backgroundColor: section === "play" ? AMBER : "transparent", color: section === "play" ? INK : MUTED, border: `1px solid ${section === "play" ? AMBER : HAIRLINE}` }}
        >
          🎮 How to Play
        </button>
        <button
          onClick={() => setSection("academy")}
          className="px-4 py-2 rounded-lg text-xs font-bold"
          style={{ backgroundColor: section === "academy" ? MAGENTA : "transparent", color: section === "academy" ? INK : MUTED, border: `1px solid ${section === "academy" ? MAGENTA : HAIRLINE}` }}
        >
          🎓 The Academy
        </button>
        <button
          onClick={() => setSection("legal")}
          className="px-4 py-2 rounded-lg text-xs font-bold"
          style={{ backgroundColor: section === "legal" ? "#5EC9FF" : "transparent", color: section === "legal" ? INK : MUTED, border: `1px solid ${section === "legal" ? "#5EC9FF" : HAIRLINE}` }}
        >
          ⚖️ Legal
        </button>
      </div>

      {section === "academy" && (
        <>
          <p className="text-xs mb-4" style={{ color: MUTED }}>
            The college wing. Every system on the platform, in depth, with worked examples — from writing a
            Writer's Bible the AI actually obeys, to reading a race, to what stacks with what. If it exists on
            MascotGen, its course is here.
          </p>
          <div className="flex flex-col gap-2">
            {ACADEMY.map((g) => (
              <div key={g.key} className="rounded-lg border overflow-hidden" style={{ borderColor: openGuide === g.key ? MAGENTA : HAIRLINE }}>
                <button
                  onClick={() => setOpenGuide(openGuide === g.key ? null : g.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  style={{ backgroundColor: openGuide === g.key ? "rgba(255,62,165,0.06)" : "transparent" }}
                >
                  <span className="text-sm font-bold" style={{ color: openGuide === g.key ? MAGENTA : OFFWHITE }}>
                    {g.title}
                  </span>
                  <span style={{ color: MUTED }}>{openGuide === g.key ? "−" : "+"}</span>
                </button>
                {openGuide === g.key && (
                  <div className="px-4 pb-4">
                    {g.pts.map((p, i) => (
                      <p key={i} className="text-sm leading-relaxed mb-2" style={{ color: OFFWHITE }}>
                        {p}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {section === "crypto" && (
        <>
          <p className="text-xs mb-4" style={{ color: MUTED }}>
            Zero-to-launch in 12 grades, no prior knowledge needed. Not financial advice — most meme tokens lose value; never risk money you can't afford to lose.
          </p>
          <div className="flex flex-col gap-2">
            {CURRICULUM.map((c) => (
              <div key={c.g} className="rounded-lg border overflow-hidden" style={{ borderColor: openGrade === c.g ? LIME : HAIRLINE }}>
                <button
                  onClick={() => setOpenGrade(openGrade === c.g ? null : c.g)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  style={{ backgroundColor: openGrade === c.g ? "rgba(198,255,61,0.06)" : "transparent" }}
                >
                  <span className="text-sm font-bold" style={{ color: openGrade === c.g ? LIME : OFFWHITE }}>
                    Grade {c.g} — {c.title}
                  </span>
                  <span style={{ color: MUTED }}>{openGrade === c.g ? "−" : "+"}</span>
                </button>
                {openGrade === c.g && (
                  <div className="px-4 pb-4">
                    {c.pts.map((p, i) => (
                      <p key={i} className="text-sm leading-relaxed mb-2" style={{ color: OFFWHITE }}>
                        {p}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {section === "legal" && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setOpenGuide("tos")}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border"
              style={{ borderColor: openGuide === "tos" ? "#5EC9FF" : HAIRLINE, color: openGuide === "tos" ? "#5EC9FF" : MUTED }}
            >
              Terms of Service
            </button>
            <button
              onClick={() => setOpenGuide("privacy")}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border"
              style={{ borderColor: openGuide === "privacy" ? "#5EC9FF" : HAIRLINE, color: openGuide === "privacy" ? "#5EC9FF" : MUTED }}
            >
              Privacy Policy
            </button>
          </div>
          <div className="rounded-xl border p-4" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
            <p className="text-xs mb-3" style={{ color: MUTED }}>Last updated: August 1, 2026</p>
            <LegalDoc blocks={openGuide === "privacy" ? LEGAL_PRIVACY : LEGAL_TOS} />
            <p className="text-xs mt-4 pt-3" style={{ color: MUTED, borderTop: "1px solid #26232F" }}>
              Questions? <span style={{ color: "#5EC9FF" }}>support@mascotgen.studio</span>
            </p>
          </div>
        </>
      )}

      {section === "play" && (
        <>
          <p className="text-xs mb-4" style={{ color: MUTED }}>
            Everything you need to understand your mascot's battle card and how the game works. Battle mechanics are rolling out in phases — this is your field guide.
          </p>
          <div className="flex flex-col gap-2">
            {GAMEPLAY_GUIDE.map((g) => (
              <div key={g.key} className="rounded-lg border overflow-hidden" style={{ borderColor: openGuide === g.key ? AMBER : HAIRLINE }}>
                <button
                  onClick={() => setOpenGuide(openGuide === g.key ? null : g.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  style={{ backgroundColor: openGuide === g.key ? "rgba(255,182,39,0.06)" : "transparent" }}
                >
                  <span className="text-sm font-bold" style={{ color: openGuide === g.key ? AMBER : OFFWHITE }}>
                    {g.title}
                  </span>
                  <span style={{ color: MUTED }}>{openGuide === g.key ? "−" : "+"}</span>
                </button>
                {openGuide === g.key && (
                  <div className="px-4 pb-4">
                    {g.pts.map((p, i) => (
                      <p key={i} className="text-sm leading-relaxed mb-2" style={{ color: OFFWHITE }}>
                        {p}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  // The landing page shows on every fresh VISIT, but a mid-session reload
  // (mobile browsers reload background tabs constantly) must NOT bounce you
  // back to the gate — so "entered" lives in sessionStorage: it survives
  // reloads within the tab, and resets when you come back another day.
  const [entered, setEnteredRaw] = useState(() => {
    try { return sessionStorage.getItem("mascotgen-entered") === "1"; } catch (e) { return false; }
  });
  const setEntered = (v) => {
    setEnteredRaw(v);
    try { sessionStorage.setItem("mascotgen-entered", v ? "1" : "0"); } catch (e) {}
  };
  const [tab, setTab] = useState(() => {
    try { return sessionStorage.getItem("mascotgen-entered") === "1" ? "studio" : "home"; } catch (e) { return "home"; }
  });

  const [gender, setGender] = useState("Male");
  const [skinTone, setSkinTone] = useState("Any");
  const [archetypes, setArchetypes] = useState([]);
  const [vibes, setVibes] = useState([]);
  const [worlds, setWorlds] = useState([]);
  const [colors, setColors] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [aura, setAura] = useState("None");
  const [artStyle, setArtStyle] = useState("Anime / Manga");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState("card");

  const [trendingLoading, setTrendingLoading] = useState(false);

  const [collection, setCollection] = useState([]);
  const [showCollection, setShowCollection] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("Free");
  const [genCount, setGenCount] = useState(0);
  const [artCredits, setArtCredits] = useState(0);

  const [studioEntry, setStudioEntry] = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioError, setStudioError] = useState(null);
  const [studioInput, setStudioInput] = useState("");
  const [artLoadingFor, setArtLoadingFor] = useState(null);
  const [artError, setArtError] = useState(null);
  const [regenInfo, setRegenInfo] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [imgRetryKey, setImgRetryKey] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  // Mint flow state (rarity rolled at mint, revealed on the card)
  const [minting, setMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState(null);
  const [mintResult, setMintResult] = useState(null);
  const [mintError, setMintError] = useState(null);

  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const { connection } = useConnection();
  const walletAddress = publicKey ? publicKey.toBase58() : null;
  const shortAddress = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : null;

  // 🔐 WALLET-SIGNATURE AUTH — proves to the server that actions taken "as
  // this wallet" really come from its owner. Signs one message per 10-minute
  // window and caches it, so it's ONE Phantom popup every 10 minutes at most,
  // shared by battles, publishing, PvP and claims.
  const authCacheRef = useRef({ key: null, auth: null });
  const getWalletAuth = async () => {
    try {
      if (!walletAddress || !wallet || typeof wallet.signMessage !== "function") return null;
      const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
      const key = `${walletAddress}:${bucket}`;
      if (authCacheRef.current.key === key) return authCacheRef.current.auth;
      const msg = new TextEncoder().encode(`mascotgen-auth:${walletAddress}:${bucket}`);
      const sigBytes = await wallet.signMessage(msg);
      let bin = "";
      for (let i = 0; i < sigBytes.length; i++) bin += String.fromCharCode(sigBytes[i]);
      const auth = { bucket, signature: btoa(bin) };
      authCacheRef.current = { key, auth };
      return auth;
    } catch (e) {
      return null; // user declined or wallet can't sign — server will decide
    }
  };

  const isAlpha = tier === "Alpha";                       // Elite
  const isPlatinum = tier === "Platinum";
  const isPremium = isPlatinum || isAlpha;                 // ⭐ attributes + Trending
  const isPaid = tier === "Creator" || isPremium;          // any paying plan

  // Generation language — the AI writes all character text in this language.
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("mascotgen-lang") || "English"; } catch (e) { return "English"; }
  });
  const pickLang = (l) => { setLang(l); try { localStorage.setItem("mascotgen-lang", l); } catch (e) {} };

  // Locked-attribute PREVIEW: free users can tap Elite items to see them on
  // the mascot preview, but they're stripped at generation time.
  const [lockMsg, setLockMsg] = useState("");
  const tease = (msg) => { setLockMsg(`🔒 ${msg} — it shows on your preview, but upgrade on the Pricing page to generate and mint with it.`); setTimeout(() => setLockMsg(""), 6000); };
  // Two locked pools, two different keys:
  //   STAR_ONLY  — ⭐ attributes, unlocked by Platinum and Elite
  //   AURA_ONLY  — auras, Elite exclusive
  const STAR_ONLY = new Set([...ALPHA_ARCHETYPES, ...ALPHA_VIBES, ...ALPHA_WORLDS, ...ALPHA_COLORS, ...ALPHA_ACCESSORIES]);
  const AURA_ONLY = new Set(["Dragon Aura", "Ultimate Aura", "Blessed Aura", "Cosmic Aura", "Dark Aura"]);
  const ALPHA_ONLY = new Set([...STAR_ONLY, ...AURA_ONLY]);
  const gate = (list) =>
    (list || []).filter((i) => {
      if (AURA_ONLY.has(i)) return isAlpha;
      if (STAR_ONLY.has(i)) return isPremium;
      return true;
    });
  const gatedAura = isAlpha ? aura : "None";

  // Per-tier selection limits for each category.
  //   Free:     1 across the board
  //   Platinum (Creator): Archetype 1, Vibe 3, World 7, Color 1, Accessories 4
  //   Elite (Alpha):      Archetype 2, Vibe 5, World 11, Color 2, Accessories 7
  // Free users get room to actually PLAY — 2 of everything — but only from the
  // base pools (gate() strips Elite picks at generation). Paid tiers buy depth
  // and the Elite pools, not the right to combine two things.
  // The ladder: Free builds, Starter expands, Platinum unlocks the ⭐ pools,
  // Elite unlocks everything including auras.
  const LIMITS = isAlpha
    ? { arch: 2, vibe: 5, world: 11, color: 2, acc: 7 }
    : isPlatinum
    ? { arch: 2, vibe: 4, world: 9, color: 2, acc: 5 }
    : tier === "Creator"
    ? { arch: 2, vibe: 3, world: 7, color: 2, acc: 4 }
    : { arch: 2, vibe: 2, world: 2, color: 2, acc: 2 };
  const maxAccessories = LIMITS.acc;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mascotgen-collection");
      if (saved) setCollection(JSON.parse(saved));
      const savedEmail = localStorage.getItem("mascotgen-email");
      if (savedEmail) { setEmail(savedEmail); checkSubscription(savedEmail); }
    } catch (e) {}
  }, []);

  const persistCollection = (next) => {
    setCollection(next);
    try { localStorage.setItem("mascotgen-collection", JSON.stringify(next)); } catch (e) {}
  };

  // 🔄 CROSS-TAB SYNC — the studio opens mascots in new tabs, and every tab
  // holds its own copy of the collection. Without this listener, whichever tab
  // saved LAST would overwrite art history written by any other tab (this is
  // exactly how regenerated art used to vanish). The browser fires "storage"
  // in all OTHER tabs whenever one tab writes — so every tab stays current
  // and later saves never clobber another tab's work.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "mascotgen-collection" && e.newValue) {
        try {
          const fresh = JSON.parse(e.newValue);
          setCollection(fresh);
          // If this tab has a studio open on a mascot another tab just
          // updated, refresh the studio copy too (keeps art history live).
          setStudioEntry((s) => {
            if (!s) return s;
            const updated = fresh.find((c) => String(c.id) === String(s.id));
            return updated ? { ...s, ...updated } : s;
          });
        } catch (err) {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Maps the subscription endpoint's `plan` value to the frontend's internal
  // tier names. The endpoint returns lowercase plan ids (starter/platinum/elite/
  // dev); the UI gates features on "Free" | "Creator" | "Alpha".
  //   starter                      -> Creator (mid: partial unlock)
  //   platinum / elite / passes    -> Alpha (top: everything incl. auras)
  //   dev email                    -> Alpha (so you can test all tiers)
  const planToTier = (plan) => {
    if (!plan) return "Free";
    const p = String(plan).toLowerCase();
    if (p === "starter") return "Creator";
    if (p === "platinum") return "Platinum";
    if (["elite", "platinum_pass", "pass"].includes(p)) return "Alpha";
    return "Free";
  };

  // Every /api/generate call goes through here. If the server refuses on plan
  // grounds (402) or identity grounds (401), our cached tier is out of date —
  // a refund, cancellation, or expiry happened since this tab loaded. Re-check
  // immediately so the UI stops offering paid features the server won't honor.
  const generateFetch = async (options) => {
    // Attach the wallet signature so the DEV bypass can verify identity —
    // a harmless no-op for normal users (the server just ignores it).
    try {
      const a = await getWalletAuth();
      if (a && walletAddress && options && typeof options.body === "string") {
        const b = JSON.parse(options.body);
        options = { ...options, body: JSON.stringify({ ...b, wallet: walletAddress, auth: a }) };
      }
    } catch (e) {}
    const res = await fetch("/api/generate", options);
    if (res.status === 402 || res.status === 401) {
      try { await checkSubscription(email); } catch (e) {}
    }
    return res;
  };

  // Tabs stay open for days. Re-check the plan whenever someone returns to the
  // tab so a lapsed, cancelled, or refunded account stops showing paid features
  // without needing a manual refresh.
  useEffect(() => {
    const onFocus = () => { if (email) checkSubscription(email); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const checkSubscription = async (em) => {
    if (!em) return;
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const data = await res.json();
      // Endpoint returns { active, plan, dev? }. Dev emails historically came
      // back plan:"platinum" — which used to mean full access, but Platinum is
      // now its own mid tier. Honor the dev flag directly so the dev account
      // always sits at the top tier regardless of what plan name it reports.
      if (data.dev) {
        setTier("Alpha");
      } else if (data.active && data.plan) {
        setTier(planToTier(data.plan));
      } else {
        setTier("Free");
      }
      if (typeof data.artCredits === "number") setArtCredits(data.artCredits);
    } catch (e) {}
  };

  const cappedArchetypes = archetypes.slice(0, LIMITS.arch);
  const cappedVibes = vibes.slice(0, LIMITS.vibe);
  const cappedWorlds = worlds.slice(0, LIMITS.world);
  const cappedColors = colors.slice(0, LIMITS.color);
  const cappedAccessories = accessories.slice(0, maxAccessories);

  const randomize = () => {
    const pick = (arr, n) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, n);
    };
    // Random count between 1 and the tier's limit for each category.
    const upTo = (max) => 1 + Math.floor(Math.random() * max);
    const archPool = isPremium ? [...ARCHETYPES, ...ALPHA_ARCHETYPES] : ARCHETYPES;
    const vibePool = isPremium ? [...VIBES, ...ALPHA_VIBES] : VIBES;
    const worldPool = isPremium ? [...WORLDS, ...ALPHA_WORLDS] : WORLDS;
    const colorPool = isPremium ? [...COLORS, ...ALPHA_COLORS] : COLORS;
    const accPool = isPremium ? [...ACCESSORIES, ...ALPHA_ACCESSORIES] : ACCESSORIES;
    setArchetypes(pick(archPool, upTo(LIMITS.arch)));
    setVibes(pick(vibePool, upTo(LIMITS.vibe)));
    setWorlds(pick(worldPool, upTo(LIMITS.world)));
    setColors(pick(colorPool, upTo(LIMITS.color)));
    setAccessories(pick(accPool, Math.floor(Math.random() * (LIMITS.acc + 1))));
    if (isAlpha && Math.random() > 0.6) setAura(AURAS[1 + Math.floor(Math.random() * (AURAS.length - 1))]);
    else setAura("None");
  };

  const buildPrompt = () => {
    const genAccessories = gate(cappedAccessories);
    const allAccessories = gatedAura !== "None" ? [...genAccessories, gatedAura] : genAccessories;
    // 🏎️ Sports Car archetype: roll a fresh era/style every generation, and if
    // mixed with another archetype, direct a transformers-style hybrid.
    const pickedArch = gate(archetypes);
    let carContext = "";
    if (pickedArch.includes("Sports Car")) {
      const carSpec = randomCarStyle();
      const coPilots = pickedArch.filter((a) => a !== "Sports Car");
      carContext = coPilots.length
        ? `\nVEHICLE FORM: This mascot is a hybrid — a ${coPilots.join(" / ")} character bonded to ${carSpec}. Transformers-style: the character pilots the car, can merge with it, and they share one identity. In visualDescription, SHOW the character together with its vehicle — driving it, leaning out of it, or partially fused with it — and describe the exact car (era, body style, details).`
        : `\nVEHICLE FORM: This mascot IS ${carSpec} — a living car character with a personality, expressive headlight eyes and a face worked into the front grille. Describe the exact car (era, body style, details) in visualDescription.`;
    }
    let nameHistory = [];
    try { nameHistory = JSON.parse(localStorage.getItem("mascotgen-name-history") || "[]"); } catch (e) {}
    const nameVariety = `\n\nIMPORTANT: Use seed ${Math.floor(Math.random() * 100000)} to ensure a fresh, unique name and story different from any previous generation. Avoid generic or repeated names.${nameHistory.length ? ` NEVER use these already-taken names or anything similar to them: ${nameHistory.join(", ")}.` : ""}${lang !== "English" ? `\n\nLANGUAGE: Write EVERY text field (tagline, bio, originStory, socialBio, firstTweet, telegramWelcome) in ${lang}. The character name and ticker may stay stylized.` : ""}`;
    return `You are a world-class meme coin character designer and storyteller. Create an original meme token character based on these traits. Treat the traits as creative inspiration, not a rigid checklist — weave them into something coherent and memorable.

Gender: ${gender}
Complexion: ${skinTone === "Any" ? "artist's choice" : skinTone}${skinTone !== "Any" ? ` — the visualDescription MUST state this explicitly: ${SKIN_TONE_PROMPT[skinTone] || skinTone}` : ""}
Archetype(s): ${gate(archetypes).join(", ") || "surprise me"}
Vibe(s): ${gate(vibes).join(", ") || "surprise me"}
World(s)/Setting(s): ${gate(worlds).join(", ") || "surprise me"}
Color palette: ${gate(colors).join(", ") || "surprise me"}
Accessories: ${allAccessories.join(", ") || "none"}
Art style: ${artStyle}${carContext}

Return ONLY valid JSON (no markdown, no backticks) with this exact shape:
{
 "characterName": "string, the character's actual name",
 "tokenName": "string, the token/project name",
 "ticker": "string, 3-6 uppercase letters, no dollar sign",
 "tagline": "string, one punchy sentence",
 "bio": "string, 2-3 sentences of character backstory",${isPaid ? '\n "originStory": ["string panel 1", "string panel 2", "string panel 3", "string panel 4"],' : ""}
 "visualDescription": "string, a detailed AI art prompt to generate this character's image in ${artStyle} style. IMPORTANT: lead with the character's body, face and pose, then feature only the 2-3 most visually important accessories in precise locations (e.g. 'a gold watch on his left wrist'); mention remaining accessories briefly or as background details. Never list more than 3 objects in one sentence — image models misplace crowded objects.",
 "socialBio": "string, a short X/Twitter bio for the character",
 "firstTweet": "string, the character's first launch tweet",
 "telegramWelcome": "string, 2-3 sentence welcome message for new Telegram members, warm and on-theme"
}${nameVariety}`;
  };

  // The /api/generate endpoint returns Anthropic's raw response shape with a
  // content array of text blocks. Pull the text out of those blocks, then parse
  // the JSON the model returned inside it.
  const parseModelJSON = (data) => {
    // If the endpoint already returned a parsed object, use it.
    if (data && data.result) {
      return typeof data.result === "string" ? JSON.parse(data.result) : data.result;
    }
    // Otherwise dig the text out of Anthropic's content blocks.
    let text = "";
    if (Array.isArray(data?.content)) {
      text = data.content
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("\n");
    }
    if (!text) throw new Error(data?.error?.message || data?.error || "Empty response from model");
    // Strip markdown code fences if the model added them.
    let cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    // Web-search responses often wrap the JSON in prose — extract the outermost
    // JSON object (first "{" to last "}") before parsing.
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) {
      throw new Error("Model response contained no JSON — try again.");
    }
    cleaned = cleaned.slice(first, last + 1);
    try {
      return JSON.parse(cleaned);
    } catch (parseErr) {
      // Truncation repair: long stories can get cut off mid-panel by the
      // model's output limit. Walk back to the last complete string and
      // close the JSON — better a chapter missing its final beat than an
      // error eating the whole thing.
      let idx = cleaned.length;
      for (let k = 0; k < 40; k++) {
        idx = cleaned.lastIndexOf('"', idx - 1);
        if (idx <= 1) break;
        for (const tail of ['"]}', '"] }', '"}', '"]}}']) {
          try {
            const candidate = JSON.parse(cleaned.slice(0, idx) + tail);
            if (candidate && (Array.isArray(candidate.panels) || candidate.title || candidate.characterName)) return candidate;
          } catch (e2) {}
        }
      }
      throw parseErr;
    }
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setView("card");
    setImgFailed(false);
    try {
      const res = await generateFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt(), email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || "Generation failed");
      const parsed = parseModelJSON(data);
      setResult(parsed);
      try {
        const hist = JSON.parse(localStorage.getItem("mascotgen-name-history") || "[]");
        if (parsed.characterName) localStorage.setItem("mascotgen-name-history", JSON.stringify([...hist, parsed.characterName].slice(-20)));
      } catch (e) {}
    } catch (e) {
      setError(e.message || "Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  };

  // Trending Mode (Alpha): scans the LIVE web for what's viral right now —
  // X/Twitter trends, TikTok, breaking news, viral people/moments across any
  // topic (politics, war, comedy, sports, a random person's viral routine) —
  // and builds a mascot from the single most meme-able moment. The mascot is
  // tagged with the moment so it carries a commemorative viral ability forever.
  const [trendingInfo, setTrendingInfo] = useState(null);

  const generateTrending = async () => {
    setTrendingLoading(true);
    setError(null);
    setTrendingInfo(null);
    setResult(null);
    setView("card");
    try {
      // Diversity engine: each click hunts a DIFFERENT corner of the internet,
      // and recently-used moments are excluded so repeat clicks find new gold.
      const TREND_ANGLES = [
        "sports — a game moment, athlete quote, wild play or championship drama from the last 48 hours",
        "a specific PERSON (famous or completely unknown) who just went viral for something they did or said — a routine, a clip, an interview moment",
        "crypto/finance culture — a token, a trader, a chart moment or market drama people are memeing right now",
        "comedy/absurd internet moments — a weird video, an unhinged post, a chaotic livestream moment",
        "politics or world news being memed right now (the MEME angle, not the politics)",
        "music/celebrity culture — a lyric, a performance, a feud, an award-show moment",
        "gaming/streaming — a game release, streamer moment, esports drama",
        "animals or wholesome chaos — a specific animal or wholesome clip going viral",
        "a viral PHRASE, sound or meme format that exploded in the last few days",
        "weird news — a strange local story or bizarre headline the internet adopted",
      ];
      const angle = TREND_ANGLES[Math.floor(Math.random() * TREND_ANGLES.length)];
      let trendHistory = [];
      try { trendHistory = JSON.parse(localStorage.getItem("mascotgen-trend-history") || "[]"); } catch {}

      const trendPrompt = `Search the web for what is going VIRAL right now — but focus your hunt SPECIFICALLY on this category: ${angle}. Look at X/Twitter trends, TikTok, and fresh headlines within that category. Prioritize a specific, fresh, meme-able CURRENT moment — the more specific, the better. Do NOT default to the biggest mainstream trend of the day.${trendHistory.length ? ` STRICTLY AVOID these already-used moments (find something completely different): ${trendHistory.join("; ")}.` : ""}

Then design an original meme token character inspired by that moment, drawing on these creative picks where they naturally fit:

${buildPrompt().split("Return ONLY valid JSON")[0]}

Return ONLY valid JSON (no markdown, no backticks) with this exact shape:
{
 "trendSource": "string, 1-2 sentences: what the viral moment is and where it's trending",
 "momentTag": "string, 2-4 word name for the viral moment (used as a commemorative ability name)",
 "characterName": "string",
 "tokenName": "string",
 "ticker": "string, 3-6 uppercase letters",
 "tagline": "string, one punchy sentence",
 "bio": "string, 2-3 sentences of character backstory tied to the moment",
 "originStory": ["panel 1", "panel 2", "panel 3", "panel 4"],
 "visualDescription": "string, detailed AI art prompt in ${artStyle} style",
 "socialBio": "string, short X bio",
 "firstTweet": "string, launch tweet",
 "telegramWelcome": "string, 2-3 sentence welcome"
}`;
      const res = await generateFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trendPrompt, useSearch: true, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || "Trending mode failed");
      const parsed = parseModelJSON(data);
      parsed._fromTrending = true;
      setTrendingInfo(parsed.trendSource || null);
      setResult(parsed);
      try {
        const nh = JSON.parse(localStorage.getItem("mascotgen-name-history") || "[]");
        if (parsed.characterName) localStorage.setItem("mascotgen-name-history", JSON.stringify([...nh, parsed.characterName].slice(-20)));
      } catch (e) {}
      // Remember this moment so future clicks are told to avoid it (keep last 10).
      try {
        const hist = JSON.parse(localStorage.getItem("mascotgen-trend-history") || "[]");
        if (parsed.momentTag) {
          localStorage.setItem("mascotgen-trend-history", JSON.stringify([...hist, parsed.momentTag].slice(-10)));
        }
      } catch {}
    } catch (e) {
      setError(`Trending mode failed: ${e.message || "unknown error"} — try again.`);
    } finally {
      setTrendingLoading(false);
    }
  };

  const generateArt = async (entry) => {
    setArtLoadingFor(entry.id);
    setArtError(null);
    setImgFailed(false);
    try {
      // Self-heal: older wallet-synced mascots have no visualDescription — build
      // one from their traits so Regenerate always works, then save it back.
      const artPrompt = entry.result.visualDescription || buildFallbackArtPrompt(entry);
      // STYLE LOCK: hard-enforce the chosen 2D style so images never drift
      // into photoreal / CGI territory.
      const styledPrompt = `${artPrompt} ${STYLE_SUFFIX[entry.traits?.artStyle] || STYLE_SUFFIX["Anime / Manga"]}`;
      const res = await fetch("/api/generate-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: styledPrompt,
          email,
          mascotId: entry.id,
          // Dev art bypass rides the same wallet signature as everything else
          // — harmless no-ops for normal users, proof of identity for devs.
          wallet: walletAddress || undefined,
          auth: (await getWalletAuth()) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Art generation failed");
      const next = collection.map((c) =>
        c.id === entry.id
          ? { ...c, artUrl: data.imageUrl, artHistory: [...new Set([...(c.artHistory || []), c.artUrl, data.imageUrl].filter(Boolean))], result: { ...c.result, visualDescription: c.result.visualDescription || artPrompt } }
          : c
      );
      persistCollection(next);
      if (studioEntry && studioEntry.id === entry.id)
        setStudioEntry((s) => ({ ...s, artUrl: data.imageUrl, artHistory: [...new Set([...(s.artHistory || []), s.artUrl, data.imageUrl].filter(Boolean))], result: { ...s.result, visualDescription: s.result.visualDescription || artPrompt } }));
      if (data.regenLimit !== undefined) setRegenInfo(`${data.regensUsed}/${data.regenLimit} image generations used`);
    } catch (e) {
      setArtError(e.message || "Art generation failed — try again.");
    } finally {
      setArtLoadingFor(null);
    }
  };

  // 📱 THE WALLET-BROWSER PROBLEM. On a phone with no injected wallet, tapping
  // "connect" bounces the user into Phantom/Solflare's OWN browser — a fresh
  // profile with empty localStorage, where the mascot they just made doesn't
  // exist. So before sending anyone there, we park the FULL entry server-side
  // under a random r_ id and deep-link the wallet browser to /?resume=<id>,
  // which restores it on arrival. Same table the share pages use — no new
  // function, no new SQL.
  const isMobileNoWallet =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "") &&
    !(typeof window !== "undefined" && (window.solana || window.solflare || (window.phantom && window.phantom.solana) || window.backpack));

  const handoffToWallet = async (entry, which) => {
    if (!entry) return;
    try {
      setHandoffMsg("Packing your mascot for the trip…");
      const rid = `r_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      const r = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume-save", id: rid, entry }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setHandoffMsg(d.error || "Couldn't hand off — try again."); return; }
      const target = `${window.location.origin}/?resume=${rid}`;
      const deep = which === "phantom"
        ? `https://phantom.app/ul/browse/${encodeURIComponent(target)}?ref=${encodeURIComponent(window.location.origin)}`
        : `https://solflare.com/ul/v1/browse/${encodeURIComponent(target)}?ref=${encodeURIComponent(window.location.origin)}`;
      setHandoffMsg("Opening your wallet app…");
      window.location.href = deep;
    } catch (e) {
      setHandoffMsg("Couldn't hand off — check your connection and try again.");
    }
  };

  // forcedPending: a server-granted pending mint (⚜️ the champion claim) —
  // skips the pack roll AND the allowance; the grant itself is the ticket.
  const mintNFT = async (entry, forcedPending = null) => {
    if (!connected || !publicKey) {
      setMintError("Connect your wallet first (top-right).");
      return;
    }
    if (!entry.artUrl) {
      setMintError("Generate art for this character before minting.");
      return;
    }

    setMinting(true);
    setMintError(null);
    setMintResult(null);
    setMintStatus(forcedPending ? "Preparing your granted card..." : "Opening pack — rolling your card...");

    const ownerWallet = publicKey.toBase58();

    try {
      // The mascot's element is deterministic from its traits — resolve it now
      // so the server can roll the birth universe alongside the rarity tier.
      const preStats = computeStats(entry.traits);
      const mascotElement = preStats.element ? preStats.element.id : null;

      let pendingMint;
      if (forcedPending) {
        pendingMint = forcedPending;
      } else {
        const openRes = await fetch("/api/open-pack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // 🎬 STUDIO RESERVE: append ?studio=demon (or champion_s1 /
          // champion_s2 / archangel / deep7) to the URL and this mint pulls
          // from that age's reserved block instead of rolling. Ignored for
          // everyone else — the server gates it on DEV_WALLETS, which the
          // browser cannot forge because minting signs with the wallet.
          body: JSON.stringify({
            ownerWallet,
            email,
            element: mascotElement,
            ageCard: new URLSearchParams(window.location.search).get("studio") || undefined,
          }),
        });
        const openJson = await openRes.json();
        if (!openRes.ok || !openJson.card) {
          throw new Error(openJson.error || "Couldn't open a pack — try again.");
        }
        pendingMint = openJson.card;
      }
      const legendarySeason = pendingMint.season || null; // set only for Legendary pulls
      const birthUniverse = pendingMint.universe || null;  // Pentaverse stamp
      const godNumber = pendingMint.godNumber || null;     // set only for Super Legendary
      const markedBy = pendingMint.markedBy || null;       // ✋ God-Marked: which throne touched them (1-12)
      const markNumber = pendingMint.markNumber || null;   // their seat in the 777
      const ageCard = pendingMint.ageCard || null;         // ⏳ age overlay (champion/demon/archangel)
      const ageNumber = pendingMint.ageNumber || null;     // number within the age supply

      const res = await mintCharacterNFT({
        entry,
        pendingMint,
        wallet,
        rpcEndpoint: connection.rpcEndpoint,
        onProgress: (msg) => setMintStatus(msg),
      });

      // Resolve this mascot's element so we can persist it with the mint.
      const mintedStats = computeStats(entry.traits, res.tier, pendingMint.markedBy || null, ageCard, ageNumber);
      const mintedElement = mintedStats.element ? mintedStats.element.id : null;

      // Persist the mint (address + tier + element + season) to the saved collection.
      const next = collection.map((c) =>
        c.id === entry.id ? { ...c, mintAddress: res.mintAddress, mintTier: res.tier, mintElement: mintedElement, mintSeason: legendarySeason, mintUniverse: birthUniverse, markedBy, markNumber, ageCard, ageNumber, mintedArtUrl: c.artUrl } : c
      );
      persistCollection(next);
      if (studioEntry && studioEntry.id === entry.id) {
        setStudioEntry({ ...studioEntry, mintAddress: res.mintAddress, mintTier: res.tier, mintElement: mintedElement, mintSeason: legendarySeason, mintUniverse: birthUniverse, markedBy, markNumber, ageCard, ageNumber });
      }
      if (forcedPending) setChampStatus((s) => (s ? { ...s, minted: true, pending: null } : s));

      try {
        await fetch("/api/record-mint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mintAddress: res.mintAddress,
            characterName: entry.result.characterName,
            tokenName: entry.result.tokenName,
            ticker: entry.result.ticker,
            ownerWallet,
            traits: entry.traits,
            tier: res.tier,
            rarity: res.tier,
            element: mintedElement,
            legendarySeason: legendarySeason,
            universe: birthUniverse,
            godNumber: godNumber,
            markedBy: markedBy,
            markNumber: markNumber,
            ageCard: ageCard,
            ageNumber: ageNumber,
            imageUrl: entry.artUrl,
            resultData: entry.result,
          }),
        });
      } catch (e) {
        console.warn("record-mint failed (non-fatal):", e);
      }

      setMintResult({ ...res, season: legendarySeason, universe: birthUniverse, godNumber, markedBy, markNumber, ageCard, ageNumber });
      setMintStatus(null);
    } catch (e) {
      setMintError(e.message || "Mint failed — try again.");
      setMintStatus(null);
    } finally {
      setMinting(false);
    }
  };

  const currentTraits = () => ({
    gender,
    skinTone,
    archetypes: gate(cappedArchetypes),
    vibes: gate(cappedVibes),
    worlds: gate(cappedWorlds),
    colors: gate(cappedColors),
    accessories: gatedAura !== "None" ? [...gate(cappedAccessories), gatedAura] : gate(cappedAccessories),
    aura: gatedAura,
    artStyle,
    viralMoment: result && result._fromTrending ? (result.momentTag || "Viral Echo") : undefined,
  });

  const saveCurrent = () => {
    if (!result) return;
    const entry = {
      id: Date.now().toString(),
      result,
      traits: currentTraits(),
      savedAt: new Date().toISOString(),
      artUrl: null,
    };
    const next = [entry, ...collection];
    persistCollection(next);
    setSaveMsg("Saved to collection ✓");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const loadSaved = (entry) => {
    // Leaving a full-page studio (?studio= tab): clear that state and the URL
    // param so this actually lands in the builder instead of home.
    try { window.history.replaceState(null, "", window.location.pathname); } catch (e) {}
    setStudioPage(false);
    setStudioEntry(null);
    setResult(entry.result);
    const t = entry.traits || {};
    setGender(t.gender || "Male");
    setArchetypes(t.archetypes || []);
    setVibes(t.vibes || []);
    setWorlds(t.worlds || []);
    setColors(t.colors || []);
    setAccessories((t.accessories || []).filter((a) => a !== t.aura));
    setAura(t.aura || "None");
    setArtStyle(t.artStyle || "Anime / Manga");
    setShowCollection(false);
    setView("card");
    setTab("studio");
  };

  const deleteSaved = (id) => {
    persistCollection(collection.filter((c) => c.id !== id));
  };

  // Sets a character's story status: alive | purgatory | rest. The saga engine
  // injects this into every story prompt, so death, purgatory time, and returns
  // are written consistently. You control the narrative.
  const setEntryStatus = (entry, status) => {
    const next = collection.map((c) => (c.id === entry.id ? { ...c, status } : c));
    persistCollection(next);
    if (studioEntry && studioEntry.id === entry.id) setStudioEntry((s) => ({ ...s, status }));
  };

  // ---- ⚔️ The Battle Arena (Phase 1: Ghost Battles) ------------------------
  const [battleTeam, setBattleTeam] = useState([]);
  const [battleOpp, setBattleOpp] = useState("");
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleResult, setBattleResult] = useState(null);
  const [battleShown, setBattleShown] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);

  // ---- 🛡 THE LEGION — your whole collection, visible and flippable ---------
  const [legionFilter, setLegionFilter] = useState("all");
  const [legionSearch, setLegionSearch] = useState("");
  const [legionSort, setLegionSort] = useState("newest");

  // ---- 🏁 THE GRAND CIRCUIT --------------------------------------------------------
  const [raceTeam, setRaceTeam] = useState([]);
  const [raceOpp, setRaceOpp] = useState("");
  const [raceLoading, setRaceLoading] = useState(false);
  const [raceResult, setRaceResult] = useState(null);
  const [raceShown, setRaceShown] = useState(0);
  const [raceLb, setRaceLb] = useState([]);

  // ---- 🔗 Public mascot pages ----------------------------------------------
  const [publicMascot, setPublicMascot] = useState(null);
  const [publicError, setPublicError] = useState("");

  // 🏪 Market full-card view — tap any listing to see the whole battle card.
  const [marketCard, setMarketCard] = useState(null);

  // 📱 Wallet handoff — carrying a browser-only mascot into the wallet app's
  // in-app browser (which starts with EMPTY localStorage — see handoffToWallet).
  const [handoffMsg, setHandoffMsg] = useState(null);
  const [resumeMsg, setResumeMsg] = useState(null);

  // 🚀 Guided token link — the user pastes the pump.fun token THEY launched.
  const [tokenForm, setTokenForm] = useState({ open: false, address: "", telegram: "" });
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenMsg, setTokenMsg] = useState("");
  const linkToken = async (entry) => {
    if (!entry || !entry.mintAddress || !walletAddress) return;
    setTokenSaving(true);
    setTokenMsg("");
    try {
      const r = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "token-link",
          auth: await getWalletAuth(),
          wallet: walletAddress,
          mintAddress: entry.mintAddress,
          tokenAddress: tokenForm.address.trim(),
          tokenTelegram: tokenForm.telegram.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setTokenMsg(d.error || "Couldn't link the token."); setTokenSaving(false); return; }
      const patch = { tokenAddress: tokenForm.address.trim(), tokenTelegram: tokenForm.telegram.trim() || null };
      persistCollection(collection.map((c) => (c.id === entry.id ? { ...c, ...patch } : c)));
      setStudioEntry((s) => ({ ...s, ...patch }));
      setTokenForm({ open: false, address: "", telegram: "" });
      setTokenMsg("🚀 Token linked — your mascot page now has a live BUY button.");
    } catch (e) {
      setTokenMsg("Network hiccup — try again.");
    }
    setTokenSaving(false);
  };
  const [shareMsg, setShareMsg] = useState("");

  // Publishes a mascot's public page and copies the link. Works for ANY tier —
  // free included — because shared characters are the best ad the studio has.
  const shareMascot = async (entry) => {
    if (!entry || !entry.result) return;
    if (entry.mintGodNumber === 12) { setShareMsg("🔒 This one stays sealed."); return; }
    try {
      const stats = computeStats(
        { ...(entry.traits || {}), characterName: entry.result.characterName },
        entry.mintTier || null,
        entry.markedBy || null,
        entry.ageCard || null,
        entry.ageNumber || null,
        !!entry.mintAddress && !entry.mintUniverse   // ⏳ Elder
      );
      const id = entry.mintAddress || `s_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      const latest = [...(entry.expansions || [])].reverse().find((x) => (x.panels || []).length);
      const panels = (latest ? latest.panels : entry.result.originStory) || [];
      // Verify the save ACTUALLY persisted before handing out a link — the old
      // code copied the link regardless, so a rejected save = a dead link the
      // recipient hit as a blank home page.
      const saveRes = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "share-save",
          id,
          data: {
            name: entry.result.characterName,
            ticker: entry.result.ticker,
            tagline: entry.result.tagline,
            bio: entry.result.bio,
            image: entry.mintedArtUrl || entry.artUrl || null,
            tier: entry.mintTier || "Unminted",
            universe: entry.mintUniverse || null,
            element: entry.mintElement || null,
            stats: { power: stats.power, hp: stats.hp, speed: stats.speed, special: stats.special, battleHp: stats.hpPoints },
            panels: panels.slice(0, 4),
            mintAddress: entry.mintAddress || null,
            owner: entry.mintAddress && walletAddress ? walletAddress : null,
          },
        }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        setShareMsg(err.error || "Couldn't publish the page — try again.");
        return;
      }
      // 🐦 /s/ links go through the share-card function, so X and Discord
      // unfurl a real card. The ?v= chapter count changes as the saga grows,
      // which busts X's week-long per-URL card cache exactly when it should.
      const saveJson = await saveRes.json().catch(() => ({}));
      const link = `${window.location.origin}/s/${encodeURIComponent(id)}${saveJson.chapterCount ? `?v=${saveJson.chapterCount}` : ""}`;
      try { await navigator.clipboard.writeText(link); setShareMsg(`🔗 Link copied! ${link}`); }
      catch (e) { setShareMsg(`🔗 Your page: ${link}`); }
    } catch (e) {
      setShareMsg("Couldn't publish the page — try again.");
    }
  };

  // Visiting a share link opens the public profile — no landing gate, no login.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mid = params.get("m");
    if (!mid) return;
    setEntered(true);
    (async () => {
      try {
        const res = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mascot", id: mid }),
        });
        const data = await res.json();
        if (res.ok && data.mascot) setPublicMascot(data.mascot);
        // A missing/expired share used to fall silently through to the home
        // page — show the recipient a real "not found" instead of confusion.
        else setPublicError(data.error || "This mascot page couldn't be found.");
      } catch (e) {
        setPublicError("Couldn't load this mascot page — check your connection and try again.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 🏪 Market gallery ----------------------------------------------------
  const [gallery, setGallery] = useState(null);
  const [galleryError, setGalleryError] = useState("");
  const [marketFilter, setMarketFilter] = useState("All");
  const [marketSearch, setMarketSearch] = useState("");
  const loadGallery = async () => {
    setGalleryError("");
    try {
      const res = await fetch("/api/battle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "gallery" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load the market.");
      setGallery(data.items || []);
    } catch (e) {
      setGalleryError(e.message);
    }
  };
  useEffect(() => {
    if (tab === "market" && !gallery) loadGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ---- 📊 Ecosystem stats ---------------------------------------------------
  const [ecoStats, setEcoStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const loadStats = async () => {
    setStatsLoading(true);
    setStatsError("");
    try {
      const res = await fetch("/api/battle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ecosystem" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Stats request failed (${res.status})`);
      setEcoStats(data);
    } catch (e) {
      setStatsError(e.message || "Couldn't load stats — try again.");
    } finally {
      setStatsLoading(false);
    }
  };
  useEffect(() => {
    if (tab === "stats" && !ecoStats) loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const toggleBattlePick = (mint) => {
    setBattleTeam((t) => (t.includes(mint) ? t.filter((x) => x !== mint) : t.length >= 7 ? t : [...t, mint]));
  };

  const toggleRacePick = (mint) => {
    setRaceTeam((t) => (t.includes(mint) ? t.filter((x) => x !== mint) : t.length >= 3 ? t : [...t, mint]));
  };

  // The filtered, sorted roster the grid renders — and the same order the
  // ◀ ▶ arrows walk, so flipping through matches what you see.
  const TIER_RANK = { "Super Legendary": 5, Legendary: 4, Epic: 3, Rare: 2, Common: 1 };
  const legionList = collection
    .filter((c) => {
      if (legionFilter === "minted" && !c.mintAddress) return false;
      if (legionFilter === "unminted" && c.mintAddress) return false;
      if (legionFilter === "cars" && !((c.traits || {}).archetypes || []).includes("Sports Car")) return false;
      const q = legionSearch.trim().toLowerCase();
      if (!q) return true;
      const r = c.result || {};
      return [r.characterName, r.tokenName, r.ticker, c.mintUniverse, c.mintTier]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (legionSort === "rarity") return (TIER_RANK[b.mintTier] || 0) - (TIER_RANK[a.mintTier] || 0);
      if (legionSort === "name") return (a.result?.characterName || "").localeCompare(b.result?.characterName || "");
      return 0; // "newest" — collection is already newest-first
    });

  // Flip to the next/previous mascot without closing the studio.
  const legionStep = (dir) => {
    if (!studioEntry) return;
    const list = legionList.length ? legionList : collection;
    const i = list.findIndex((c) => c.id === studioEntry.id);
    if (i === -1) return;
    const next = list[(i + dir + list.length) % list.length];
    if (next) { setStudioEntry(next); setShowCard(false); }
  };

  const runRace = async () => {
    if (!connected || !walletAddress) return;
    if (raceTeam.length < 1) return;
    setRaceLoading(true);
    setRaceResult(null);
    setRaceShown(0);
    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "race",
          auth: await getWalletAuth(),
          challengerWallet: walletAddress,
          teamMints: raceTeam,
          opponentWallet: raceOpp.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Race failed");
      setRaceResult(data);
      loadRaceLeaderboard();
    } catch (e) {
      setRaceResult({ error: e.message || "Race failed — try again." });
    } finally {
      setRaceLoading(false);
    }
  };

  const loadRaceLeaderboard = async () => {
    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "race-leaderboard" }),
      });
      const data = await res.json();
      if (res.ok) setRaceLb(data.leaderboard || []);
    } catch (e) {}
  };

  const runBattle = async () => {
    if (!connected || !walletAddress) return;
    if (battleTeam.length < 1) return;
    setBattleLoading(true);
    setBattleResult(null);
    setBattleShown(0);
    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate",
          auth: await getWalletAuth(),
          challengerWallet: walletAddress,
          teamMints: battleTeam,
          opponentWallet: battleOpp.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Battle failed");
      setBattleResult(data);
      loadLeaderboard();
    } catch (e) {
      setBattleResult({ error: e.message || "Battle failed — try again." });
    } finally {
      setBattleLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leaderboard" }),
      });
      const data = await res.json();
      if (res.ok) setLeaderboard(data.leaderboard || []);
    } catch (e) {}
  };

  // Replay reveal: battle log lines appear one by one like a live fight.
  useEffect(() => {
    if (!battleResult || !battleResult.log) return;
    if (battleShown >= battleResult.log.length) return;
    const t = setTimeout(() => setBattleShown((s) => s + 1), battleShown < 2 ? 400 : 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleResult, battleShown]);

  useEffect(() => {
    if (tab === "battle") loadLeaderboard();
    if (tab === "race") loadRaceLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Race playback: events reveal one by one — tick events pace the broadcast
  // (cars glide between snapshots), dramatic events land quickly on top.
  useEffect(() => {
    if (!raceResult || !raceResult.events) return;
    if (raceShown >= raceResult.events.length) return;
    const e = raceResult.events[raceShown];
    const wait = !e ? 500 : e.t === "tick" ? 950 : e.t === "grid" || e.t === "start" ? 700 : 420;
    const t = setTimeout(() => setRaceShown((x) => x + 1), wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceResult, raceShown]);

  // ---- Wallet Sync ----------------------------------------------------------
  // Scans the connected wallet's token accounts for NFTs (amount 1, 0 decimals),
  // asks the backend which of them are MascotGen mascots, and merges every match
  // into the local collection — including mascots this wallet BOUGHT or was
  // traded and never minted itself. Ownership = holding the NFT.
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [crossoverPicks, setCrossoverPicks] = useState([]);
  const [crossoverLoading, setCrossoverLoading] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [studioPage, setStudioPage] = useState(false); // full-tab Studio mode
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // { type:"panel"|"chapter", ci, pi }
  // Holds fal's ACTUAL failure text so silent polling can't swallow it.
  const [repairing, setRepairing] = useState(false);
  const [repairMsg, setRepairMsg] = useState("");

  // 🔧 One-time NFT link repair (dev only): fixes every minted NFT whose
  // images vanished because their URIs point at arweave.net instead of the
  // Irys gateway. One wallet approval per NFT; safe to re-run (already-fixed
  // NFTs just get a fresh, working metadata upload).
  const DEV_REPAIR_WALLET = "36G2D1Scu9YQJskSmMw5uoUsKxpsd6GYYncADnvSwUmD";
  // 💰 One-time backfill: put the 5% creator royalty on every NFT minted
  // before royalties were turned on. One wallet approval each; already-set
  // NFTs are skipped, so it's safe to re-run after an interruption.
  const setRoyaltyAll = async () => {
    const minted = collection.filter((c) => c.mintAddress);
    if (!minted.length || repairing) return;
    setRepairing(true);
    let done = 0, skipped = 0, failed = 0;
    for (const c of minted) {
      try {
        setRepairMsg(`💰 ${done + skipped + failed + 1}/${minted.length} — ${c.result.characterName}...`);
        const r = await setRoyalty({
          mintAddress: c.mintAddress,
          wallet,
          rpcEndpoint: connection.rpcEndpoint,
          onProgress: (m) => setRepairMsg(`💰 ${done + skipped + failed + 1}/${minted.length} — ${c.result.characterName}: ${m}`),
        });
        if (r && r.skipped) skipped++; else done++;
      } catch (e) {
        console.warn("royalty failed:", c.result.characterName, e);
        failed++;
      }
    }
    setRepairMsg(`💰 Royalty pass complete — ${done} updated, ${skipped} already set${failed ? `, ${failed} failed (see console)` : ""}.`);
    setRepairing(false);
  };

  // 🏛 One-time: mint the MascotGen collection NFT, then paste the address
  // into COLLECTION_ADDRESS in mint.js and redeploy.
  const createCollection = async () => {
    if (repairing) return;
    setRepairing(true);
    try {
      const r = await createMascotGenCollection({
        wallet,
        rpcEndpoint: connection.rpcEndpoint,
        onProgress: (m) => setRepairMsg(`🏛 ${m}`),
      });
      setRepairMsg(`🏛 COLLECTION CREATED: ${r.collectionAddress} — copy this address into COLLECTION_ADDRESS in src/mint.js, redeploy, then run JOIN COLLECTION.`);
    } catch (e) {
      setRepairMsg(`🏛 ${e.message}`);
    } finally {
      setRepairing(false);
    }
  };

  // ---- 🔥 THE BURN ---------------------------------------------------------
  // The only irreversible action in the whole app, so the UI treats it that
  // way: it is hidden behind a long-press-style two-step, and the second step
  // makes you type the character's name. No amount of accidental tapping can
  // destroy an asset — you have to mean it, twice, and be able to spell it.
  const [burnTarget, setBurnTarget] = useState(null);   // the entry being burned
  const [burnConfirm, setBurnConfirm] = useState("");   // typed name
  const [burning, setBurning] = useState(false);
  const [burnMsg, setBurnMsg] = useState("");

  const doBurn = async () => {
    if (!burnTarget || burning) return;
    const name = burnTarget.result?.characterName || "";
    if (burnConfirm.trim().toLowerCase() !== name.trim().toLowerCase()) {
      setBurnMsg("The name doesn't match. Type it exactly as it appears on the card.");
      return;
    }
    setBurning(true);
    setBurnMsg("");
    try {
      await burnMascotNFT({
        mintAddress: burnTarget.mintAddress,
        wallet,
        rpcEndpoint: connection.rpcEndpoint,
        onProgress: (m) => setBurnMsg(m),
      });
      // The NFT is gone from the chain; clear the mint fields locally so the
      // card stops claiming to be minted. The written canon STAYS — a burned
      // character's story is still part of the world. That's the whole point.
      setCollection((list) =>
        list.map((c) =>
          c.id === burnTarget.id
            ? { ...c, mintAddress: null, mintTier: null, mintUniverse: null, mintSeason: null, ageCard: null, ageNumber: null, burned: true, burnedAt: new Date().toISOString() }
            : c
        )
      );
      setBurnMsg(`🔥 ${name} is gone. Permanently, and on the record.`);
      setTimeout(() => { setBurnTarget(null); setBurnConfirm(""); setBurnMsg(""); }, 2600);
    } catch (e) {
      setBurnMsg(e.message || "The burn failed — nothing was destroyed.");
    }
    setBurning(false);
  };

  // ✅ Backfill: joins every minted mascot to the collection and verifies it.
  const joinCollectionAll = async () => {
    const minted = collection.filter((c) => c.mintAddress);
    if (!minted.length || repairing) return;
    setRepairing(true);
    let done = 0, skipped = 0, failed = 0;
    for (const c of minted) {
      try {
        setRepairMsg(`✅ ${done + skipped + failed + 1}/${minted.length} — ${c.result.characterName}...`);
        const r = await joinCollection({
          mintAddress: c.mintAddress,
          wallet,
          rpcEndpoint: connection.rpcEndpoint,
          onProgress: (m) => setRepairMsg(`✅ ${done + skipped + failed + 1}/${minted.length} — ${c.result.characterName}: ${m}`),
        });
        if (r && r.skipped) skipped++; else done++;
      } catch (e) {
        console.warn("join failed:", c.result.characterName, e);
        failed++;
      }
    }
    setRepairMsg(`✅ Collection pass complete — ${done} joined, ${skipped} already verified${failed ? `, ${failed} failed (see console)` : ""}.`);
    setRepairing(false);
  };

  const repairAllNfts = async () => {
    const minted = collection.filter((c) => c.mintAddress);
    if (!minted.length || repairing) return;
    setRepairing(true);
    let fixed = 0, failed = 0;
    for (const c of minted) {
      try {
        setRepairMsg(`🔧 ${fixed + failed + 1}/${minted.length} — repairing ${c.result.characterName}...`);
        await repairNftUri({
          mintAddress: c.mintAddress,
          entry: c,
          wallet,
          rpcEndpoint: connection.rpcEndpoint,
          onProgress: (m) => setRepairMsg(`🔧 ${fixed + failed + 1}/${minted.length} — ${c.result.characterName}: ${m}`),
        });
        fixed++;
      } catch (e) {
        console.warn("repair failed:", c.result.characterName, e);
        failed++;
      }
    }
    setRepairMsg(`🔧 Repair complete — ${fixed} fixed${failed ? `, ${failed} failed (see console)` : ""}. Explorers can take a few minutes to refresh.`);
    setRepairing(false);
  };
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");

  // 📓 WRITER'S BIBLE — debounced save to the server so the bible follows the
  // mascot to every device. Local storage still holds it for instant reads and
  // for unminted drafts (which have no mint address to key on).
  const bibleTimer = useRef(null);
  const [bibleSaved, setBibleSaved] = useState("");
  const saveBibleRemote = (entry, notes) => {
    if (!entry || !entry.mintAddress) return; // drafts stay local-only
    clearTimeout(bibleTimer.current);
    bibleTimer.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "bible-save",
            auth: await getWalletAuth(),
            mintAddress: entry.mintAddress,
            notes,
            ownerWallet: publicKey ? publicKey.toString() : undefined,
          }),
        });
        setBibleSaved(r.ok ? "saved to your account ✓" : "saved on this device only");
      } catch (e) {
        setBibleSaved("saved on this device only");
      }
      setTimeout(() => setBibleSaved(""), 2500);
    }, 1200);
  };

  // ---- 👤 THE AUTHOR NAME ---------------------------------------------------
  // One wallet, one name. The name is what the public saga pages are keyed to,
  // so it is claimed once and shown everywhere the wallet publishes.
  const NAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
  const [profile, setProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameCheck, setNameCheck] = useState(null); // null|"invalid"|"checking"|"free"|"taken"
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [avatarMint, setAvatarMint] = useState(null);
  const nameTimer = useRef(null);

  // Load the profile whenever a wallet connects (and clear it on disconnect).
  useEffect(() => {
    if (!connected || !walletAddress) {
      setProfile(null);
      setAvatarMint(null);
      return;
    }
    let dead = false;
    (async () => {
      try {
        const r = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "profile-get", wallet: walletAddress }),
        });
        const d = await r.json();
        if (dead || !r.ok) return;
        setProfile(d.profile || null);
        setAvatarMint((d.profile && d.profile.avatar_mint) || null);
      } catch (e) {}
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, walletAddress]);

  // Live availability check — debounced so we don't hammer the endpoint while
  // someone types. Local regex first: an invalid name never hits the network.
  useEffect(() => {
    const n = nameInput.trim();
    clearTimeout(nameTimer.current);
    if (!n) { setNameCheck(null); return; }
    if (!NAME_RE.test(n)) { setNameCheck("invalid"); return; }
    if (profile && profile.username && profile.username.toLowerCase() === n.toLowerCase()) {
      setNameCheck("free"); // your own current name
      return;
    }
    setNameCheck("checking");
    nameTimer.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "profile-get", username: n }),
        });
        const d = await r.json();
        setNameCheck(r.ok && d.profile ? "taken" : "free");
      } catch (e) {
        setNameCheck(null); // network wobble — let the server be the judge
      }
    }, 450);
    return () => clearTimeout(nameTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameInput, profile]);

  const claimUsername = async () => {
    if (!connected || !walletAddress) { setProfileError("Connect your wallet first."); return; }
    const name = nameInput.trim();
    if (!NAME_RE.test(name)) { setProfileError("3–20 characters: letters, numbers and underscores."); return; }
    setProfileSaving(true);
    setProfileError("");
    try {
      const r = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "profile-claim",
          auth: await getWalletAuth(),
          wallet: walletAddress,
          username: name,
          avatarMint: avatarMint || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setProfileError(d.error || "Couldn't claim that name.");
        setProfileSaving(false);
        return;
      }
      setProfile({ wallet: walletAddress, username: d.username, avatar_mint: avatarMint || null });
      setProfileOpen(false);
    } catch (e) {
      setProfileError("Network hiccup — try again.");
    }
    setProfileSaving(false);
  };

  // ---- 📖 PUBLISHING --------------------------------------------------------
  // Chapters live in the collection whether or not they're published. Publishing
  // copies a chapter to published_chapters, where the public author page reads
  // it. Unpublishing removes the copy — the canon in the Studio is untouched.
  const [published, setPublished] = useState([]);
  const [publishing, setPublishing] = useState(null); // chapter index in flight
  const [publishMsg, setPublishMsg] = useState("");

  const loadPublished = async () => {
    if (!walletAddress) { setPublished([]); return; }
    try {
      const r = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chapters-by-author", wallet: walletAddress, limit: 100 }),
      });
      const d = await r.json();
      if (r.ok) setPublished(d.chapters || []);
    } catch (e) {}
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPublished(); }, [walletAddress]);

  // A chapter is live if a published row matches this mascot AND this title.
  // Title is the join key because expansions have no stable id of their own.
  // 📖 A mascot's origin story, presented as a publishable chapter so it can
  // take its rightful place as Chapter 1 of that character's book.
  const originChapter = (entry) => {
    const panels = (entry && entry.result && entry.result.originStory) || [];
    if (!panels.length) return null;
    return { __origin: true, title: `${entry.result.characterName}: Origin`, panels };
  };

  const publishedRow = (entry, exp) => {
    if (!entry || !entry.mintAddress) return null;
    const t = String((exp && exp.title) || "").trim().toLowerCase();
    return published.find(
      (c) => c.mint_address === entry.mintAddress && String(c.title || "").trim().toLowerCase() === t
    ) || null;
  };

  const flashPublish = (m) => { setPublishMsg(m); setTimeout(() => setPublishMsg(""), 4000); };

  // `busyKey` only drives the spinner — it may be a number (Studio) or a
  // string (the Library's bulk list). The chapter NUMBER is always derived
  // from the chapter's real position in the mascot's own expansions.
  // exp may be a real expansion OR the synthetic origin-story chapter built by
  // originChapter() below. `i` is the expansion index; origin ignores it.
  const publishChapter = async (entry, exp, busyKey) => {
    const isOrigin = !!(exp && exp.__origin);
    const i = (entry.expansions || []).indexOf(exp);
    if (!connected || !walletAddress) return flashPublish("Connect your wallet to publish.");
    if (!entry.mintAddress) return flashPublish("Only minted mascots can publish — mint this one first.");
    if (!profile || !profile.username) {
      setNameInput("");
      setProfileError("");
      setProfileOpen(true);
      return flashPublish("Claim your author name first — it's the byline.");
    }
    const panels = (exp.panels || []).map((p) => String(p || "").trim()).filter(Boolean);
    if (!panels.length) return flashPublish("This chapter has no panels yet.");

    // 📖 SAGA MODE. When the saga bar is set, every publish joins that ONE book
    // — arc_name = the saga, chapter_no = the running part number — so chapters
    // from DIFFERENT characters read as a single ordered story. When it's off,
    // a chapter stays its own character's solo book, numbered per-character.
    const inSaga = !!sagaName.trim();
    const arcName = inSaga ? sagaName.trim().slice(0, 40) : entry.result.characterName;
    const chapterNo = inSaga
      ? Number(sagaNextPart) || 1
      // READING ORDER: the 4-panel origin is a mascot's Chapter 1 (it never had
      // a publish button before, so sagas started at instalment two); expansions
      // follow at 2, 3, 4…
      : (isOrigin ? 1 : i + 2);

    setPublishing(busyKey);
    setPublishMsg("");
    try {
      const r = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chapter-publish",
          auth: await getWalletAuth(),
          wallet: walletAddress,
          mintAddress: entry.mintAddress,
          title: exp.title || (isOrigin ? "Origin" : `Chapter ${i + 2}`),
          panels,
          arcName,
          chapterNo,
        }),
      });
      const d = await r.json();
      if (!r.ok) flashPublish(d.error || "Publish failed.");
      else {
        await loadPublished();
        if (inSaga) {
          // Tick the part counter so the next publish lands as the next page.
          setSagaNextPart((n) => (Number(n) || 1) + 1);
          flashPublish(`📖 Published as ${arcName} · Part ${chapterNo}. Next part → ${chapterNo + 1}.`);
        } else {
          flashPublish(`📖 Live on @${profile.username}'s page.`);
        }
      }
    } catch (e) {
      flashPublish("Network hiccup — try again.");
    }
    setPublishing(null);
  };

  // ---- 📖 THE LIBRARY + AUTHOR PAGES ---------------------------------------
  // The read side of publishing. The Library tab is the public feed of recent
  // chapters; clicking any card opens the author's page (/?a=username), which
  // anyone can reach with just the link — no wallet, no login, no gate.
  const [authorView, setAuthorView] = useState(null); // { author, chapters }
  const [authorLoading, setAuthorLoading] = useState(false);
  const [authorError, setAuthorError] = useState("");
  const [libRows, setLibRows] = useState(null);
  // Renders the broadcast composer. Cosmetic only — api/battle.js re-checks the
  // wallet against DEV_WALLETS and rejects anyone else, signature and all.
  const isStudioWallet = !!walletAddress && STUDIO_WALLETS.includes(walletAddress);
  // 📖 SAGA MODE — set a book name + a starting part number, then publish
  // chapters from any character in order and they join that one book. Blank =
  // every chapter stays its own character's solo story (the default).
  // ✨ The strip shows until dismissed. The dismissal stores the newest DATE
  // seen, so adding an entry re-opens it for everyone automatically while
  // re-reading an old one never does.
  const freshNews = WHATS_NEW.filter((n) => (Date.now() - Date.parse(n.d)) / 86400000 <= NEW_MAX_AGE_DAYS);
  const newestNews = freshNews.reduce((m, n) => (n.d > m ? n.d : m), "");
  const [newsSeen, setNewsSeen] = useState(() => {
    try { return localStorage.getItem("mgWhatsNew") || ""; } catch (e) { return ""; }
  });
  const [newOpen, setNewOpen] = useState(false);
  const hasNew = !!newestNews && newsSeen < newestNews;
  const dismissNew = () => {
    setNewsSeen(newestNews); setNewOpen(false);
    try { localStorage.setItem("mgWhatsNew", newestNews); } catch (e) {}
  };

  // ---- 🛡 CLANS ------------------------------------------------------------
  const [myClan, setMyClan] = useState(null);      // { clan, role, roster }
  const [clanLadder, setClanLadder] = useState([]);
  const [clanBusy, setClanBusy] = useState(false);
  const [clanMsg, setClanMsg] = useState("");
  const [clanForm, setClanForm] = useState({ open: false, name: "", tag: "", motto: "" });
  const [warResult, setWarResult] = useState(null);   // ⚔️ the last war fought

  const declareWar = async (targetClanId, targetName) => {
    setClanBusy(true); setClanMsg(""); setWarResult(null);
    try {
      const { ok, d } = await clanApi("clan-war-declare", {
        auth: await getWalletAuth(), wallet: walletAddress, targetClanId,
      });
      if (!ok) setClanMsg(d.error || "The war didn't start.");
      else { setWarResult(d); await loadClans(); }
    } catch (e) { setClanMsg("Network hiccup — try again."); }
    setClanBusy(false);
  };

  const clanApi = async (action, body) => {
    const r = await fetch("/api/battle", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    return { ok: r.ok, d: await r.json() };
  };
  const loadClans = async () => {
    try {
      const l = await clanApi("clan-ladder", {});
      if (l.ok) setClanLadder(l.d.clans || []);
      if (walletAddress) {
        const m = await clanApi("clan-mine", { wallet: walletAddress });
        if (m.ok) setMyClan(m.d.clan ? m.d : null);
      } else setMyClan(null);
    } catch (e) {}
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === "legion") loadClans(); }, [tab, walletAddress]);

  const clanAct = async (action, body, okMsg) => {
    setClanBusy(true); setClanMsg("");
    try {
      const { ok, d } = await clanApi(action, { auth: await getWalletAuth(), wallet: walletAddress, ...body });
      if (!ok) setClanMsg(d.error || "That didn't work.");
      else { setClanMsg(okMsg); setClanForm({ open: false, name: "", tag: "", motto: "" }); await loadClans(); }
    } catch (e) { setClanMsg("Network hiccup — try again."); }
    setClanBusy(false);
  };

  const [sagaName, setSagaName] = useState("");
  const [sagaNextPart, setSagaNextPart] = useState(1);
  // 📡 VERSE NEWS — the official broadcast. Public to read; only the studio
  // wallet can post, and that check happens on the server.
  const [news, setNews] = useState([]);
  const [newsBusy, setNewsBusy] = useState(false);
  const [newsMsg, setNewsMsg] = useState("");
  const [newsTitle, setNewsTitle] = useState("");
  const [newsBody, setNewsBody] = useState("");
  const [newsKind, setNewsKind] = useState("canon");
  const [newsPinned, setNewsPinned] = useState(false);
  const [newsComposer, setNewsComposer] = useState(false);
  const [libLoading, setLibLoading] = useState(false);
  const [libError, setLibError] = useState("");
  const [libSearch, setLibSearch] = useState("");

  const openAuthor = async (name, push = true) => {
    if (!name) return;
    setAuthorLoading(true);
    setAuthorError("");
    if (push) {
      try { window.history.pushState(null, "", `?a=${encodeURIComponent(name)}`); } catch (e) {}
    }
    try {
      const r = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "author-page", username: name }),
      });
      const d = await r.json();
      if (!r.ok) { setAuthorError(d.error || "Couldn't load that author."); setAuthorView(null); }
      else setAuthorView(d);
    } catch (e) {
      setAuthorError("Couldn't load that author — try again.");
      setAuthorView(null);
    }
    setAuthorLoading(false);
  };

  const closeAuthor = () => {
    try { window.history.replaceState(null, "", window.location.pathname); } catch (e) {}
    setAuthorView(null);
    setAuthorError("");
  };

  // 🥊 MANUAL PVP (BETA) — turn-by-turn 1v1, unrated while in beta so it can't
  // farm the ladders the Champion cut reads. Polls the match every 5s while a
  // match view is open.
  const [pvpView, setPvpView] = useState(null);      // the open match object
  const [pvpLists, setPvpLists] = useState({ mine: [], open: [], recent: [] });
  const [pvpMint, setPvpMint] = useState("");        // my chosen fighter's mint
  const [pvpOpp, setPvpOpp] = useState("");          // optional targeted wallet
  const [pvpBusy, setPvpBusy] = useState(false);
  const [pvpMsg, setPvpMsg] = useState("");

  const pvpCall = async (body) => {
    const r = await fetch("/api/battle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "PvP call failed.");
    return d;
  };

  const pvpRefreshLists = async () => {
    if (!walletAddress) return;
    try {
      const d = await pvpCall({ action: "pvp-list", wallet: walletAddress });
      setPvpLists(d);
    } catch (e) {}
  };
  useEffect(() => {
    if (tab === "battle" && connected) pvpRefreshLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, connected, walletAddress]);

  // Poll while a match is live OR while an open challenge waits for a taker —
  // the challenger needs to see the moment someone accepts.
  useEffect(() => {
    if (!pvpView || (pvpView.status !== "active" && pvpView.status !== "open")) return;
    const t = setInterval(async () => {
      try {
        const d = await pvpCall({ action: "pvp-state", matchId: pvpView.id });
        setPvpView(d.match);
      } catch (e) {}
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pvpView && pvpView.id, pvpView && pvpView.status, pvpView && pvpView.turn]);

  const pvpAct = async (body, okMsg) => {
    setPvpBusy(true);
    setPvpMsg("");
    try {
      const d = await pvpCall({ ...body, auth: await getWalletAuth() });
      // An "open" challenge has no fighters yet — stay in the lobby and let it
      // appear under "Your matches" instead of entering an empty match view.
      if (d.match && (d.match.status === "active" || d.match.status === "done")) {
        setPvpView(d.match);
      } else {
        setPvpView(null);
      }
      if (okMsg) setPvpMsg(okMsg);
      await pvpRefreshLists();
    } catch (e) {
      setPvpMsg(e.message);
    }
    setPvpBusy(false);
  };

  // ⚜️ THE CHAMPION CLAIM — if this wallet is in a champion snapshot, a banner
  // appears and the whole claim is self-serve: no support ticket, no manual
  // mint from the house, no deadline panic.
  const [champStatus, setChampStatus] = useState(null);
  const [champClaiming, setChampClaiming] = useState(false);
  useEffect(() => {
    if (!connected || !walletAddress) { setChampStatus(null); return; }
    let dead = false;
    (async () => {
      try {
        const r = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "champion-status", wallet: walletAddress }),
        });
        const d = await r.json();
        if (!dead && r.ok) setChampStatus(d.champion || null);
      } catch (e) {}
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, walletAddress]);

  const claimChampion = async () => {
    if (!walletAddress || champClaiming) return;
    setChampClaiming(true);
    try {
      const r = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "champion-claim", auth: await getWalletAuth(), wallet: walletAddress }),
      });
      const d = await r.json();
      if (r.ok && d.pending) {
        setChampStatus((s) => (s ? { ...s, pending: d.pending } : s));
        setTab("legion");
      }
    } catch (e) {}
    setChampClaiming(false);
  };

  // 🔗 CHAPTER PERMALINKS — /?c=<id>. One chapter is the unit people share;
  // an author page is the unit they browse. Both are public and gateless.
  const [chapterView, setChapterView] = useState(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  // 📖 Open a saga at its beginning. chapter-get already returns every chapter
  // of that mascot ordered by chapter number, so we open whatever we were given
  // and immediately hop to the lowest-numbered sibling. One extra call, and it
  // means a reader who lands on chapter 6 from a shared link is never stranded.
  const openSagaFromStart = async (mintAddress) => {
    if (!mintAddress) return;
    const row = published.find((p) => p.mint_address === mintAddress && (p.chapter_no || 99) === 1)
      || (libRows || []).find((p) => p.mintAddress === mintAddress && (p.chapterNo || 99) === 1);
    if (row) return openChapter(row.id);
    // Not in the loaded page — ask the server via any known chapter of this
    // mascot and follow its sibling list to number one.
    const any = (libRows || []).find((p) => p.mintAddress === mintAddress);
    if (!any) return;
    try {
      const r = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chapter-get", id: any.id }),
      });
      const d = await r.json();
      const first = (d.siblings || []).slice().sort((a, b) => (a.chapterNo || 99) - (b.chapterNo || 99))[0];
      if (first) return openChapter(first.id);
    } catch (e) {}
    openChapter(any.id);
  };

  const openChapter = async (id, push = true) => {
    if (!id) return;
    setChapterLoading(true);
    setChapterError("");
    setAuthorView(null);
    if (push) {
      try { window.history.pushState(null, "", `?c=${encodeURIComponent(id)}`); } catch (e) {}
    }
    window.scrollTo(0, 0);
    try {
      const r = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chapter-get", id }),
      });
      const d = await r.json();
      if (!r.ok) { setChapterError(d.error || "Couldn't load that chapter."); setChapterView(null); }
      else setChapterView(d);
    } catch (e) {
      setChapterError("Couldn't load that chapter — try again.");
      setChapterView(null);
    }
    setChapterLoading(false);
  };

  const closeChapter = () => {
    try { window.history.replaceState(null, "", window.location.pathname); } catch (e) {}
    setChapterView(null);
    setChapterError("");
  };

  const copyLink = async (url, label) => {
    try { await navigator.clipboard.writeText(url); setCopyMsg(`🔗 ${label} link copied!`); }
    catch (e) { setCopyMsg(`🔗 ${url}`); }
    setTimeout(() => setCopyMsg(""), 3500);
  };

  // Visiting /?c=<id> opens a single chapter directly.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("c");
    if (!cid) return;
    setEntered(true);
    openChapter(cid, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 📱 RESUME HANDOFF — /?resume=<id>. The wallet app's in-app browser starts
  // with EMPTY localStorage, so the mascot the user just made is invisible
  // there. This pulls the parked entry down from the server, merges it into
  // the local collection, and lands the user on the studio one tap from mint.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get("resume");
    if (!rid) return;
    setEntered(true);
    (async () => {
      try {
        const res = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mascot", id: rid }),
        });
        const data = await res.json();
        const entry = res.ok && data.mascot && data.mascot.__resume ? data.mascot.entry : null;
        if (!entry || !entry.id) {
          setResumeMsg("Couldn't restore your mascot — go back to your other browser and tap the wallet button again.");
          return;
        }
        // Merge by id so re-opening the link never duplicates the mascot.
        let saved = [];
        try { saved = JSON.parse(localStorage.getItem("mascotgen-collection") || "[]"); } catch (e) {}
        const next = saved.some((c) => c.id === entry.id)
          ? saved.map((c) => (c.id === entry.id ? entry : c))
          : [...saved, entry];
        persistCollection(next);
        setStudioEntry(entry);
        setTab("studio");
        setResumeMsg(`✅ ${(entry.result && entry.result.characterName) || "Your mascot"} made the trip — connect your wallet (top-right) and hit MINT.`);
        try { window.history.replaceState({}, "", window.location.pathname); } catch (e) {}
      } catch (e) {
        setResumeMsg("Couldn't restore your mascot — check your connection and reopen the link.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Visiting /?a=username opens the author page directly — same pattern as the
  // /?m= mascot share links: no landing gate, no login.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const a = params.get("a");
    if (!a) return;
    setEntered(true);
    openAuthor(a, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 📡 Verse News loads with the Library — one extra call, and the broadcast
  // is the first thing a reader sees when they walk into the shop.
  const loadNews = async () => {
    try {
      const r = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "news-list", limit: 20 }),
      });
      const d = await r.json();
      if (r.ok) setNews(d.news || []);
    } catch (e) {}
  };
  useEffect(() => { if (tab === "library") loadNews(); /* eslint-disable-next-line */ }, [tab]);

  const postNews = async () => {
    if (!newsTitle.trim() || !newsBody.trim()) { setNewsMsg("A broadcast needs a headline and a body."); return; }
    setNewsBusy(true); setNewsMsg("");
    try {
      const r = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "news-post", auth: await getWalletAuth(), wallet: walletAddress,
          title: newsTitle, body: newsBody, kind: newsKind, pinned: newsPinned,
        }),
      });
      const d = await r.json();
      if (!r.ok) setNewsMsg(d.error || "Broadcast failed.");
      else {
        setNewsTitle(""); setNewsBody(""); setNewsPinned(false); setNewsComposer(false);
        setNewsMsg("📡 Broadcast live.");
        await loadNews();
      }
    } catch (e) { setNewsMsg("Network hiccup — try again."); }
    setNewsBusy(false);
  };

  const deleteNews = async (id) => {
    setNewsBusy(true);
    try {
      await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "news-delete", auth: await getWalletAuth(), wallet: walletAddress, id }),
      });
      await loadNews();
    } catch (e) {}
    setNewsBusy(false);
  };

  // The Library feed loads the first time the tab opens.
  useEffect(() => {
    if (tab !== "library" || libRows !== null || libLoading) return;
    setLibLoading(true);
    setLibError("");
    (async () => {
      try {
        const r = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "chapters-recent", limit: 60 }),
        });
        const d = await r.json();
        if (r.ok) setLibRows(d.chapters || []);
        else setLibError(d.error || "The Library shelves are jammed — try again.");
      } catch (e) {
        setLibError("The Library shelves are jammed — try again.");
      }
      setLibLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const unpublishChapter = async (row, i) => {
    if (!row || !walletAddress) return;
    setPublishing(i);
    try {
      const r = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chapter-unpublish", auth: await getWalletAuth(), wallet: walletAddress, chapterId: row.id }),
      });
      const d = await r.json();
      if (!r.ok) flashPublish(d.error || "Couldn't unpublish.");
      else {
        setPublished((rows) => rows.filter((c) => c.id !== row.id));
        flashPublish("Taken down. The chapter is still in your canon.");
      }
    } catch (e) {
      flashPublish("Network hiccup — try again.");
    }
    setPublishing(null);
  };

  const syncWallet = async () => {
    if (!connected || !publicKey) {
      setSyncMsg("Connect your wallet first.");
      setTimeout(() => setSyncMsg(""), 2500);
      return;
    }
    setSyncing(true);
    setSyncMsg("");
    try {
      // 1. Every SPL token account this wallet holds…
      const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM,
      });
      // 2. …filtered down to NFTs (exactly 1 unit, 0 decimals).
      const nftMints = accounts.value
        .map((a) => a.account?.data?.parsed?.info)
        .filter((info) => info && info.tokenAmount?.decimals === 0 && info.tokenAmount?.uiAmount === 1)
        .map((info) => info.mint);

      if (nftMints.length === 0) {
        setSyncMsg("No NFTs found in this wallet.");
        return;
      }

      // 3. Which of these are MascotGen mascots?
      const res = await fetch("/api/wallet-mascots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mints: nftMints }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      const found = data.mascots || [];
      if (found.length === 0) {
        setSyncMsg("No MascotGen mascots found in this wallet yet.");
        return;
      }

      // Pull each mascot's portable canon (chapters travel with the NFT).
      let canonByMint = {};
      try {
        const canonRes = await fetch("/api/canon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get", mints: found.map((m) => m.mintAddress) }),
        });
        const canonData = await canonRes.json();
        (canonData.entries || []).forEach((e) => {
          if (!canonByMint[e.mint_address]) canonByMint[e.mint_address] = [];
          canonByMint[e.mint_address].push({
            title: (e.is_original ? "📜 " : "✍️ ") + (e.title || (e.is_original ? "Original Canon" : "Owner Chapter")),
            panels: e.panels || [],
          });
        });
      } catch (e) {
        console.warn("canon fetch failed (non-fatal):", e);
      }

      // Pull each mascot's WRITER'S BIBLE so it lands on this device too.
      let biblesByMint = {};
      try {
        const bRes = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "bible-get", mints: found.map((m) => m.mintAddress) }),
        });
        const bData = await bRes.json();
        biblesByMint = bData.bibles || {};
      } catch (e) {
        console.warn("bible fetch failed (non-fatal):", e);
      }

      // 4a. REFRESH mascots already in the collection. The database is the
      // source of truth for rarity, universe, element, season and throne —
      // server-side promotions (like a god ascension) reach every device
      // through this merge. Local art, stories and status are untouched.
      const byMint = {};
      found.forEach((m) => { byMint[m.mintAddress] = m; });
      const refreshed = collection.map((c) => {
        const m = c.mintAddress ? byMint[c.mintAddress] : null;
        if (!m) return c;
        // Heal a hollow local copy: if this device is missing traits, art, or
        // character data that the database HAS, fill it in. Anything already
        // present locally wins — sync never overwrites your own work.
        const localTraits = c.traits || {};
        const traitsEmpty = !localTraits.archetypes || localTraits.archetypes.length === 0;
        return {
          ...c,
          mintTier: m.tier || c.mintTier,
          mintElement: m.element || c.mintElement || null,
          mintSeason: m.legendarySeason || null,
          mintUniverse: m.universe || c.mintUniverse || null,
          mintGodNumber: m.godNumber || null,
          markedBy: m.markedBy || null,
          markNumber: m.markNumber || null,
          tokenAddress: m.tokenAddress || c.tokenAddress || null,
          tokenUrl: m.tokenUrl || c.tokenUrl || null,
          tokenTelegram: m.tokenTelegram || c.tokenTelegram || null,
          traits: traitsEmpty && m.traits ? m.traits : c.traits,
          artUrl: c.artUrl || m.imageUrl || null,
          mintedArtUrl: c.mintedArtUrl || m.imageUrl || null,
          result: m.resultData && (!c.result || !c.result.bio) ? { ...m.resultData, ...(c.result || {}) } : c.result,
          characterNotes: c.characterNotes || biblesByMint[m.mintAddress] || undefined,
        };
      });

      // 4b. Merge NEW mascots without duplicating (match by mintAddress).
      const known = new Set(refreshed.map((c) => c.mintAddress).filter(Boolean));
      const additions = found
        .filter((m) => !known.has(m.mintAddress))
        .map((m) => ({
          id: m.mintAddress,
          result: m.resultData || {
            characterName: m.characterName || "Synced Mascot",
            tokenName: m.tokenName || m.characterName || "",
            ticker: m.ticker || "MGEN",
            tagline: "Synced from your wallet.",
            bio: "",
          },
          traits: m.traits || { archetypes: [], vibes: [], worlds: [], colors: [], accessories: [], aura: "None" },
          savedAt: m.mintedAt || new Date().toISOString(),
          artUrl: m.imageUrl || null,
          mintAddress: m.mintAddress,
          mintTier: m.tier || null,
          mintElement: m.element || null,
          mintSeason: m.legendarySeason || null,
          mintUniverse: m.universe || null,
          mintGodNumber: m.godNumber || null,
          markedBy: m.markedBy || null,
          markNumber: m.markNumber || null,
          tokenAddress: m.tokenAddress || null,
          tokenUrl: m.tokenUrl || null,
          tokenTelegram: m.tokenTelegram || null,
          expansions: canonByMint[m.mintAddress] || [],
          characterNotes: biblesByMint[m.mintAddress] || undefined,
          synced: true,
        }));

      persistCollection([...additions, ...refreshed]);
      if (studioEntry && studioEntry.mintAddress && byMint[studioEntry.mintAddress]) {
        const m = byMint[studioEntry.mintAddress];
        setStudioEntry((s) => ({ ...s, mintTier: m.tier || s.mintTier, mintElement: m.element || s.mintElement || null, mintSeason: m.legendarySeason || null, mintUniverse: m.universe || s.mintUniverse || null, mintGodNumber: m.godNumber || null, characterNotes: s.characterNotes || biblesByMint[s.mintAddress] || undefined }));
      }
      if (additions.length === 0) {
        setSyncMsg(`All ${found.length} owned mascots refreshed from the chain ✓`);
      } else {
        setSyncMsg(`Synced ${additions.length} new mascot${additions.length > 1 ? "s" : ""} + refreshed the rest ✓`);
      }
    } catch (e) {
      setSyncMsg(`Sync failed: ${e.message || "unknown error"}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(""), 4000);
    }
  };

  // ---- Crossover Sagas (Alpha) ---------------------------------------------
  // Select 2+ MINTED mascots in the collection and generate a shared story arc
  // where their canons collide. The saga is written into EVERY participant's
  // canon (local expansions + portable canon for each mint).
  const toggleCrossoverPick = (id) => {
    setCrossoverPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const generateCrossover = async () => {
    const picks = collection.filter((c) => crossoverPicks.includes(c.id) && c.mintAddress);
    if (picks.length < 2) return;
    setCrossoverLoading(true);
    setSyncMsg("");
    try {
      const cast = picks.map((p) => ({
        name: p.result.characterName,
        ticker: p.result.ticker,
        bio: p.result.bio || p.result.tagline || "",
        universe: p.mintUniverse || "Genesis Era (predates the Pentaverse)",
        status: STATUS_PROMPTS[p.status || "alive"],
        traits: p.traits,
        writersBible: p.characterNotes ? String(p.characterNotes).slice(0, 1800) : undefined,
      }));
      const res = await generateFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${LORE_RULES}\n\n${STORY_VOICE}\n\nCROSSOVER SAGA: these established characters from different universes of the Pentaverse meet in one shared story. Keep every character's identity, universe of origin, current life status, power level and personality locked to their bio — only ADD new shared canon. Universes colliding is rare and dramatic — make the meeting feel earned. Give each character at least one standout moment, and honor each character's life status exactly (dead characters act only within Purgatory or the cosmic-waterfall realm unless their minute has passed and they return).\n\nCast: ${JSON.stringify(cast)}\n\n${lang !== "English" ? `LANGUAGE: write the title and all panels in ${lang}. ` : ""}Write an epic 6-panel crossover story arc. Return ONLY valid JSON: { "title": "string, the saga's name", "panels": ["p1","p2","p3","p4","p5","p6"] }`,
          email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || "Crossover failed");
      const parsed = parseModelJSON(data);
      const saga = { title: `⚔️ ${parsed.title || "Crossover Saga"} (with ${cast.map((c) => c.name).join(" & ")})`, panels: parsed.panels || [] };

      // Write the saga into every participant locally…
      const next = collection.map((c) =>
        crossoverPicks.includes(c.id) ? { ...c, expansions: [...(c.expansions || []), saga] } : c
      );
      persistCollection(next);
      // …and into each mint's portable canon.
      for (const p of picks) {
        try {
          await fetch("/api/canon", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "add",
              mintAddress: p.mintAddress,
              authorWallet: publicKey ? publicKey.toBase58() : null,
              title: saga.title,
              panels: saga.panels,
              isOriginal: !p.synced,
            }),
          });
        } catch (e) {
          console.warn("crossover canon save failed:", e);
        }
      }
      setCrossoverPicks([]);
      setSyncMsg(`⚔️ Crossover saga written into ${picks.length} mascots' canon ✓`);
      setTimeout(() => setSyncMsg(""), 5000);
    } catch (e) {
      setSyncMsg(`Crossover failed: ${e.message}`);
      setTimeout(() => setSyncMsg(""), 5000);
    } finally {
      setCrossoverLoading(false);
    }
  };

  // 🎬 Video generation was removed — expensive, low-value. Existing clips
  // on mascots remain viewable/downloadable; no new ones can be made.

  // ---- 🖨️ Export the Saga ------------------------------------------------
  // Opens a print-ready page with the character card header and EVERY chapter
  // (origin story + all expansions) — print it or save as PDF. Reliable,
  // text-first, and it always works.
  const exportStory = (entry) => {
    const w = window.open("", "_blank");
    if (!w) return;
    const chapters = [];
    if ((entry.result.originStory || []).length) chapters.push({ title: "Origin Story", panels: entry.result.originStory });
    (entry.expansions || []).forEach((ex) => chapters.push({ title: ex.title || "Chapter", panels: ex.panels || [] }));
    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const chapterHtml = chapters
      .map(
        (ch) => `<div class="ch"><h2>${esc(ch.title)}</h2>${(ch.panels || [])
          .map((p, i) => `<div class="p"><span class="n">${i + 1}</span><div>${esc(p)}</div></div>`)
          .join("")}</div>`
      )
      .join("");
    w.document.write(`<html><head><title>${esc(entry.result.characterName)} — The Saga</title><style>
      body{font-family:Georgia,serif;background:#FBF7EE;color:#1A1A1A;max-width:760px;margin:auto;padding:28px}
      .hero{display:flex;gap:16px;align-items:center;border-bottom:4px solid #1A1A1A;padding-bottom:14px;margin-bottom:8px}
      .hero img{width:110px;height:110px;object-fit:cover;border:3px solid #1A1A1A;border-radius:8px}
      h1{font-family:Impact,'Arial Black',sans-serif;letter-spacing:1px;margin:0;text-transform:uppercase}
      .meta{font-size:13px;color:#555;margin-top:4px}
      .ch{margin-top:26px;page-break-inside:avoid}
      h2{font-family:Impact,'Arial Black',sans-serif;letter-spacing:1px;border-left:6px solid #1A1A1A;padding-left:10px}
      .p{display:flex;gap:10px;margin:10px 0;font-size:14px;line-height:1.55}
      .n{flex:none;width:24px;height:24px;border-radius:50%;background:#1A1A1A;color:#FBF7EE;font-family:Arial;font-weight:bold;font-size:12px;display:flex;align-items:center;justify-content:center}
      .foot{margin-top:34px;border-top:2px solid #1A1A1A;padding-top:10px;font-size:11px;color:#777;text-align:center}
      @media print{body{background:#fff}}
    </style></head><body>
      <div class="hero">${entry.artUrl ? `<img src="${entry.artUrl}"/>` : ""}<div>
        <h1>${esc(entry.result.characterName)}</h1>
        <div class="meta">$${esc(entry.result.ticker)} · ${esc(entry.result.tokenName)}${entry.mintUniverse ? ` · ${esc(entry.mintUniverse)}` : entry.mintAddress ? " · Genesis Era" : ""}${entry.mintTier ? ` · ${esc(entry.mintTier)}` : ""}</div>
        <div class="meta"><i>"${esc(entry.result.tagline)}"</i></div>
      </div></div>
      ${chapterHtml || "<p>No chapters yet — generate some story panels first.</p>"}
      <div class="foot">MASCOTGEN · mascotgen.studio · The character engine of the Pentaverse</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),700)</` + `script></body></html>`);
    w.document.close();
  };

  // ---- 🔧 Rebuild Profile ---------------------------------------------------
  // Older mints were recorded before full character data was saved, so synced
  // copies arrive with no bio, story or launch package. This reconstructs the
  // profile from the character's name and existing canon, then saves it to the
  // database permanently — every device gets it on the next sync.
  const rebuildProfile = async (entry) => {
    setRebuildLoading(true);
    setStudioError(null);
    try {
      const canon = [...((entry.expansions || []).flatMap((x) => x.panels || []))].slice(-12);
      const prompt = `You are restoring the lost profile of an ESTABLISHED MascotGen character. Their name, ticker and existing story canon are fixed — reconstruct everything else so it fits that canon perfectly.

${LORE_RULES}

Character name: ${entry.result.characterName}
Token: ${entry.result.tokenName || entry.result.characterName} ($${entry.result.ticker})
Card tier: ${entry.mintTier || "Unknown"}${entry.mintTier === "Super Legendary" ? " — ONE OF THE 11 GODS." : ""}
Birth universe: ${entry.mintUniverse || "Genesis Era (predates the Pentaverse)"}
Known canon excerpts: ${canon.length ? JSON.stringify(canon) : "none recorded"}
${lang !== "English" ? `LANGUAGE: write every field in ${lang}.` : ""}

Return ONLY valid JSON (no markdown, no backticks):
{
 "tagline": "one punchy sentence",
 "bio": "2-3 sentences of backstory consistent with the canon",
 "originStory": ["panel 1", "panel 2", "panel 3", "panel 4"],
 "visualDescription": "detailed AI art prompt for this character",
 "socialBio": "short X bio",
 "firstTweet": "launch tweet",
 "telegramWelcome": "2-3 sentence welcome"
}`;
      const res = await generateFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || "Rebuild failed");
      const parsed = parseModelJSON(data);
      const restored = {
        ...entry.result,
        tagline: parsed.tagline || entry.result.tagline,
        bio: parsed.bio || entry.result.bio,
        originStory: (entry.result.originStory || []).length ? entry.result.originStory : parsed.originStory || [],
        visualDescription: entry.result.visualDescription || parsed.visualDescription || "",
        socialBio: parsed.socialBio || "",
        firstTweet: parsed.firstTweet || "",
        telegramWelcome: parsed.telegramWelcome || "",
      };
      const next = collection.map((c) => (c.id === entry.id ? { ...c, result: restored } : c));
      persistCollection(next);
      if (studioEntry && studioEntry.id === entry.id) setStudioEntry((s) => ({ ...s, result: restored }));
      // Make it permanent: save the restored profile to the database.
      if (entry.mintAddress) {
        try {
          await fetch("/api/record-mint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "update-profile", mintAddress: entry.mintAddress, resultData: restored, imageUrl: entry.artUrl || undefined }),
          });
        } catch (e) {
          console.warn("profile save failed (non-fatal):", e);
        }
      }
    } catch (e) {
      setStudioError(`Rebuild failed: ${e.message || "unknown error"}`);
    } finally {
      setRebuildLoading(false);
    }
  };

  // ---- 📥 Restore / paste a chapter ----------------------------------------
  // For chapters written on another device (or transcribed from screenshots):
  // paste the title and panels, and the chapter joins this character's canon
  // both locally AND in the portable canon API — so it can never be lost to a
  // single browser's storage again. Panels are separated by blank lines.
  const addPastedChapter = async () => {
    if (!studioEntry || !pasteText.trim()) return;
    const panels = pasteText
      .split(/\n\s*\n/)
      .map((p) => p.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (panels.length === 0) return;
    const chapter = { title: pasteTitle.trim() || "Restored Chapter", panels };
    const updated = { ...studioEntry, expansions: [...(studioEntry.expansions || []), chapter] };
    setStudioEntry(updated);
    const next = collection.map((c) => (c.id === studioEntry.id ? updated : c));
    persistCollection(next);
    if (studioEntry.mintAddress) {
      try {
        await fetch("/api/canon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add",
            mintAddress: studioEntry.mintAddress,
            authorWallet: publicKey ? publicKey.toBase58() : null,
            title: chapter.title,
            panels: chapter.panels,
            isOriginal: !studioEntry.synced,
          }),
        });
      } catch (e) {
        console.warn("canon save failed (non-fatal):", e);
      }
    }
    setPasteOpen(false);
    setPasteTitle("");
    setPasteText("");
  };

  // ---- 🗑 Permanent chapter / panel delete ----------------------------------
  // Removes the panel or chapter from this device AND from the mascot's
  // portable canon record, so Sync Wallet can never resurrect it. There is no
  // undo — the confirm step exists for exactly that reason.
  const confirmDelete = async () => {
    if (!pendingDelete || !studioEntry) return;
    const { type, ci, pi } = pendingDelete;
    const exps = [...(studioEntry.expansions || [])];
    const chapter = exps[ci];
    if (!chapter) { setPendingDelete(null); return; }

    let apiAction = null;
    if (type === "chapter") {
      exps.splice(ci, 1);
      apiAction = { action: "delete-chapter", title: chapter.title };
    } else {
      const panels = (chapter.panels || []).filter((_, x) => x !== pi);
      if (panels.length === 0) {
        // Last panel removed — the chapter goes with it.
        exps.splice(ci, 1);
        apiAction = { action: "delete-chapter", title: chapter.title };
      } else {
        exps[ci] = { ...chapter, panels };
        apiAction = { action: "update-chapter", title: chapter.title, panels };
      }
    }

    const updated = { ...studioEntry, expansions: exps };
    setStudioEntry(updated);
    persistCollection(collection.map((c) => (c.id === studioEntry.id ? updated : c)));

    if (studioEntry.mintAddress && apiAction) {
      try {
        await fetch("/api/canon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...apiAction, mintAddress: studioEntry.mintAddress }),
        });
      } catch (e) {
        console.warn("canon delete failed (non-fatal):", e);
      }
    }
    setPendingDelete(null);
  };

  // Studio now opens in its OWN TAB (?studio=<id>): more room for the card,
  // art, comic pages, video and expansions than a cramped modal.
  const openStudio = (entry) => {
    window.open(`${window.location.pathname}?studio=${encodeURIComponent(entry.id)}`, "_blank");
  };

  // In the new tab: read the param, load the entry full-page. Runs whenever the
  // collection updates (it loads async after mount), and skips the landing gate.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("studio");
    if (!sid || studioPage) return;
    const found = collection.find((c) => String(c.id) === String(sid));
    if (found) {
      setEntered(true);          // bypass the ENTER THE STUDIO landing gate
      setTab("studio");
      setMintResult(null);
      setMintError(null);
      setMintStatus(null);
      setStudioEntry(found);
      setStudioPage(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  // ---- ⚔️ MEME WARS: victories become canon ---------------------------------
  // A win in the arena isn't just a rating bump — it can be written into the
  // mascot's permanent story. This is what makes battles matter: your card
  // carries the record of who it beat, forever, and the chapter travels with
  // the NFT.
  const [victoryWriting, setVictoryWriting] = useState(false);
  const [victoryMsg, setVictoryMsg] = useState("");

  const writeVictoryIntoCanon = async () => {
    if (!battleResult || !battleResult.log || victoryWriting) return;
    const leadName = (battleResult.yourTeam || [])[0]?.name;
    const entry = collection.find((c) => c.result && c.result.characterName === leadName && c.mintAddress);
    if (!entry) {
      setVictoryMsg("Couldn't find that mascot in your collection — try Sync Wallet first.");
      return;
    }
    if (!isPaid) {
      setVictoryMsg("🔒 Writing victories into canon is a subscriber feature — see Pricing.");
      return;
    }
    setVictoryWriting(true);
    setVictoryMsg("⚔️ Writing this battle into canon...");
    try {
      const foe = (battleResult.theirTeam || []).map((f) => f.name).join(", ");
      const highlights = (battleResult.log || []).slice(0, 40).join("\n");
      const prompt = `${LORE_RULES}

${STORY_VOICE}

You are writing a CANON VICTORY CHAPTER for a mascot who just won a real battle in the MascotGen Arena. This actually happened — treat the battle log as historical record, not invention.

CHARACTER: ${entry.result.characterName}${entry.mintUniverse ? ` of ${entry.mintUniverse} (stamped on-chain — absolute, never contradict it)` : ""}
BIO: ${entry.result.bio || ""}
${entry.characterNotes ? `WRITER'S BIBLE (author-provided — canon law for this character's voice and motives):\n${String(entry.characterNotes).slice(0, 4000)}` : ""}
ALLIES WHO FOUGHT: ${(battleResult.yourTeam || []).map((f) => f.name).join(", ")}
OPPONENTS DEFEATED: ${foe}

THE BATTLE LOG (what actually happened, in order):
${highlights}

Write 4 story panels covering this victory. Requirements:
- Follow the real sequence of the log — the same moves, knockouts, and turning points, in order.
- Name the opponents. This is a real rival now, part of this character's history.
- Land on what the victory COST or CHANGED, not just that they won.
- Keep it in the character's established voice and universe.

Return ONLY JSON: {"title":"chapter title","panels":["panel 1","panel 2","panel 3","panel 4"]}`;

      const res = await generateFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const text = (data.content || []).map((b) => b.text || "").join("");
      const raw = JSON.parse(text.replace(/```json|```/g, "").trim());
      const chapter = { title: `⚔️ ${raw.title || "Victory"}`, panels: raw.panels || [] };

      const updated = { ...entry, expansions: [...(entry.expansions || []), chapter] };
      persistCollection(collection.map((c) => (c.id === entry.id ? updated : c)));
      try {
        await fetch("/api/canon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add",
            mintAddress: entry.mintAddress,
            authorWallet: publicKey ? publicKey.toBase58() : null,
            title: chapter.title,
            panels: chapter.panels,
            isOriginal: !entry.synced,
          }),
        });
      } catch (e) {}
      setVictoryMsg(`✅ "${chapter.title}" added to ${entry.result.characterName}'s saga.`);
    } catch (e) {
      setVictoryMsg(e.message || "Couldn't write the chapter — try again.");
    } finally {
      setVictoryWriting(false);
    }
  };

  // ---- The Saga Engine ------------------------------------------------------
  // Serialized story expansion with full continuity. Modes:
  //   "panels" — +4 story panels continuing the saga
  //   "fight"  — a 12-16 panel fully-choreographed DBZ/Bleach-style battle arc
  //   "custom" — your own direction (the textarea)
  // Every prompt carries the Pentaverse LORE_RULES, the character's birth
  // universe, life status, and established canon so nothing contradicts.
  const expandCharacter = async (mode) => {
    if (!studioEntry) return;
    if (!isPaid) {
      setStudioError("🔒 The saga engine is for subscribers — upgrade on the Pricing page to write this character's next chapter.");
      return;
    }
    setStudioLoading(true);
    setStudioError(null);
    try {
      const e = studioEntry;
      const universeLine = e.mintUniverse
        ? `${e.mintUniverse}${e.mintUniverse === "Empyrion" ? " (the North point — god-adjacent, all elements mix; its dead rest at the cosmic waterfall)" : ""}`
        : "Genesis Era (no universe — this being predates the Pentaverse itself)";
      const statusLine = STATUS_PROMPTS[e.status || "alive"];
      const priorTitles = (e.expansions || []).map((x) => x.title).filter(Boolean).slice(-10);
      const recentCanon = [...(e.result.originStory || []), ...(e.expansions || []).flatMap((x) => x.panels || [])].slice(-10);

      let request;
      let panelSpec;
      if (mode === "fight") {
        request = `Write an epic, fully-choreographed DBZ / Bleach style BATTLE ARC. Invent or reuse a worthy opponent consistent with canon. Every panel is a distinct beat: tense opening, power-ups with visible auras, named signature techniques shouted mid-fight, energy attacks, terrain destruction (craters, shattered buildings, shockwaves), at least one reversal, a mid-fight transformation or second wind, and a decisive finish. Escalate relentlessly. Deaths ARE allowed — if anyone dies, apply the purgatory / cosmic-waterfall time-warp rules exactly.`;
        panelSpec = "12 to 16 panels";
      } else if (mode === "custom") {
        request = `Continue the saga following this direction from the creator: "${(studioInput || "Expand this character's world with new lore.").trim()}"`;
        panelSpec = "4 to 8 panels (as many as the direction needs)";
      } else {
        request = `Continue the saga with the next chapter — advance the character's journey in a meaningful way (new challenge, new ally or enemy, new territory of their universe, or consequences of the last chapter).`;
        panelSpec = "exactly 4 panels";
      }

      const res = await generateFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `You are the head writer of the MascotGen saga — long-running serialized character stories with REAL continuity, like a shonen manga that never contradicts itself.\n\n${LORE_RULES}\n\n${STORY_VOICE}\n\n${e.characterNotes ? `WRITER'S BIBLE for this character (author-provided — treat as canon law for voice, motives, backstory and facts; it outranks your own invention):\n${String(e.characterNotes).slice(0, 7000)}\n\n` : ""}CHARACTER FILE:\n${JSON.stringify({ name: e.result.characterName, token: e.result.tokenName, ticker: e.result.ticker, tagline: e.result.tagline, bio: e.result.bio, vibes: (e.traits && e.traits.vibes) || [], archetypes: (e.traits && e.traits.archetypes) || [] })}\nCard tier: ${e.mintTier || "Unminted"}${e.mintTier === "Super Legendary" ? " — THIS CHARACTER IS ONE OF THE 11 GODS." : ""}\nBirth universe: ${universeLine}\n⚠️ THE BIRTH UNIVERSE ABOVE IS STAMPED ON-CHAIN AND IS ABSOLUTE. It outranks the writer's bible, the character bio, and every prior chapter — those are editable text, the mint is not. Never name a different home realm, never say the character is "from" or "born in" anywhere else, and never write a scene that contradicts it. If earlier canon disagrees, the character MOVED or was RAISED elsewhere; they were still BORN here.\nCurrent life status: ${statusLine}\nEstablished chapters so far: ${priorTitles.length ? priorTitles.join(" · ") : "none yet — this is chapter one after the origin story"}\nRecent canon (last beats): ${JSON.stringify(recentCanon)}\n\nREQUEST: ${request}\n\n${lang !== "English" ? `LANGUAGE: Write the title and every panel in ${lang}.\n\n` : ""}RULES: Keep identity, powers, personality and all established canon consistent — ADD to canon, never rewrite it. Write vivid panels of 2-4 sentences each that obey the NARRATIVE VOICE rules above — vibe-driven tone, real dialogue, at least one human beat. Honor the character's life status exactly: dead characters act only within Purgatory / the waterfall realm unless their minute has passed and they return.\n\nReturn ONLY valid JSON (no markdown, no backticks): { "title": "string, the chapter title", "panels": [${panelSpec} — each a string] }`,
          email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || "Expansion failed");
      const raw = parseModelJSON(data);
      const parsed = { title: `${mode === "fight" ? "⚔️ " : ""}${raw.title || "New Chapter"}`, panels: raw.panels || [] };
      const expansions = studioEntry.expansions || [];
      const updated = { ...studioEntry, expansions: [...expansions, parsed] };
      setStudioEntry(updated);
      const next = collection.map((c) => (c.id === studioEntry.id ? updated : c));
      persistCollection(next);
      setStudioInput("");

      // Portable canon: if this mascot is MINTED, the chapter also travels with
      // the NFT (Supabase, keyed by mint address). Chapters written by the
      // original creator are marked is_original (permanent, read-only for
      // future owners); synced mascots' new chapters are owner additions.
      if (studioEntry.mintAddress) {
        try {
          await fetch("/api/canon", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "add",
              mintAddress: studioEntry.mintAddress,
              authorWallet: publicKey ? publicKey.toBase58() : null,
              title: parsed.title || null,
              panels: parsed.panels || [],
              isOriginal: !studioEntry.synced,
            }),
          });
        } catch (e) {
          console.warn("canon save failed (non-fatal):", e);
        }
      }
    } catch (e) {
      setStudioError(e.message || "Expansion failed — try again.");
    } finally {
      setStudioLoading(false);
    }
  };

  const copyText = (label, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // Opens Stripe's billing portal so subscribers can update payment details or
  // cancel themselves. "Cancel anytime" is a promise in our Terms — it needs a
  // real button behind it, not an email address.
  const handlePortal = async () => {
    if (!email) {
      alert("Enter your email first (Studio tab, top of the build panel) — that's how we find your subscription.");
      setTab("studio");
      return;
    }
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal", email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "No billing account found for that email.");
      }
    } catch (e) {
      alert("Couldn't open the billing portal — try again.");
    }
  };

  const handleBuy = async (plan) => {
    if (!email) {
      alert("Enter your email first (Studio tab, top of the build panel) so we can track your plan — then come back and choose a package.");
      setTab("studio");
      return;
    }
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Checkout failed — try again.");
      }
    } catch (e) {
      alert("Checkout failed — try again.");
    }
  };

  const liveStats = result ? computeStats(currentTraits()) : null;

  if (!entered) {
    return (
      <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh" }}>
        <HomePage onStart={() => { setEntered(true); setTab("studio"); }} onWhitepaper={() => { setEntered(true); setTab("whitepaper"); }} fullscreen />
      </div>
    );
  }

  return (
    <div className="crt" style={{ backgroundColor: INK, minHeight: "100vh", color: OFFWHITE }}>
      <HoloStyles />
      <header className="sticky top-0 z-40" style={{ borderBottom: `2px solid ${HAIRLINE}`, backgroundColor: "rgba(11,9,18,0.94)", backdropFilter: "blur(10px)" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setTab("home")} className="flex items-center gap-2">
            {/* The marquee lamp — a lit block, the way a cabinet announces itself. */}
            <span style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: LIME, boxShadow: `0 0 10px ${LIME}` }} />
            <span className="font-black text-sm mono" style={{ color: OFFWHITE, letterSpacing: "-0.3px" }}>MASCOTGEN</span>
          </button>
          <nav className="hidden md:flex gap-1 ml-5">
            {[["studio", "Studio"], ["legion", "🛡 Legion"], ["battle", "⚔️ Battle"], ["race", "🏁 Race"], ["market", "🏪 Market"], ["library", "📖 Library"], ["stats", "📊 Stats"], ["learn", "University"], ["whitepaper", "Whitepaper"], ["pricing", "Pricing"]].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`btn-a px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${tab === id ? "nav-on" : ""}`}
                style={{ color: tab === id ? INK : MUTED, backgroundColor: tab === id ? LIME : "transparent" }}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: isAlpha ? MAGENTA : isPlatinum ? AMBER : isPaid ? LIME : HAIRLINE, color: isPaid ? INK : MUTED }}>
              {tier}
            </span>
            <button onClick={() => setShowCollection(true)} className="p-2 rounded-lg" style={{ color: MUTED }}>
              <FolderOpen size={16} />
            </button>
            {connected && (
              <button
                onClick={() => {
                  setNameInput((profile && profile.username) || "");
                  setProfileError("");
                  setProfileOpen(true);
                }}
                title={profile && profile.username ? "Your author name" : "Claim your author name"}
                className="text-xs px-2 py-1 rounded-lg font-bold border max-w-[112px] truncate"
                style={{
                  borderColor: profile && profile.username ? LIME : HAIRLINE,
                  color: profile && profile.username ? LIME : MUTED,
                }}
              >
                {profile && profile.username ? `@${profile.username}` : "＋ Claim name"}
              </button>
            )}
            <WalletMultiButton style={{ backgroundColor: PANEL, height: 32, fontSize: 12, borderRadius: 8 }} />
          </div>
        </div>
        {/* Mobile nav — the desktop nav is hidden below md, so phones get this
            compact scrollable tab row instead. */}
        <div className="md:hidden px-4 pb-2 flex gap-1 overflow-x-auto">
          {[["studio", "Studio"], ["legion", "🛡 Legion"], ["battle", "⚔️ Battle"], ["race", "🏁 Race"], ["market", "🏪 Market"], ["library", "📖 Library"], ["stats", "📊 Stats"], ["learn", "University"], ["whitepaper", "Whitepaper"], ["pricing", "Pricing"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`btn-a px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 ${tab === id ? "nav-on" : ""}`}
              style={{ color: tab === id ? INK : MUTED, backgroundColor: tab === id ? LIME : PANEL2 }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {resumeMsg && (
        <div className="px-4 py-2 text-xs font-bold flex items-center justify-between gap-2" style={{ backgroundColor: "rgba(198,255,61,0.10)", color: LIME, borderBottom: `1px solid ${HAIRLINE}` }}>
          <span>{resumeMsg}</span>
          <button onClick={() => setResumeMsg(null)} style={{ color: MUTED }}>✕</button>
        </div>
      )}

      {/* ✨ WHAT'S NEW — a thin strip, dismissable, that re-opens itself only
          when a genuinely newer entry ships. Entries auto-expire after
          NEW_MAX_AGE_DAYS so it can never turn into a wall of old news. */}
      {hasNew && freshNews.length > 0 && (
        <div style={{ borderBottom: `1px solid ${HAIRLINE}`, background: "linear-gradient(90deg, rgba(198,255,61,0.10), transparent)" }}>
          <div className="max-w-6xl mx-auto px-4 py-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black px-2 py-0.5 rounded mono" style={{ backgroundColor: LIME, color: INK }}>NEW</span>
              <button onClick={() => setNewOpen((v) => !v)} className="text-xs font-bold text-left flex-1 min-w-0 truncate" style={{ color: OFFWHITE }}>
                {freshNews.length} update{freshNews.length === 1 ? "" : "s"} — {freshNews.map((n) => n.t).slice(0, 3).join(" · ")}
                {freshNews.length > 3 ? " …" : ""}
              </button>
              <button onClick={() => setNewOpen((v) => !v)} className="btn-a text-[10px] px-2 py-1 rounded border font-bold shrink-0" style={{ borderColor: LIME, color: LIME }}>
                {newOpen ? "HIDE" : "SEE ALL"}
              </button>
              <button onClick={dismissNew} className="text-[10px] px-1 shrink-0" style={{ color: MUTED }} title="Dismiss until the next update">✕</button>
            </div>
            {newOpen && (
              <div className="mt-2 pt-2 border-t" style={{ borderColor: HAIRLINE }}>
                {freshNews.map((n) => (
                  <div key={n.t} className="py-1.5">
                    <p className="text-xs font-bold" style={{ color: LIME }}>{n.t}</p>
                    <p className="text-[11px]" style={{ color: MUTED }}>{n.b}</p>
                  </div>
                ))}
                <button onClick={dismissNew} className="btn-a mt-2 text-[10px] px-3 py-1.5 rounded font-bold" style={{ backgroundColor: LIME, color: INK }}>
                  GOT IT
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ⚜️ CHAMPION BANNER — shows only for wallets in the snapshot cut. */}
      {champStatus && !champStatus.minted && (
        <div className="border-b" style={{ background: "linear-gradient(90deg, rgba(255,215,0,0.14), rgba(255,159,28,0.08))", borderColor: "#B8860B" }}>
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs" style={{ color: "#FFD700" }}>
              ⚜️ <b>YOU MADE THE CHAMPION CUT</b> — Season {champStatus.season}, slot #{champStatus.slot} ({champStatus.source} ladder).
              {champStatus.pending
                ? " Your grant is ready: open any of your characters with art in the Legion and hit MINT AS CHAMPION — free, on the house."
                : " Claim your grant, then mint it onto any character you choose. No deadline — the seat is yours forever."}
            </p>
            {!champStatus.pending && (
              <button
                onClick={claimChampion}
                disabled={champClaiming}
                className="text-xs font-black px-3 py-1.5 rounded-lg shrink-0"
                style={{ backgroundColor: "#FFD700", color: INK, opacity: champClaiming ? 0.6 : 1 }}
              >
                {champClaiming ? "CLAIMING…" : "⚜️ CLAIM YOUR CHAMPION"}
              </button>
            )}
          </div>
        </div>
      )}

      {publicError && !publicMascot && (
        <div className="fixed inset-0 z-[80] overflow-y-auto flex items-center justify-center" style={{ backgroundColor: INK }}>
          <div className="max-w-sm mx-auto px-4 py-8 text-center">
            <p className="text-4xl mb-3">🕳️</p>
            <p className="text-sm mb-4" style={{ color: OFFWHITE }}>{publicError}</p>
            <button
              onClick={() => { try { window.history.replaceState(null, "", window.location.pathname); } catch (e) {} setPublicError(""); setTab("studio"); }}
              className="btn-a text-xs font-bold px-4 py-2 rounded-lg"
              style={{ backgroundColor: LIME, color: INK }}
            >
              Enter the Studio →
            </button>
          </div>
        </div>
      )}

      {publicMascot && (
        <div className="fixed inset-0 z-[80] overflow-y-auto" style={{ backgroundColor: INK }}>
          <div className="max-w-md mx-auto px-4 py-8">
            <p className="text-xs uppercase tracking-widest text-center mb-4" style={{ color: MUTED }}>✦ A citizen of the Pentaverse ✦</p>
            <div className="rounded-2xl p-[4px]" style={{ background: `linear-gradient(135deg, ${rarityColorMap[publicMascot.tier] || "#5EC9FF"}, transparent 70%)`, boxShadow: `0 0 24px ${rarityColorMap[publicMascot.tier] || "#5EC9FF"}44` }}>
              <div className="rounded-[13px] overflow-hidden" style={{ backgroundColor: "#141218" }}>
                {publicMascot.image && <img src={publicMascot.image} alt={publicMascot.name} className="w-full aspect-square object-cover" />}
                <div className="p-4">
                  <p className="text-lg font-black" style={{ color: OFFWHITE }}>{publicMascot.name} {publicMascot.ticker && <span className="text-xs font-bold" style={{ color: LIME }}>${publicMascot.ticker}</span>}</p>
                  <p className="text-xs mb-2" style={{ color: rarityColorMap[publicMascot.tier] || MUTED }}>
                    {publicMascot.tier}{publicMascot.universe ? ` · ${publicMascot.universe}` : ""}{publicMascot.element ? ` · ${publicMascot.element}` : ""}
                  </p>
                  {publicMascot.tagline && <p className="text-sm italic mb-2" style={{ color: OFFWHITE }}>"{publicMascot.tagline}"</p>}
                  {publicMascot.stats && (
                    <div className="grid grid-cols-4 gap-1 my-3">
                      {[["PWR", publicMascot.stats.power], ["HP", publicMascot.stats.hp], ["SPD", publicMascot.stats.speed], ["SPC", publicMascot.stats.special]].map(([l, v]) => (
                        <div key={l} className="rounded-lg py-2 text-center" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                          <p className="text-sm font-black" style={{ color: LIME }}>{v}</p>
                          <p className="text-[9px]" style={{ color: MUTED }}>{l}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {publicMascot.stats && publicMascot.stats.battleHp > 0 && (
                    <p className="text-xs mb-2" style={{ color: MUTED }}>Battle HP <span className="font-black" style={{ color: LIME }}>{publicMascot.stats.battleHp}</span></p>
                  )}
                  {publicMascot.bio && <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{publicMascot.bio}</p>}
                  {/* 🚀 Live token buttons — only when the owner linked a token. */}
                  {publicMascot.token && publicMascot.token.address && (
                    <div className="flex gap-2 mt-4">
                      <a href={publicMascot.token.url || `https://pump.fun/coin/${publicMascot.token.address}`} target={EXT_TAB} rel="noopener noreferrer" className="btn-a flex-1 text-center py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: LIME, color: INK }}>
                        BUY ${publicMascot.ticker || "TOKEN"} ON PUMP.FUN ↗
                      </a>
                      {publicMascot.token.telegram && (
                        <a href={publicMascot.token.telegram} target={EXT_TAB} rel="noopener noreferrer" className="flex-1 text-center py-2 rounded-lg text-xs font-bold border" style={{ borderColor: "#5EC9FF", color: "#5EC9FF" }}>
                          JOIN TELEGRAM ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(publicMascot.panels || []).length > 0 && (
              <div className="mt-4 rounded-xl border p-4" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
                <p className="text-xs uppercase tracking-widest mb-2" style={{ color: AMBER }}>📜 From the saga</p>
                {publicMascot.panels.map((p, i) => (
                  <p key={i} className="text-xs leading-relaxed mb-2" style={{ color: OFFWHITE }}>{p}</p>
                ))}
              </div>
            )}

            <div className="mt-5 rounded-xl border p-4 text-center" style={{ borderColor: LIME, backgroundColor: "rgba(198,255,61,0.05)" }}>
              <p className="text-sm font-bold mb-1" style={{ color: OFFWHITE }}>This character was born in MascotGen.</p>
              <p className="text-xs mb-3" style={{ color: MUTED }}>
                Five universes. Twelve thrones — one sealed. Real battle stats, sagas that keep being written, and the first 333 mints in history are ALL Legendary.
              </p>
              <button
                onClick={() => { try { window.history.replaceState(null, "", window.location.pathname); } catch (e) {} setPublicMascot(null); setTab("studio"); }}
                className="btn-a px-6 py-2.5 rounded-lg text-sm font-bold"
                style={{ backgroundColor: LIME, color: INK }}
              >
                ✨ CREATE YOUR OWN — FREE
              </button>
              <div className="flex justify-center gap-4 mt-3">
                <button onClick={() => { try { window.history.replaceState(null, "", window.location.pathname); } catch (e) {} setPublicMascot(null); setTab("market"); }} className="text-xs underline" style={{ color: MUTED }}>Browse the Market</button>
                <button onClick={() => { try { window.history.replaceState(null, "", window.location.pathname); } catch (e) {} setPublicMascot(null); setTab("whitepaper"); }} className="text-xs underline" style={{ color: MUTED }}>Read the lore</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!studioPage && (
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* 🔗 SINGLE CHAPTER — /?c=<id>. The shareable unit. */}
        {(chapterView || chapterLoading || chapterError) && (
          <div className="fixed inset-0 z-[85] overflow-y-auto" style={{ backgroundColor: INK }}>
            <div className="max-w-2xl mx-auto px-4 py-8">
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs uppercase tracking-widest" style={{ color: MUTED }}>✦ A chapter of the Pentaverse ✦</p>
                <button onClick={closeChapter} className="text-xs font-bold px-3 py-1.5 rounded-lg border" style={{ borderColor: HAIRLINE, color: OFFWHITE }}>
                  ✕ Close
                </button>
              </div>

              {chapterLoading && <p className="text-sm text-center py-12" style={{ color: MUTED }}>Turning to the page…</p>}
              {chapterError && !chapterLoading && (
                <div className="text-center py-12">
                  <p className="text-sm mb-3" style={{ color: MAGENTA }}>{chapterError}</p>
                  <button onClick={closeChapter} className="text-xs underline" style={{ color: MUTED }}>Back to the studio</button>
                </div>
              )}

              {chapterView && !chapterLoading && (() => {
                const ch = chapterView.chapter;
                const m = chapterView.mascot || {};
                const tierColor = rarityColorMap[m.tier] || HAIRLINE;
                return (
                  <>
                    <div className="rounded-xl border overflow-hidden mb-4" style={{ backgroundColor: PANEL, borderColor: tierColor + "66" }}>
                      <div className="flex items-center gap-4 p-4" style={{ background: `linear-gradient(135deg, ${tierColor}22, transparent 65%)` }}>
                        {m.image ? (
                          <img src={m.image} alt={ch.character} className="rounded-xl object-cover shrink-0" style={{ width: 76, height: 76, border: `2px solid ${tierColor}`, boxShadow: `0 0 16px ${tierColor}44` }} />
                        ) : (
                          <div className="rounded-xl shrink-0 flex items-center justify-center text-2xl" style={{ width: 76, height: 76, backgroundColor: PANEL2, border: "2px solid #33303F" }}>🎭</div>
                        )}
                        <div className="min-w-0">
                          <p className="text-lg font-black leading-tight" style={{ color: LIME }}>{ch.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: AMBER }}>
                            {ch.character}{ch.chapterNo ? ` · Chapter ${ch.chapterNo}` : ""}
                          </p>
                          <p className="text-[10px] mt-0.5">
                            {m.tier && <span style={{ color: tierColor }}>{m.god ? "✧ " : ""}{m.tier}{m.season ? ` · S${m.season}` : ""}</span>}
                            {m.universe && <span style={{ color: UNIVERSE_COLORS[m.universe] || MUTED }}> · {UNIVERSE_ICONS[m.universe] || ""} {m.universe}</span>}
                            {m.markNumber && <span style={{ color: "#FFF3B0" }}> · ✋ #{m.markNumber}/777</span>}
                          </p>
                          {chapterView.author && (
                            <button onClick={() => { closeChapter(); openAuthor(chapterView.author); }} className="text-[11px] font-bold mt-1" style={{ color: "#5EC9FF" }}>
                              by @{chapterView.author} →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 mb-4">
                      {(ch.panels || []).map((p, j) => (
                        <p key={j} className="text-sm leading-relaxed p-4 rounded-lg" style={{ backgroundColor: PANEL, color: OFFWHITE }}>{p}</p>
                      ))}
                    </div>

                    <button
                      onClick={() => copyLink(`${window.location.origin}/?c=${encodeURIComponent(ch.id)}`, "Chapter")}
                      className="w-full py-2.5 rounded-lg text-xs font-bold border mb-4"
                      style={{ borderColor: "#5EC9FF", color: "#5EC9FF" }}
                    >
                      🔗 COPY LINK TO THIS CHAPTER
                    </button>
                    {copyMsg && <p className="text-xs text-center mb-4 break-all" style={{ color: "#5EC9FF" }}>{copyMsg}</p>}

                    {/* 📖 THE SAGA — a cross-character book. When this chapter is
                        part of a multi-character saga, the whole ordered table of
                        contents shows here (across every character), with big
                        Prev / Next buttons so a reader walks the entire main plot
                        start to finish. This is what makes the project read like
                        a book instead of scattered character stories. */}
                    {chapterView.saga && (
                      <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: "#C084FC0D", borderColor: "#C084FC55" }}>
                        <p className="text-[10px] uppercase tracking-widest mb-1 font-black" style={{ color: "#C084FC" }}>
                          📖 {chapterView.saga.name}
                        </p>
                        <p className="text-[10px] mb-3" style={{ color: MUTED }}>
                          Part {chapterView.saga.index + 1} of {chapterView.saga.total} — one story across many characters. Read it in order.
                        </p>
                        <div className="flex gap-2 mb-3">
                          <button
                            disabled={!chapterView.saga.prevId}
                            onClick={() => chapterView.saga.prevId && openChapter(chapterView.saga.prevId)}
                            className="flex-1 py-2 rounded-lg text-xs font-bold border"
                            style={{ borderColor: chapterView.saga.prevId ? "#C084FC" : HAIRLINE, color: chapterView.saga.prevId ? "#C084FC" : "#4A4756" }}
                          >← Previous part</button>
                          <button
                            disabled={!chapterView.saga.nextId}
                            onClick={() => chapterView.saga.nextId && openChapter(chapterView.saga.nextId)}
                            className="flex-1 py-2 rounded-lg text-xs font-black"
                            style={{ backgroundColor: chapterView.saga.nextId ? "#C084FC" : HAIRLINE, color: chapterView.saga.nextId ? INK : "#4A4756" }}
                          >Next part →</button>
                        </div>
                        <div className="border-t pt-2" style={{ borderColor: "#C084FC22" }}>
                          {chapterView.saga.parts.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => s.id !== ch.id && openChapter(s.id)}
                              className="block w-full text-left text-xs py-1.5 truncate"
                              style={{ color: s.id === ch.id ? "#C084FC" : LIME, cursor: s.id === ch.id ? "default" : "pointer", fontWeight: s.id === ch.id ? 800 : 400 }}
                            >
                              <span style={{ color: MUTED }}>{s.chapterNo}.</span> {s.title}
                              <span style={{ color: MUTED }}> — {s.character}</span>
                              {s.id === ch.id ? "  ← you are here" : ""}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* A single character's own numbered chapters — shown when
                        this isn't part of a bigger cross-character saga. */}
                    {!chapterView.saga && (chapterView.siblings || []).length > 1 && (
                      <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
                        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>
                          More of {ch.character}'s saga
                        </p>
                        {chapterView.siblings.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => s.id !== ch.id && openChapter(s.id)}
                            className="block w-full text-left text-xs py-1.5 truncate"
                            style={{ color: s.id === ch.id ? MUTED : LIME, cursor: s.id === ch.id ? "default" : "pointer" }}
                          >
                            {s.chapterNo ? `${s.chapterNo}. ` : "• "}{s.title}{s.id === ch.id ? "  ← you are here" : ""}
                          </button>
                        ))}
                      </div>
                    )}

                    <p className="text-center text-xs mt-6 mb-4" style={{ color: MUTED }}>
                      Written in the{" "}
                      <button onClick={() => { closeChapter(); setTab("studio"); }} className="underline font-bold" style={{ color: LIME }}>
                        MascotGen Story Studio
                      </button>
                      {" "}— every character is a minted original.
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* 👤 PUBLIC AUTHOR PAGE — /?a=username. No gate, no login: this is the
            page the 📖 PUBLISH button feeds, and the link authors share. */}
        {(authorView || authorLoading || authorError) && (
          <div className="fixed inset-0 z-[80] overflow-y-auto" style={{ backgroundColor: INK }}>
            <div className="max-w-2xl mx-auto px-4 py-8">
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs uppercase tracking-widest" style={{ color: MUTED }}>✦ An author of the Pentaverse ✦</p>
                <button onClick={closeAuthor} className="text-xs font-bold px-3 py-1.5 rounded-lg border" style={{ borderColor: HAIRLINE, color: OFFWHITE }}>
                  ✕ Close
                </button>
              </div>

              {authorLoading && (
                <p className="text-sm text-center py-12" style={{ color: MUTED }}>Opening the ledger…</p>
              )}
              {authorError && !authorLoading && (
                <div className="text-center py-12">
                  <p className="text-sm mb-3" style={{ color: MAGENTA }}>{authorError}</p>
                  <button onClick={closeAuthor} className="text-xs underline" style={{ color: MUTED }}>Back to the studio</button>
                </div>
              )}

              {authorView && !authorLoading && (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    {authorView.author.avatarImage ? (
                      <img
                        src={authorView.author.avatarImage}
                        alt={authorView.author.username}
                        className="rounded-xl object-cover"
                        style={{ width: 64, height: 64, border: `2px solid ${LIME}` }}
                      />
                    ) : (
                      <div className="rounded-xl flex items-center justify-center text-2xl" style={{ width: 64, height: 64, backgroundColor: PANEL, border: "2px solid #33303F" }}>
                        ✍️
                      </div>
                    )}
                    <div>
                      <p className="text-xl font-black" style={{ color: OFFWHITE }}>@{authorView.author.username}</p>
                      <p className="text-xs" style={{ color: MUTED }}>
                        {authorView.author.wallet} · {authorView.chapters.length} published chapter{authorView.chapters.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  {authorView.chapters.length === 0 && (
                    <p className="text-sm text-center py-10" style={{ color: MUTED }}>
                      Nothing published yet. The gods are patient — so is the Library.
                    </p>
                  )}

                  {/* THE CAST — every mascot with a chapter on this page. */}
                  {(() => {
                    const cast = [];
                    const seenM = new Set();
                    for (const ch of authorView.chapters) {
                      const m = (authorView.mascots || {})[ch.mint_address];
                      if (!m || seenM.has(ch.mint_address)) continue;
                      seenM.add(ch.mint_address);
                      cast.push({ mint: ch.mint_address, name: ch.character_name, ...m });
                    }
                    if (!cast.length) return null;
                    return (
                      <div className="mb-6">
                        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>The Cast</p>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {cast.map((m) => (
                            <div key={m.mint} className="shrink-0 text-center" style={{ width: 76 }}>
                              {m.image ? (
                                <img
                                  src={m.image}
                                  alt={m.name}
                                  className="rounded-xl object-cover mx-auto"
                                  style={{ width: 72, height: 72, border: `2px solid ${rarityColorMap[m.tier] || HAIRLINE}`, boxShadow: `0 0 12px ${rarityColorMap[m.tier] || "#000"}44` }}
                                />
                              ) : (
                                <div className="rounded-xl mx-auto flex items-center justify-center text-xl" style={{ width: 72, height: 72, backgroundColor: PANEL, border: "2px solid #33303F" }}>🎭</div>
                              )}
                              <p className="text-[10px] font-bold mt-1 truncate" style={{ color: OFFWHITE }}>{m.name}</p>
                              <p className="text-[9px] truncate" style={{ color: rarityColorMap[m.tier] || MUTED }}>
                                {m.markNumber ? `✋ ${m.tier}` : m.tier}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {authorView.chapters.map((ch) => {
                    const m = (authorView.mascots || {})[ch.mint_address] || {};
                    const tierColor = rarityColorMap[m.tier] || HAIRLINE;
                    return (
                    <div key={ch.id} className="mb-6 rounded-xl border overflow-hidden" style={{ backgroundColor: PANEL, borderColor: tierColor + "66" }}>
                      {/* Chapter header — the mascot IS the header. */}
                      <div className="flex items-center gap-3 p-4 pb-3" style={{ background: `linear-gradient(135deg, ${tierColor}22, transparent 60%)` }}>
                        {m.image ? (
                          <img
                            src={m.image}
                            alt={ch.character_name}
                            className="rounded-lg object-cover shrink-0"
                            style={{ width: 52, height: 52, border: `2px solid ${tierColor}` }}
                          />
                        ) : (
                          <div className="rounded-lg shrink-0 flex items-center justify-center text-lg" style={{ width: 52, height: 52, backgroundColor: PANEL2, border: "2px solid #33303F" }}>🎭</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <button onClick={() => openChapter(ch.id)} className="text-sm font-bold truncate text-left" style={{ color: LIME }}>
                              {ch.title}
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => copyLink(`${window.location.origin}/?c=${encodeURIComponent(ch.id)}`, "Chapter")}
                                title="Copy a link to this chapter"
                                className="text-[10px]"
                                style={{ color: "#5EC9FF" }}
                              >🔗</button>
                              <p className="text-[10px]" style={{ color: MUTED }}>
                                {ch.published_at ? new Date(ch.published_at).toLocaleDateString() : ""}
                              </p>
                            </div>
                          </div>
                          <p className="text-[11px] truncate" style={{ color: AMBER }}>
                            {ch.character_name}{ch.chapter_no ? ` · Chapter ${ch.chapter_no}` : ""}{ch.arc_name && ch.arc_name !== ch.character_name ? ` · ${ch.arc_name}` : ""}
                          </p>
                          <p className="text-[10px] truncate">
                            {m.tier && <span style={{ color: rarityColorMap[m.tier] || MUTED }}>{m.god ? "✧ " : ""}{m.tier}{m.season ? ` · S${m.season}` : ""}</span>}
                            {m.universe && <span style={{ color: UNIVERSE_COLORS[m.universe] || MUTED }}> · {UNIVERSE_ICONS[m.universe] || ""} {m.universe}</span>}
                            {m.element && <span style={{ color: MUTED }}> · {m.element}</span>}
                            {m.markNumber && <span style={{ color: "#FFF3B0" }}> · ✋ God-Marked #{m.markNumber}/777</span>}
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-2 p-4 pt-1" style={{ gridTemplateColumns: "1fr" }}>
                        {(ch.panels || []).map((p, j) => (
                          <p key={j} className="text-xs leading-relaxed p-3 rounded-lg" style={{ backgroundColor: PANEL2, color: OFFWHITE }}>
                            {p}
                          </p>
                        ))}
                      </div>
                    </div>
                    );
                  })}

                  {copyMsg && <p className="text-xs text-center mb-2 break-all" style={{ color: "#5EC9FF" }}>{copyMsg}</p>}
                  <button
                    onClick={() => copyLink(`${window.location.origin}/?a=${encodeURIComponent(authorView.author.username)}`, "Author page")}
                    className="w-full py-2.5 rounded-lg text-xs font-bold border mb-4"
                    style={{ borderColor: LIME, color: LIME }}
                  >
                    🔗 COPY LINK TO THIS AUTHOR PAGE
                  </button>

                  <p className="text-center text-xs mt-8 mb-4" style={{ color: MUTED }}>
                    Written in the{" "}
                    <button onClick={() => { closeAuthor(); setTab("studio"); }} className="underline font-bold" style={{ color: LIME }}>
                      MascotGen Story Studio
                    </button>
                    {" "}— every character is a minted original.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {tab === "home" && <HomePage onStart={() => setTab("studio")} onWhitepaper={() => setTab("whitepaper")} />}
        {tab === "library" && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            {/* 📡 VERSE NEWS — the official broadcast, above everything else.
                Player chapters are the world's stories; this is the world's
                newspaper, and it is the only voice here that is OFFICIAL. */}
            {(news.length > 0 || isStudioWallet) && (
              <div className="rounded-xl border mb-5 overflow-hidden" style={{ backgroundColor: PANEL, borderColor: "#5EC9FF55" }}>
                <div className="flex items-center justify-between px-4 py-2" style={{ background: "linear-gradient(90deg, #5EC9FF22, transparent)" }}>
                  <p className="text-xs uppercase tracking-widest font-black" style={{ color: "#5EC9FF" }}>📡 Verse News</p>
                  {isStudioWallet && (
                    <button
                      onClick={() => setNewsComposer((v) => !v)}
                      className="text-[10px] px-2 py-0.5 rounded border font-bold"
                      style={{ borderColor: "#5EC9FF", color: "#5EC9FF" }}
                    >
                      {newsComposer ? "CANCEL" : "+ BROADCAST"}
                    </button>
                  )}
                </div>

                {isStudioWallet && newsComposer && (
                  <div className="p-3 border-t" style={{ borderColor: HAIRLINE }}>
                    <input
                      value={newsTitle}
                      onChange={(e) => setNewsTitle(e.target.value)}
                      placeholder="Headline"
                      className="w-full mb-2 px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: PANEL2, border: "1px solid #33303F", color: OFFWHITE }}
                    />
                    <textarea
                      value={newsBody}
                      onChange={(e) => setNewsBody(e.target.value)}
                      placeholder="The broadcast. Write it the way the world would read it."
                      rows={5}
                      className="w-full mb-2 px-3 py-2 rounded-lg text-xs leading-relaxed"
                      style={{ backgroundColor: PANEL2, border: "1px solid #33303F", color: OFFWHITE }}
                    />
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {["canon", "age", "season", "event", "notice"].map((k) => (
                        <button
                          key={k}
                          onClick={() => setNewsKind(k)}
                          className="text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider"
                          style={{ borderColor: newsKind === k ? "#5EC9FF" : HAIRLINE, color: newsKind === k ? "#5EC9FF" : MUTED }}
                        >{k}</button>
                      ))}
                      <label className="text-[10px] flex items-center gap-1 ml-auto" style={{ color: MUTED }}>
                        <input type="checkbox" checked={newsPinned} onChange={(e) => setNewsPinned(e.target.checked)} /> pin to top
                      </label>
                    </div>
                    <button
                      onClick={postNews}
                      disabled={newsBusy}
                      className="w-full py-2 rounded-lg text-xs font-black"
                      style={{ backgroundColor: "#5EC9FF", color: INK, opacity: newsBusy ? 0.6 : 1 }}
                    >
                      {newsBusy ? "BROADCASTING…" : "📡 BROADCAST TO THE PENTAVERSE"}
                    </button>
                    {newsMsg && <p className="text-[11px] mt-2" style={{ color: "#5EC9FF" }}>{newsMsg}</p>}
                  </div>
                )}

                {news.map((n) => (
                  <div key={n.id} className="px-4 py-3 border-t" style={{ borderColor: HAIRLINE }}>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest" style={{ backgroundColor: "#5EC9FF", color: INK }}>OFFICIAL</span>
                      <span className="text-[9px] uppercase tracking-widest" style={{ color: NEWS_KIND_COLOR[n.kind] || MUTED }}>{n.kind}</span>
                      {n.pinned && <span className="text-[9px]" style={{ color: AMBER }}>📌</span>}
                      <span className="text-[9px] ml-auto" style={{ color: MUTED }}>{n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}</span>
                      {isStudioWallet && (
                        <button onClick={() => deleteNews(n.id)} className="text-[9px]" style={{ color: MAGENTA }} title="Take down">✕</button>
                      )}
                    </div>
                    <p className="text-sm font-bold mb-1" style={{ color: OFFWHITE }}>{n.title}</p>
                    <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: MUTED }}>{n.body}</p>
                  </div>
                ))}
              </div>
            )}

            <h1 className="text-lg font-black mb-1" style={{ color: AMBER }}>📖 The Library</h1>
            <p className="text-xs mb-4" style={{ color: MUTED }}>
              Every chapter published to the Pentaverse, newest first. Tap any chapter to open its author's page —
              or hit <b style={{ color: AMBER }}>START FROM CH. 1</b> on any saga to read it in order from the beginning.
            </p>
            {/* 📤 YOUR UNPUBLISHED CHAPTERS — every chapter you've written that
                the world can't read yet, gathered from every mascot in one
                place. This is the bulk on-ramp: no hunting through each
                Studio one at a time. */}
            {(() => {
              if (!connected || !walletAddress) return null;
              const pending = [];
              for (const c of collection) {
                if (!c.mintAddress) continue;
                // 📖 Origin first — it IS chapter one, and until now it was the
                // only chapter with no way to reach a reader.
                const orig = originChapter(c);
                if (orig && !publishedRow(c, orig)) pending.push({ entry: c, exp: orig, i: -1 });
                (c.expansions || []).forEach((exp, i) => {
                  if (!(exp.panels || []).length) return;
                  if (publishedRow(c, exp)) return;
                  pending.push({ entry: c, exp, i });
                });
              }
              if (!pending.length) return null;
              return (
                <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL, borderColor: AMBER }}>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: AMBER }}>
                    📤 {pending.length} chapter{pending.length === 1 ? "" : "s"} not published yet
                  </p>
                  <p className="text-[11px] mb-3" style={{ color: MUTED }}>
                    {profile && profile.username
                      ? "Written, minted, and invisible. Publish them and they appear here and on your author page."
                      : "Claim your author name to publish these — it's the byline."}
                  </p>
                  {!profile || !profile.username ? (
                    <button
                      onClick={() => { setNameInput(""); setProfileError(""); setProfileOpen(true); }}
                      className="btn-a w-full py-2 rounded-lg text-xs font-bold"
                      style={{ backgroundColor: AMBER, color: INK }}
                    >
                      ✍️ CLAIM YOUR AUTHOR NAME
                    </button>
                  ) : (
                    <>
                      {/* 📖 SAGA MODE — the switch that turns separate character
                          chapters into ONE ordered book. Name the saga, set the
                          part number, and every publish below joins it in order.
                          Leave the name blank to publish chapters as each
                          character's own solo story (the default). */}
                      <div className="rounded-lg border p-3 mb-3" style={{ borderColor: sagaName.trim() ? "#C084FC" : HAIRLINE, background: sagaName.trim() ? "#C084FC11" : "transparent" }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-black tracking-wide" style={{ color: sagaName.trim() ? "#C084FC" : MUTED }}>
                            📖 SAGA MODE {sagaName.trim() ? "· ON" : "· off"}
                          </p>
                          {sagaName.trim() && (
                            <button onClick={() => { setSagaName(""); setSagaNextPart(1); }} className="text-[10px]" style={{ color: MUTED }}>clear</button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={sagaName}
                            onChange={(e) => setSagaName(e.target.value)}
                            placeholder="Saga name (e.g. Something Is Climbing)"
                            maxLength={40}
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded text-xs"
                            style={{ backgroundColor: PANEL2, border: "1px solid #33303F", color: OFFWHITE }}
                          />
                          <input
                            value={sagaNextPart}
                            onChange={(e) => setSagaNextPart(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="#"
                            title="The part number the NEXT publish gets — it ticks up automatically after each one."
                            className="w-14 text-center px-2 py-1.5 rounded text-xs"
                            style={{ backgroundColor: PANEL2, border: "1px solid #33303F", color: "#C084FC", fontWeight: 800 }}
                          />
                        </div>
                        <p className="text-[10px] mt-2 leading-relaxed" style={{ color: MUTED }}>
                          {sagaName.trim()
                            ? `Next chapter you publish becomes ${sagaName.trim()} · Part ${Number(sagaNextPart) || 1}. Publish the main plot in the order your bible lists — the number ticks up on its own.`
                            : "Off: each chapter publishes as its own character's story. Turn on to build one ordered book across many characters."}
                        </p>
                      </div>
                      {pending.slice(0, 12).map((p, k) => (
                        <div key={`${p.entry.id}-${p.i}`} className="flex items-center gap-2 py-1.5 border-t" style={{ borderColor: HAIRLINE }}>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate" style={{ color: OFFWHITE }}>{p.exp.title}</p>
                            <p className="text-[10px] truncate" style={{ color: MUTED }}>
                              {p.exp.__origin ? "⭐ Chapter 1 · " : ""}{p.entry.result?.characterName} · {(p.exp.panels || []).length} panels
                            </p>
                          </div>
                          <button
                            onClick={async () => { await publishChapter(p.entry, p.exp, `lib-${k}`); }}
                            disabled={publishing === `lib-${k}`}
                            className="text-[10px] px-2.5 py-1 rounded border shrink-0 font-bold"
                            style={{ borderColor: "#5EC9FF", color: "#5EC9FF", opacity: publishing === `lib-${k}` ? 0.5 : 1 }}
                          >
                            {publishing === `lib-${k}` ? "…" : "📖 PUBLISH"}
                          </button>
                        </div>
                      ))}
                      {pending.length > 12 && (
                        <p className="text-[10px] mt-2" style={{ color: MUTED }}>
                          …and {pending.length - 12} more. Publish these, and the rest appear.
                        </p>
                      )}
                      {publishMsg && <p className="text-[11px] mt-2" style={{ color: "#5EC9FF" }}>{publishMsg}</p>}
                    </>
                  )}
                </div>
              );
            })()}

            {/* 📚 YOUR PUBLISHED CHAPTERS — every live chapter in one place,
                with a take-down button on each.
                WHY THIS EXISTS: the only unpublish button used to live on a
                Studio EXPANSION row, and an origin story is not an expansion —
                so once origins became publishable there was no way to take one
                back down. This also happens to be the panel you need when
                re-ordering a saga: take chapters down here, flip Saga Mode on,
                and republish them in order without hunting through the Studio.
                Taking a chapter down removes it from the public Library only.
                The writing stays in your canon and can be republished any time. */}
            {connected && walletAddress && (published || []).length > 0 && (
              <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL, borderColor: "#5EC9FF55" }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#5EC9FF" }}>
                  📚 {published.length} chapter{published.length === 1 ? "" : "s"} live
                </p>
                <p className="text-[11px] mb-3" style={{ color: MUTED }}>
                  Taking one down removes it from the public Library — the writing stays in your canon and you can republish it any time.
                </p>
                {[...published]
                  .sort((a, b) => (a.arc_name || "").localeCompare(b.arc_name || "") || (a.chapter_no || 0) - (b.chapter_no || 0))
                  .map((row) => (
                    <div key={row.id} className="flex items-center gap-2 py-1.5 border-t" style={{ borderColor: HAIRLINE }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate" style={{ color: OFFWHITE }}>{row.title}</p>
                        <p className="text-[10px] truncate" style={{ color: MUTED }}>
                          {row.arc_name && row.arc_name !== row.character_name
                            ? <span style={{ color: "#C084FC" }}>📖 {row.arc_name} · Part {row.chapter_no} — </span>
                            : row.chapter_no ? `Ch. ${row.chapter_no} · ` : ""}
                          {row.character_name}
                        </p>
                      </div>
                      <button
                        onClick={() => unpublishChapter(row, `un-${row.id}`)}
                        disabled={publishing === `un-${row.id}`}
                        className="text-[10px] px-2.5 py-1 rounded border shrink-0 font-bold"
                        style={{ borderColor: MAGENTA, color: MAGENTA, opacity: publishing === `un-${row.id}` ? 0.5 : 1 }}
                        title="Remove from the public Library — your writing is kept"
                      >
                        {publishing === `un-${row.id}` ? "…" : "TAKE DOWN"}
                      </button>
                    </div>
                  ))}
                {publishMsg && <p className="text-[11px] mt-2" style={{ color: "#5EC9FF" }}>{publishMsg}</p>}
              </div>
            )}

            <input
              value={libSearch}
              onChange={(e) => setLibSearch(e.target.value)}
              placeholder="Search by mascot, title, or @author…"
              className="w-full px-3 py-2 rounded-lg text-sm border bg-transparent mb-4"
              style={{ borderColor: HAIRLINE, color: OFFWHITE }}
            />
            {libLoading && <p className="text-sm text-center py-10" style={{ color: MUTED }}>Opening the shelves…</p>}
            {libError && !libLoading && <p className="text-sm text-center py-10" style={{ color: MAGENTA }}>{libError}</p>}
            {libRows && !libLoading && libRows.length === 0 && (
              <p className="text-sm text-center py-10" style={{ color: MUTED }}>
                The shelves are empty — no one has published a chapter yet. The first saga in the Library is a title someone gets to keep forever.
              </p>
            )}
            {libRows && !libLoading && libRows.length > 0 && (() => {
              const q = libSearch.trim().toLowerCase();
              const rows = q
                ? libRows.filter((c) =>
                    [c.character, c.title, c.arc, c.author && `@${c.author}`]
                      .filter(Boolean)
                      .some((s) => String(s).toLowerCase().includes(q))
                  )
                : libRows;
              if (!rows.length) return <p className="text-sm text-center py-10" style={{ color: MUTED }}>Nothing matches "{libSearch}".</p>;
              return rows.map((c) => {
                const tierColor = rarityColorMap[c.tier] || HAIRLINE;
                return (
                <button
                  key={c.id}
                  onClick={() => openChapter(c.id)}
                  className="w-full text-left mb-3 rounded-xl border p-3"
                  style={{ backgroundColor: PANEL, borderColor: tierColor + "55" }}
                >
                  <div className="flex gap-3">
                    {c.image ? (
                      <img
                        src={c.image}
                        alt={c.character}
                        className="rounded-lg object-cover shrink-0"
                        style={{ width: 56, height: 56, border: `2px solid ${tierColor}` }}
                      />
                    ) : (
                      <div className="rounded-lg shrink-0 flex items-center justify-center text-xl" style={{ width: 56, height: 56, backgroundColor: PANEL2, border: "2px solid #33303F" }}>🎭</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <p className="text-sm font-bold truncate" style={{ color: LIME }}>{c.title}</p>
                        <p className="text-[10px] shrink-0" style={{ color: MUTED }}>
                          {c.publishedAt ? new Date(c.publishedAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                      {/* A saga tag when this chapter is part of a multi-character book. */}
                      {c.sagaName && (
                        <p className="text-[10px] mb-0.5 truncate font-bold" style={{ color: "#C084FC" }}>
                          📖 {c.sagaName} · Part {c.chapterNo}
                        </p>
                      )}
                      <p className="text-[11px] mb-1 truncate" style={{ color: AMBER }}>
                        {c.character}
                        {c.tier && <span style={{ color: rarityColorMap[c.tier] || MUTED }}> · {c.tier}</span>}
                        {c.universe && <span style={{ color: UNIVERSE_COLORS[c.universe] || MUTED }}> · {UNIVERSE_ICONS[c.universe] || ""} {c.universe}</span>}
                        {!c.sagaName && c.chapterNo ? ` · Ch. ${c.chapterNo}` : ""} · {c.panelCount} panel{c.panelCount === 1 ? "" : "s"}
                        {c.author && (
                          <span
                            onClick={(ev) => { ev.stopPropagation(); openAuthor(c.author); }}
                            style={{ color: "#5EC9FF", cursor: "pointer" }}
                          > · by @{c.author}</span>
                        )}
                      </p>
                      {c.sagaName ? (
                        <button
                          onClick={(ev) => { ev.stopPropagation(); openChapter(c.sagaFirstId || c.id); }}
                          className="text-[10px] px-2 py-0.5 rounded border mb-1 font-bold"
                          style={{ borderColor: "#C084FC", color: "#C084FC" }}
                          title={`Read ${c.sagaName} from Part 1`}
                        >
                          📖 READ THE SAGA FROM PART 1
                        </button>
                      ) : c.chapterNo > 1 ? (
                        <button
                          onClick={(ev) => { ev.stopPropagation(); openSagaFromStart(c.mintAddress); }}
                          className="text-[10px] px-2 py-0.5 rounded border mb-1 font-bold"
                          style={{ borderColor: AMBER, color: AMBER }}
                          title="Jump to Chapter 1 of this mascot's saga"
                        >
                          📖 START FROM CH. 1
                        </button>
                      ) : null}
                      {c.preview && (
                        <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                          {c.preview}{c.preview.length >= 220 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
                );
              });
            })()}
          </div>
        )}
        {tab === "market" && (
          <div className="max-w-4xl mx-auto">
            <h1 className="text-xl font-bold mb-1" style={{ color: LIME }}>🏪 The Market</h1>
            <p className="text-sm mb-4" style={{ color: MUTED }}>
              Every mascot ever minted in the Pentaverse. Trading happens on Solana marketplaces — list or buy on Magic Eden or Tensor, and the card's story travels with it.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <input
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                placeholder="Search by name…"
                className="px-3 py-2 rounded-lg text-xs border bg-transparent flex-1 min-w-[160px]"
                style={{ borderColor: HAIRLINE, color: OFFWHITE }}
              />
              {["All", "Super Legendary", "Legendary", "Epic", "Rare", "Common"].map((t) => (
                <button
                  key={t}
                  onClick={() => setMarketFilter(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                  style={{
                    borderColor: marketFilter === t ? (rarityColorMap[t] || LIME) : HAIRLINE,
                    color: marketFilter === t ? (rarityColorMap[t] || LIME) : MUTED,
                  }}
                >
                  {t === "Super Legendary" ? "✧ Gods" : t}
                </button>
              ))}
            </div>
            {galleryError && (
              <div className="rounded-xl border p-4 mb-4" style={{ borderColor: MAGENTA }}>
                <p className="text-sm" style={{ color: MAGENTA }}>{galleryError}</p>
                <button onClick={loadGallery} className="mt-2 px-4 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: MAGENTA, color: MAGENTA }}>↻ TRY AGAIN</button>
              </div>
            )}
            {!gallery && !galleryError && (
              <p className="text-sm flex items-center gap-2" style={{ color: MUTED }}><Loader2 size={14} className="animate-spin" /> Opening the market…</p>
            )}
            {gallery && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {gallery
                  .filter((m) => marketFilter === "All" || m.tier === marketFilter)
                  .filter((m) => !marketSearch || (m.name || "").toLowerCase().includes(marketSearch.toLowerCase()))
                  .map((m, mi) => m.sealed ? (
                    <div key={`sealed-${mi}`} className="rounded-xl border overflow-hidden flex flex-col" style={{ backgroundColor: PANEL, borderColor: "#C084FC", boxShadow: "0 0 14px rgba(192,132,252,0.25)" }}>
                      <div className="aspect-square w-full flex items-center justify-center" style={{ backgroundColor: "#0E0C12" }}>
                        <span className="text-4xl" style={{ filter: "drop-shadow(0 0 10px rgba(192,132,252,0.6))" }}>🔒</span>
                      </div>
                      <div className="p-2 flex-1 flex flex-col">
                        <p className="text-xs font-bold" style={{ color: "#C084FC" }}>✧ ??? — SEALED</p>
                        <p className="text-[10px] mb-1" style={{ color: rarityColorMap["Super Legendary"] }}>Super Legendary</p>
                        <p className="text-[10px]" style={{ color: MUTED, fontStyle: "italic" }}>
                          The twelfth throne walks the market as a rumor. Not for sale. Not for viewing. Not yet.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div key={m.mint} className="rounded-xl border overflow-hidden flex flex-col" style={{ backgroundColor: PANEL, borderColor: rarityColorMap[m.tier] || HAIRLINE }}>
                      <div className="aspect-square w-full cursor-pointer" style={{ backgroundColor: "#0E0C12" }} onClick={() => setMarketCard(m)} title="View full battle card">
                        {m.image ? (
                          <img src={m.image} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: MUTED }}>no image</div>
                        )}
                      </div>
                      <div className="p-2 flex-1 flex flex-col">
                        <p className="text-xs font-bold truncate" style={{ color: OFFWHITE }}>
                          {m.god && "✧ "}{m.name}{m.returns > 0 && <span style={{ color: LIME }}> ⟲</span>}
                        </p>
                        <p className="text-[10px] mb-1" style={{ color: rarityColorMap[m.tier] || MUTED }}>
                          {m.tier}{m.season ? ` · S${m.season}` : ""}{m.universe ? ` · ${m.universe}` : ""}
                        </p>
                        <p className="text-[10px] mb-2" style={{ color: MUTED }}>
                          {m.owner ? `${m.owner.slice(0, 4)}..${m.owner.slice(-4)}` : "—"}
                          {walletAddress && m.owner === walletAddress && <span style={{ color: LIME }}> · YOU</span>}
                        </p>
                        {m.author && (
                          <button
                            onClick={() => openAuthor(m.author)}
                            className="w-full text-center py-1 mb-1 rounded text-[10px] font-bold border"
                            style={{ borderColor: "#5EC9FF", color: "#5EC9FF" }}
                            title={`Read ${m.name}'s saga on @${m.author}'s page`}
                          >
                            📖 READ THE SAGA ({m.chapters})
                          </button>
                        )}
                        <button
                          onClick={() => setMarketCard(m)}
                          className="w-full text-center py-1 mb-1 rounded text-[10px] font-bold border"
                          style={{ borderColor: LIME, color: LIME }}
                        >
                          ⚔️ FULL CARD
                        </button>
                        <div className="mt-auto flex gap-1">
                          <a href={`https://magiceden.io/item-details/${m.mint}`} target={EXT_TAB} rel="noreferrer" className="flex-1 text-center py-1 rounded text-[10px] font-bold" style={{ backgroundColor: "#E42575", color: "#fff" }}>Magic Eden</a>
                          <a href={`https://www.tensor.trade/item/${m.mint}`} target={EXT_TAB} rel="noreferrer" className="flex-1 text-center py-1 rounded text-[10px] font-bold" style={{ backgroundColor: "#1B1B1F", color: "#fff", border: "1px solid #33303F" }}>Tensor</a>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            <p className="text-xs mt-4" style={{ color: "#6B6880" }}>
              MascotGen does not operate a marketplace or hold funds — listings, offers, and sales happen entirely on third-party platforms. NFTs are collectibles, not investments.
            </p>
            {/* ⚔️ FULL CARD — the same battle-card the arena fights with,
                computed live from the mint's traits by the same computeStats. */}
            {marketCard && (() => {
              const mc = marketCard;
              const mstats = mc.traits
                ? computeStats(
                    { ...mc.traits, characterName: mc.name, element: mc.element || undefined },
                    mc.tier || null, mc.markedBy || null, mc.ageCard || null, mc.ageNumber || null,
                    !mc.universe // ⏳ Elder — minted with no universe
                  )
                : null;
              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.82)" }} onClick={() => setMarketCard(null)}>
                  <div
                    className="rounded-2xl border max-w-sm w-full max-h-[90vh] overflow-y-auto"
                    style={{ backgroundColor: PANEL, borderColor: rarityColorMap[mc.tier] || HAIRLINE, boxShadow: `0 0 30px ${(rarityColorMap[mc.tier] || "#5EC9FF")}44` }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {mc.image && <img src={mc.image} alt={mc.name} className="w-full aspect-square object-cover rounded-t-2xl" />}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-black" style={{ color: OFFWHITE }}>{mc.god && "✧ "}{mc.name}</p>
                        <button onClick={() => setMarketCard(null)} className="text-sm px-2" style={{ color: MUTED }}>✕</button>
                      </div>
                      <p className="text-xs mb-3" style={{ color: rarityColorMap[mc.tier] || MUTED }}>
                        {mc.tier}{mc.season ? ` · S${mc.season}` : ""}{mc.universe ? ` · ${mc.universe}` : " · ⏳ Genesis Era"}
                        {mstats && mstats.element ? ` · ${mstats.element.icon} ${mstats.element.id}` : mc.element ? ` · ${mc.element}` : ""}
                      </p>
                      {mstats ? (
                        <>
                          {[["PWR", mstats.power], ["HP", mstats.hp], ["SPD", mstats.speed], ["SPC", mstats.special]].map(([l, v]) => (
                            <div key={l} className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] w-7 mono" style={{ color: MUTED }}>{l}</span>
                              <div className="flex gap-[2px] flex-1">
                                {Array.from({ length: 10 }, (_, i) => (
                                  <div key={i} className="h-2 flex-1 rounded-sm" style={{ backgroundColor: i < v ? (v > 7 ? "#FFD700" : LIME) : "#1C1728", boxShadow: i < v ? `0 0 4px ${v > 7 ? "#FFD700" : LIME}66` : "none" }} />
                                ))}
                              </div>
                              <span className="text-xs font-black w-6 text-right mono" style={{ color: v > 7 ? "#FFD700" : OFFWHITE }}>{v}</span>
                            </div>
                          ))}
                          <p className="text-xs mt-2 mb-2" style={{ color: MUTED }}>
                            Battle HP <span className="mono font-black" style={{ color: "#4DFF88" }}>{mstats.hpPoints}</span>
                            {mc.markNumber ? <span style={{ color: "#C084FC" }}> · ✋ God-Marked #{mc.markNumber}</span> : null}
                            {mc.ageCard ? <span style={{ color: AMBER }}> · ⏳ {String(mc.ageCard).replace(/_/g, " ")}{mc.ageNumber ? ` #${mc.ageNumber}` : ""}</span> : null}
                          </p>
                          {[...(mstats.signatures || []), ...(mstats.abilities || [])].slice(0, 7).map((a, i) => (
                            <div key={i} className="flex items-center justify-between mb-1 gap-2">
                              <span className="text-xs" style={{ color: OFFWHITE }}>{a.icon} <span style={{ fontWeight: 700 }}>{a.name}</span></span>
                              <span className="text-[10px] font-bold text-right" style={{ color: "#5EC9FF" }}>{a.label || ""}</span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <p className="text-xs" style={{ color: MUTED }}>This card predates trait records — its numbers live on-chain.</p>
                      )}
                      {mc.chapters > 0 && (
                        <p className="text-xs mt-2" style={{ color: LIME }}>📖 {mc.chapters} chapter{mc.chapters === 1 ? "" : "s"} published{mc.author ? ` · by @${mc.author}` : ""}</p>
                      )}
                      <div className="flex gap-1 mt-3">
                        <a href={`https://magiceden.io/item-details/${mc.mint}`} target={EXT_TAB} rel="noreferrer" className="flex-1 text-center py-2 rounded text-xs font-bold" style={{ backgroundColor: "#E42575", color: "#fff" }}>Magic Eden</a>
                        <a href={`https://www.tensor.trade/item/${mc.mint}`} target={EXT_TAB} rel="noreferrer" className="flex-1 text-center py-2 rounded text-xs font-bold" style={{ backgroundColor: "#1B1B1F", color: "#fff", border: "1px solid #33303F" }}>Tensor</a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {tab === "stats" && (
          <div className="max-w-3xl mx-auto">
            <h1 className="text-xl font-bold mb-1" style={{ color: LIME }}>📊 The Pentaverse in Numbers</h1>
            <p className="text-sm mb-5" style={{ color: MUTED }}>
              Every figure below is live from the chain and the arena. Nothing here is projected, rounded up, or wishful.
            </p>

            {statsLoading && !ecoStats && (
              <p className="text-sm flex items-center gap-2" style={{ color: MUTED }}><Loader2 size={14} className="animate-spin" /> Counting the universes…</p>
            )}

            {statsError && !ecoStats && (
              <div className="rounded-xl border p-4" style={{ borderColor: MAGENTA, backgroundColor: "rgba(255,62,165,0.06)" }}>
                <p className="text-sm" style={{ color: MAGENTA }}>{statsError}</p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>
                  If this says "Unknown action", the deployed api/battle.js is an older version — re-upload the latest one.
                </p>
                <button onClick={loadStats} className="mt-2 px-4 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: MAGENTA, color: MAGENTA }}>
                  ↻ TRY AGAIN
                </button>
              </div>
            )}

            {ecoStats && (
              <>
                {/* Headline numbers */}
                {/* Five tiles, one even row on desktop (2-2-1 stack on phones,
                    with the odd tile spanning full width so nothing floats). */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                  {[
                    ["MASCOTS MINTED", ecoStats.totals.mints, LIME],
                    ["HOLDERS", ecoStats.totals.holders, "#5EC9FF"],
                    ["BATTLES FOUGHT", ecoStats.totals.battles, MAGENTA],
                    ["MIRROR CROSSINGS", ecoStats.totals.mirrors || 0, "#C8CDD6"],
                    ["THRONES SEATED", `${ecoStats.totals.thronesSeated}/${ecoStats.totals.thronesTotal}`, "#FF9DF2"],
                  ].map(([label, value, color], ti) => (
                    <div key={label} className={`rounded-xl border p-3 text-center ${ti === 4 ? "col-span-2 md:col-span-1" : ""}`} style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
                      <p className="text-2xl font-black" style={{ color }}>{value}</p>
                      <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: MUTED }}>{label}</p>
                    </div>
                  ))}
                </div>

                {/* Founding 333 */}
                <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL, borderColor: ecoStats.founding.complete ? HAIRLINE : AMBER }}>
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-xs uppercase tracking-widest" style={{ color: AMBER }}>⭐ The Founding 333</p>
                    <p className="text-xs font-black" style={{ color: AMBER }}>
                      {ecoStats.founding.claimed} / {ecoStats.founding.target}
                    </p>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(ecoStats.founding.claimed / ecoStats.founding.target) * 100}%`,
                        background: "linear-gradient(90deg,#FFB627,#FFF3B0)",
                        boxShadow: "0 0 12px rgba(255,182,39,0.7)",
                      }}
                    />
                  </div>
                  <p className="text-xs mt-2" style={{ color: MUTED }}>
                    {ecoStats.founding.complete
                      ? "The Founding is closed. These 333 are the oldest cards in existence."
                      : `The first 333 mints in MascotGen history are ALL Legendary. ${ecoStats.founding.remaining} seats remain — then the door closes forever.`}
                  </p>
                </div>

                {/* ⏳ THE AGES — every promised milestone, always visible, always
                    counting. Nothing about a future age should ever be a
                    surprise: if it's in the whitepaper it's on this page, with
                    the exact distance to it. */}
                {ecoStats.ages && ecoStats.ages.length > 0 && (
                  <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL, borderColor: "#C084FC" }}>
                    <div className="flex items-baseline justify-between mb-1">
                      <p className="text-xs uppercase tracking-widest" style={{ color: "#C084FC" }}>⏳ The Ages</p>
                      {ecoStats.nextAge && (
                        <p className="text-[10px] font-black" style={{ color: "#C084FC" }}>
                          NEXT IN {ecoStats.nextAge.remaining.toLocaleString()} MINTS
                        </p>
                      )}
                    </div>
                    <p className="text-[11px] mb-3" style={{ color: MUTED }}>
                      Ages arrive on cumulative mints ever created — Fusion burns never move the counter backwards.
                    </p>
                    {ecoStats.ages.map((a) => (
                      <div key={a.key} className="mb-3 last:mb-0">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <p className="text-xs font-bold truncate" style={{ color: a.reached ? LIME : OFFWHITE }}>
                            {a.icon} {a.name}
                          </p>
                          <p className="text-[10px] shrink-0 font-black" style={{ color: a.reached ? LIME : MUTED }}>
                            {a.reached ? "ARRIVED" : `${ecoStats.totals.mints.toLocaleString()} / ${a.at.toLocaleString()}`}
                          </p>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.07)" }}>
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.max(0.6, a.pct)}%`,
                              background: a.reached ? `linear-gradient(90deg,${LIME},#BFFF6A)` : "linear-gradient(90deg,#C084FC,#FF9DF2)",
                            }}
                          />
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: MUTED }}>
                          <span style={{ color: a.reached ? LIME : "#C084FC" }}>{a.supply} cards · {a.hp} Battle HP</span>
                          {" — "}{a.blurb}
                        </p>
                        {a.reached && a.issued !== null && (
                          <p className="text-[10px] mt-0.5 font-bold" style={{ color: "#FFD700" }}>
                            {a.key.startsWith("champion")
                              ? `${a.snapshotTaken ? "✓ cut snapshotted · " : ""}${a.issued} of 300 public cards rolled · ${Math.max(0, 300 - a.issued)} remain`
                              : `${a.issued} of ${a.cardCap} in circulation · ${Math.max(0, a.cardCap - a.issued)} remain`}
                          </p>
                        )}
                      </div>
                    ))}
                    {/* The tease beyond the last milestone. Deliberately vague —
                        a rumor, not a roadmap. Never name what waits below. */}
                    <p className="text-[10px] mt-3 pt-2 italic" style={{ color: "#5A5670", borderTop: "1px solid #26232F" }}>
                      …and the counter does not stop at 111,111. The oldest layer of the prophecy numbers
                      rooms beneath Purgatory — seven of them, each deeper than the last. Nothing that pays
                      rent down there has agreed to be described.
                    </p>
                  </div>
                )}

                {/* ✋ The God-Marked — the second capped door, and the one that
                    stays open for years. ALWAYS visible: the whitepaper promises
                    a live counter, and 777/777 remaining is the whole tease. */}
                {ecoStats.marked && (
                  <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL, borderColor: ecoStats.marked.claimed >= 777 ? HAIRLINE : "#FFF3B0" }}>
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-xs uppercase tracking-widest" style={{ color: "#FFF3B0" }}>✋ The God-Marked</p>
                      <p className="text-xs font-black" style={{ color: "#FFF3B0" }}>
                        {ecoStats.marked.claimed} / 777
                      </p>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, (ecoStats.marked.claimed / 777) * 100)}%`,
                          background: "linear-gradient(90deg,#FFF3B0,#FFFFFF)",
                          boxShadow: "0 0 12px rgba(255,243,176,0.7)",
                        }}
                      />
                    </div>
                    <p className="text-xs mt-2" style={{ color: MUTED }}>
                      {ecoStats.marked.claimed >= 777
                        ? "The gods have stopped marking. All 777 marks are spoken for, forever."
                        : ecoStats.marked.claimed === 0
                        ? "Mortals touched by one of the Twelve. Every paid mint rolls a 0.1% chance. 777 will ever exist — none have been claimed. The gods are still deciding."
                        : `Mortals touched by one of the Twelve. 777 will ever exist — ${777 - ecoStats.marked.claimed} marks remain.`}
                    </p>
                  </div>
                )}

                {/* Rarity + universes */}
                <div className="grid md:grid-cols-2 gap-3 mb-4">
                  {[["Rarity", ecoStats.rarity, rarityColorMap], ["Universe", ecoStats.universes, UNIVERSE_COLORS]].map(([title, list, colorMap]) => (
                    <div key={title} className="rounded-xl border p-4" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
                      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: LIME }}>{title}</p>
                      {list.map((row) => (
                        <div key={row.name} className="mb-2">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span style={{ color: (colorMap && colorMap[row.name]) || OFFWHITE }}>{row.name}</span>
                            <span style={{ color: MUTED }}>{row.count} · {row.pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.07)" }}>
                            <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: (colorMap && colorMap[row.name]) || LIME }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Archetype bubbles */}
                <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
                  <p className="text-xs uppercase tracking-widest mb-3" style={{ color: LIME }}>Most-summoned archetypes</p>
                  <div className="flex flex-wrap items-end gap-3 justify-center">
                    {ecoStats.archetypes.map((a, i) => {
                      const size = Math.max(46, Math.min(104, 46 + a.pct * 1.6));
                      return (
                        <div key={a.name} className="flex flex-col items-center" style={{ width: size }}>
                          <div
                            className="rounded-full flex items-center justify-center"
                            style={{
                              width: size,
                              height: size,
                              background: `radial-gradient(circle at 35% 30%, ${i === 0 ? "#C6FF3D" : i === 1 ? "#5EC9FF" : i === 2 ? "#FF3EA5" : "#8B5CF6"}33, transparent 70%)`,
                              border: `2px solid ${i === 0 ? "#C6FF3D" : i === 1 ? "#5EC9FF" : i === 2 ? "#FF3EA5" : "#8B5CF6"}`,
                            }}
                          >
                            <span className="text-xs font-black" style={{ color: OFFWHITE }}>{a.pct}%</span>
                          </div>
                          <span className="text-[10px] mt-1 text-center leading-tight" style={{ color: MUTED }}>{a.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* The pantheon */}
                <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL, borderColor: "#FF9DF2" }}>
                  <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#FF9DF2" }}>✧ The Pantheon</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {ecoStats.thrones.map((t) => (
                      <div key={t.n} className="flex items-center justify-between text-xs py-1">
                        <span style={{ color: t.status === "seated" ? OFFWHITE : MUTED }}>
                          <span className="font-black mr-2" style={{ color: t.status === "sealed" ? "#C084FC" : "#FF9DF2" }}>#{t.n}</span>
                          {t.status === "seated" ? t.name : t.status === "sealed" ? <span style={{ color: "#C084FC", fontStyle: "italic" }}>??? — occupied</span> : <span style={{ fontStyle: "italic" }}>??? — unclaimed</span>}
                        </span>
                        <span style={{ color: t.status === "seated" ? (UNIVERSE_COLORS && UNIVERSE_COLORS[t.universe]) || MUTED : "#3D3A47" }}>
                          {t.status === "seated" ? t.universe || "—" : t.status === "sealed" ? "SEALED" : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: MUTED }}>
                    {ecoStats.totals.thronesUnclaimed} of the twelve thrones still await a claimant — every paid mint carries a 0.01% chance of ascension.
                    {ecoStats.thrones.some((t) => t.status === "sealed") && (
                      <> <span style={{ color: "#C084FC" }}>One throne is occupied by a name the Pentaverse has not agreed to speak. Nobody who has seen it will say more.</span></>
                    )}
                  </p>
                </div>

                {/* ⚰️ The Graveyard */}
                {ecoStats.graveyard && (
                  <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL, borderColor: "#4A4757" }}>
                    <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#8B87A0" }}>⚰️ The Graveyard</p>
                    <p className="text-xs mb-3" style={{ color: MUTED }}>
                      Mascots silent for 30 days drift out of the living Pentaverse. Empyrion-born rest above the cosmic waterfall; the lower four wait in Purgatory. <span style={{ color: OFFWHITE }}>Nothing is ever deleted</span> — one battle or one new chapter brings any of them back.
                    </p>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        ["DORMANT", ecoStats.graveyard.total, "#8B87A0"],
                        ["IN PURGATORY", ecoStats.graveyard.inPurgatory, "#C084FC"],
                        ["RETURNED", ecoStats.graveyard.returned, LIME],
                      ].map(([label, value, color]) => (
                        <div key={label} className="rounded-lg p-2 text-center" style={{ backgroundColor: PANEL2 }}>
                          <p className="text-lg font-black" style={{ color }}>{value}</p>
                          <p className="text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>{label}</p>
                        </div>
                      ))}
                    </div>
                    {ecoStats.graveyard.total === 0 ? (
                      <p className="text-xs" style={{ color: MUTED }}>
                        The Graveyard is empty. Every mascot ever minted is still walking.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {ecoStats.graveyard.residents.map((r) => (
                          <div key={r.name} className="flex items-center justify-between text-xs py-1" style={{ borderTop: "1px solid #26232F" }}>
                            <span style={{ color: MUTED }}>
                              {r.name}
                              {r.returns > 0 && <span title={`Returned ${r.returns}x`} style={{ color: LIME }}> ⟲{r.returns}</span>}
                            </span>
                            <span style={{ color: r.place === "At Rest" ? "#FFF3B0" : "#C084FC" }}>
                              {r.place} · {r.days}d
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Arena leaderboard */}
                <div className="rounded-xl border p-4" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
                  <p className="text-xs uppercase tracking-widest mb-2" style={{ color: LIME }}>🏆 Arena — the Champion cut (top 22)</p>
                  <p className="text-xs mb-2" style={{ color: MUTED }}>When the 11,111th soul enters the Pentaverse, the top 22 fighters on this board are raised — joined by the top 11 drivers from the Grand Circuit below. All 33 receive a ⚜️ CHAMPION card minted on the house, numbered 1-33, never repeated. Eligibility: 20+ rated battles against 8+ different opponents.</p>
                  {ecoStats.leaderboard.length === 0 && <p className="text-sm" style={{ color: MUTED }}>No rated battles yet.</p>}
                  {ecoStats.leaderboard.map((r, i) => (
                    <div key={r.wallet} className="flex items-center justify-between py-1.5 text-xs" style={{ borderTop: i > 0 ? "1px solid #26232F" : "none" }}>
                      <span style={{ color: OFFWHITE }}>
                        <span className="font-black mr-2" style={{ color: i === 0 ? "#FFD700" : i === 1 ? "#C8CDD6" : i === 2 ? "#CD7F32" : MUTED }}>#{i + 1}</span>
                        {r.wallet === walletAddress ? "⭐ YOU" : `${r.wallet.slice(0, 4)}..${r.wallet.slice(-4)}`}
                      </span>
                      <span style={{ color: MUTED }}>
                        <span style={{ color: AMBER, fontWeight: 800 }}>{r.rating}</span> · {r.wins}W-{r.losses}L
                      </span>
                    </div>
                  ))}
                </div>

                {/* 🏁 The racing ladder — its own board, its own cut. */}
                <div className="rounded-xl border p-4 mt-4" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
                  <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#5EC9FF" }}>🏁 Grand Circuit — the drivers' board (top 11)</p>
                  <p className="text-xs mb-2" style={{ color: MUTED }}>
                    Racing keeps a separate ladder — a great fighter isn't automatically a great driver. The top 11 here take the remaining Champion seats alongside the arena's 22. Eligibility: 15+ rated races against 6+ different rivals.
                  </p>
                  {(!ecoStats.raceLeaderboard || ecoStats.raceLeaderboard.length === 0) && (
                    <p className="text-sm" style={{ color: MUTED }}>No rated races yet.</p>
                  )}
                  {(ecoStats.raceLeaderboard || []).map((r, i) => (
                    <div key={r.wallet} className="flex items-center justify-between py-1.5 text-xs" style={{ borderTop: i > 0 ? "1px solid #26232F" : "none" }}>
                      <span style={{ color: OFFWHITE }}>
                        <span className="font-black mr-2" style={{ color: i === 0 ? "#FFD700" : i === 1 ? "#C8CDD6" : i === 2 ? "#CD7F32" : MUTED }}>#{i + 1}</span>
                        {r.wallet === walletAddress ? "⭐ YOU" : `${r.wallet.slice(0, 4)}..${r.wallet.slice(-4)}`}
                      </span>
                      <span style={{ color: MUTED }}>
                        <span style={{ color: "#5EC9FF", fontWeight: 800 }}>{r.rating}</span> · {r.wins}W-{r.losses}L
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "battle" && (
          <div className="max-w-3xl mx-auto">
            <h1 className="text-xl font-bold mb-1" style={{ color: MAGENTA }}>⚔️ Battle Arena <span className="text-xs px-2 py-0.5 rounded align-middle" style={{ backgroundColor: MAGENTA, color: INK }}>BETA</span></h1>
            <p className="text-sm mb-5" style={{ color: MUTED }}>
              Ghost battles: pick up to 7 of your MINTED mascots, challenge any wallet (or a random rival), and the arena simulates the whole fight with your cards' real stats, elements, abilities — and god powers. The rival fields a squad the same size as yours. Ratings are Elo-based: beating stronger wallets pays more, farming the same rival pays less. Losing never affects your NFT or your character's story.
            </p>

            {/* 🥊 MANUAL PVP (BETA) */}
            <div className="rounded-xl border p-4 mb-5" style={{ backgroundColor: PANEL, borderColor: "#FF9F1C" }}>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#FF9F1C" }}>
                🥊 Manual PvP <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ backgroundColor: "#FF9F1C", color: INK }}>BETA · UNRATED</span>
              </p>
              <p className="text-[11px] mb-3" style={{ color: MUTED }}>
                Turn-by-turn against a real person — every move is a decision, not a simulation. Unrated while in beta, so the Champion ladders stay pure. 24h per move, then the waiting player can claim the win.
              </p>

              {!connected && <p className="text-xs" style={{ color: MUTED }}>Connect your wallet to duel.</p>}

              {connected && !pvpView && (
                <>
                  <div className="flex gap-2 flex-wrap mb-2">
                    <select
                      value={pvpMint}
                      onChange={(e) => setPvpMint(e.target.value)}
                      className="px-2 py-1.5 rounded-lg text-xs border bg-transparent"
                      style={{ borderColor: HAIRLINE, color: OFFWHITE, backgroundColor: PANEL }}
                    >
                      <option value="">Pick your fighter…</option>
                      {collection.filter((c) => c.mintAddress).map((c) => (
                        <option key={c.mintAddress} value={c.mintAddress}>{c.result?.characterName}</option>
                      ))}
                    </select>
                    <input
                      value={pvpOpp}
                      onChange={(e) => setPvpOpp(e.target.value)}
                      placeholder="Rival wallet (empty = open challenge)"
                      className="flex-1 min-w-[180px] px-2 py-1.5 rounded-lg text-xs border bg-transparent"
                      style={{ borderColor: HAIRLINE, color: OFFWHITE }}
                    />
                    <button
                      onClick={() => pvpAct({ action: "pvp-challenge", wallet: walletAddress, mint: pvpMint, opponentWallet: pvpOpp || undefined }, "Challenge posted.")}
                      disabled={pvpBusy || !pvpMint}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ backgroundColor: "#FF9F1C", color: INK, opacity: pvpBusy || !pvpMint ? 0.5 : 1 }}
                    >
                      POST CHALLENGE
                    </button>
                  </div>

                  {pvpLists.mine.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>Your matches</p>
                      {pvpLists.mine.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 py-1.5 border-t text-xs" style={{ borderColor: HAIRLINE }}>
                          <span style={{ color: OFFWHITE }}>
                            {m.status === "open" ? "⏳ waiting for a rival" : m.turn === walletAddress ? "🟢 YOUR MOVE" : "🕐 their move"}
                            <span style={{ color: MUTED }}> · vs {m.challenger_wallet === walletAddress ? (m.opponent_wallet ? `${m.opponent_wallet.slice(0, 4)}..` : "anyone") : `${m.challenger_wallet.slice(0, 4)}..`}</span>
                          </span>
                          <span className="flex gap-1">
                            {m.status === "active" && (
                              <button onClick={() => setPvpView(m)} className="px-2 py-0.5 rounded border text-[10px] font-bold" style={{ borderColor: LIME, color: LIME }}>OPEN</button>
                            )}
                            <button onClick={() => pvpAct({ action: "pvp-forfeit", wallet: walletAddress, matchId: m.id }, m.status === "open" ? "Challenge withdrawn." : "Forfeited.")} className="px-2 py-0.5 rounded border text-[10px]" style={{ borderColor: "#FF6B6B", color: "#FF6B6B" }}>
                              {m.status === "open" ? "WITHDRAW" : "FORFEIT"}
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {pvpLists.open.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>Open challenges — anyone can answer</p>
                      {pvpLists.open.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 py-1.5 border-t text-xs" style={{ borderColor: HAIRLINE }}>
                          <span style={{ color: OFFWHITE }}>{m.challenger_wallet.slice(0, 4)}..{m.challenger_wallet.slice(-4)} awaits</span>
                          <button
                            onClick={() => pvpAct({ action: "pvp-accept", wallet: walletAddress, matchId: m.id, mint: pvpMint }, "Duel joined!")}
                            disabled={pvpBusy || !pvpMint}
                            className="px-2 py-0.5 rounded border text-[10px] font-bold"
                            style={{ borderColor: MAGENTA, color: MAGENTA, opacity: !pvpMint ? 0.5 : 1 }}
                            title={!pvpMint ? "Pick your fighter first" : "Accept with your picked fighter"}
                          >
                            ACCEPT
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {pvpMsg && <p className="text-[11px] mt-2" style={{ color: "#FF9F1C" }}>{pvpMsg}</p>}
                </>
              )}

              {connected && pvpView && (() => {
                const st = pvpView.state || {};
                const iAmA = pvpView.challenger_wallet === walletAddress;
                const me = iAmA ? st.a : st.b;
                const them = iAmA ? st.b : st.a;
                const myTurn = pvpView.status === "active" && pvpView.turn === walletAddress;
                if (pvpView.status === "open" || !me || !them) {
                  return (
                    <div>
                      <p className="text-xs mb-2" style={{ color: MUTED }}>
                        {pvpView.status === "open"
                          ? "⏳ Challenge posted — waiting for a rival to accept. You'll drop straight into the duel when someone does."
                          : "Loading match…"}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => { setPvpView(null); pvpRefreshLists(); }} className="flex-1 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: HAIRLINE, color: MUTED }}>
                          ← BACK TO LOBBY
                        </button>
                        {pvpView.status === "open" && (
                          <button onClick={() => pvpAct({ action: "pvp-forfeit", wallet: walletAddress, matchId: pvpView.id }, "Challenge withdrawn.")} className="py-1.5 px-3 rounded-lg text-xs border" style={{ borderColor: "#FF6B6B", color: "#FF6B6B" }}>
                            WITHDRAW
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
                const bar = (f, col) => (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {f.image && <img src={f.image} alt={f.name} className="rounded object-cover" style={{ width: 34, height: 34, border: `1.5px solid ${col}` }} />}
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: OFFWHITE }}>{f.name}</p>
                        <p className="text-[9px]" style={{ color: MUTED }}>{f.tier} · {f.element}{f.shield > 0 ? ` · 🛡${f.shield}` : ""}</p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, (f.hp / f.maxHp) * 100)}%`, backgroundColor: col }} />
                    </div>
                    <p className="text-[9px] mt-0.5" style={{ color: col }}>{Math.max(0, f.hp)} / {f.maxHp}</p>
                  </div>
                );
                return (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      {bar(me, LIME)}
                      <span className="text-xs font-black shrink-0" style={{ color: MUTED }}>VS</span>
                      {bar(them, MAGENTA)}
                    </div>
                    {pvpView.status === "done" ? (
                      <p className="text-sm font-black text-center py-2" style={{ color: pvpView.winner === walletAddress ? LIME : MAGENTA }}>
                        {pvpView.winner === walletAddress ? "🏆 YOU WIN" : "💀 DEFEAT"}
                      </p>
                    ) : (
                      <>
                        <p className="text-[11px] mb-2 font-bold" style={{ color: myTurn ? LIME : MUTED }}>
                          {myTurn ? "🟢 YOUR MOVE — pick one:" : "🕐 Waiting on their move… (auto-refreshes)"}
                        </p>
                        {myTurn && (
                          <div className="flex gap-1.5 flex-wrap mb-2">
                            {me.moves.map((mv) => {
                              const spent = mv.once && me.used && me.used[mv.id];
                              return (
                                <button
                                  key={mv.id}
                                  onClick={() => pvpAct({ action: "pvp-move", wallet: walletAddress, matchId: pvpView.id, moveId: mv.id })}
                                  disabled={pvpBusy || spent}
                                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border"
                                  style={{ borderColor: spent ? HAIRLINE : "#FF9F1C", color: spent ? MUTED : "#FF9F1C", opacity: spent ? 0.4 : 1 }}
                                  title={mv.once ? "Once per battle" : "Always available"}
                                >
                                  {mv.icon} {mv.name}{mv.kind === "damage" ? ` (${mv.value})` : mv.kind === "heal" ? ` (+${mv.value})` : mv.kind === "shield" ? ` (🛡${mv.value})` : ""}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {!myTurn && (
                          <button
                            onClick={() => pvpAct({ action: "pvp-timeout", wallet: walletAddress, matchId: pvpView.id })}
                            className="text-[10px] underline mb-2"
                            style={{ color: MUTED }}
                          >
                            ⏰ claim timeout win (24h)
                          </button>
                        )}
                      </>
                    )}
                    <div className="rounded-lg p-2 max-h-40 overflow-y-auto mb-2" style={{ backgroundColor: PANEL2 }}>
                      {(pvpView.log || []).slice(-14).map((l, i) => (
                        <p key={i} className="text-[10px] leading-relaxed" style={{ color: OFFWHITE }}>{l}</p>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setPvpView(null); pvpRefreshLists(); }} className="flex-1 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: HAIRLINE, color: MUTED }}>
                        ← BACK TO LOBBY
                      </button>
                      {pvpView.status === "active" && (
                        <button onClick={() => pvpAct({ action: "pvp-forfeit", wallet: walletAddress, matchId: pvpView.id }, "Forfeited.")} className="py-1.5 px-3 rounded-lg text-xs border" style={{ borderColor: "#FF6B6B", color: "#FF6B6B" }}>
                          🏳️
                        </button>
                      )}
                    </div>
                    {pvpMsg && <p className="text-[11px] mt-2" style={{ color: "#FF9F1C" }}>{pvpMsg}</p>}
                  </>
                );
              })()}
            </div>

            {!connected && (
              <p className="text-xs mb-4 p-3 rounded-lg" style={{ backgroundColor: "rgba(255,62,165,0.08)", color: MAGENTA }}>Connect your wallet (top-right) to enter the arena.</p>
            )}

            {/* Team picker */}
            <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: LIME }}>Your team — tap to pick up to 7 ({battleTeam.length}/7)</p>
              <p className="text-xs mb-2" style={{ color: MUTED }}>They fight in the order you pick them — your first pick leads, the rest step in as each falls.</p>
              {collection.filter((c) => c.mintAddress).length === 0 && (
                <p className="text-sm" style={{ color: MUTED }}>No minted mascots yet — mint one in the Studio, or hit Sync Wallet in your Collection.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {collection.filter((c) => c.mintAddress).map((c) => {
                  const picked = battleTeam.includes(c.mintAddress);
                  const pickOrder = battleTeam.indexOf(c.mintAddress) + 1;
                  return (
                    <button
                      key={c.mintAddress}
                      onClick={() => toggleBattlePick(c.mintAddress)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left"
                      style={{ borderColor: picked ? MAGENTA : HAIRLINE, backgroundColor: picked ? "rgba(255,62,165,0.12)" : "transparent" }}
                    >
                      {c.artUrl ? (
                        <img src={c.artUrl} alt="" className="w-9 h-9 rounded object-cover" />
                      ) : (
                        <MascotSVG archetypes={c.traits.archetypes || ["Frog"]} colors={c.traits.colors || ["Neon Green"]} accessories={[]} size={36} />
                      )}
                      {picked && (
                        <span
                          className="flex-none w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                          style={{ backgroundColor: MAGENTA, color: INK }}
                          title={`Fights ${pickOrder === 1 ? "first" : pickOrder === 2 ? "second" : `#${pickOrder}`}`}
                        >
                          {pickOrder}
                        </span>
                      )}
                      <span>
                        <span className="block text-xs font-bold" style={{ color: OFFWHITE }}>{c.result.characterName}</span>
                        <span className="block text-[10px] font-bold" style={{ color: rarityColorMap[c.mintTier] || MUTED }}>{c.mintTier === "Super Legendary" ? "✧ GOD" : c.mintTier || "?"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Opponent + fight */}
            <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: AMBER }}>Opponent</p>
              <div className="flex gap-2 flex-wrap">
                <input
                  value={battleOpp}
                  onChange={(e) => setBattleOpp(e.target.value)}
                  placeholder="Paste a wallet address to challenge… or leave empty for a random rival"
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-lg text-xs border bg-transparent"
                  style={{ borderColor: HAIRLINE, color: OFFWHITE }}
                />
                <button
                  onClick={runBattle}
                  disabled={battleLoading || !connected || battleTeam.length < 1}
                  className="btn-a px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5"
                  style={{ backgroundColor: MAGENTA, color: INK, opacity: battleLoading || !connected || battleTeam.length < 1 ? 0.5 : 1 }}
                >
                  {battleLoading ? <Loader2 size={13} className="animate-spin" /> : "⚔️"}
                  {battleLoading ? "SIMULATING…" : battleOpp.trim() ? "FIGHT THIS WALLET" : "FIGHT A RANDOM RIVAL"}
                </button>
              </div>
            </div>

            {/* Replay */}
            {battleResult && battleResult.error && (
              <p className="text-xs mb-4 p-3 rounded-lg" style={{ backgroundColor: "rgba(255,62,165,0.08)", color: MAGENTA }}>{battleResult.error}</p>
            )}
            {battleResult && battleResult.events && (
              <BattleStage events={battleResult.events} upTo={battleShown} yourTeam={battleResult.yourTeam} theirTeam={battleResult.theirTeam} />
            )}
            {battleResult && battleResult.log && (
              <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL2, borderColor: MAGENTA }}>
                {battleShown < battleResult.log.length && (
                  <button onClick={() => setBattleShown(battleResult.log.length)} className="text-[10px] font-bold mb-2 px-2 py-0.5 rounded border" style={{ borderColor: HAIRLINE, color: MUTED }}>
                    SKIP TO RESULT ⏩
                  </button>
                )}
                <div className="flex flex-col gap-1.5">
                  {battleResult.log.slice(0, battleShown).map((line, i) => (
                    <p
                      key={i}
                      className="text-xs leading-relaxed"
                      style={{
                        color: line.startsWith("🏆") ? "#FFD700" : line.startsWith("—") ? MUTED : line.includes("KNOCKED OUT") || line.includes("BANISHED") ? "#FF6B6B" : OFFWHITE,
                        fontWeight: line.startsWith("🏆") || line.startsWith("⚔️ GHOST") ? 800 : 400,
                      }}
                    >
                      {line}
                    </p>
                  ))}
                </div>
                {battleShown >= battleResult.log.length && (
                  <div className="mt-3 pt-3 border-t text-center" style={{ borderColor: HAIRLINE }}>
                    <p className="text-sm font-black" style={{ color: battleResult.winner === "challenger" ? LIME : "#FF6B6B" }}>
                      {battleResult.winner === "challenger" ? (battleResult.mirror ? "🏆 VICTORY over your reflection" : "🏆 VICTORY — +25 rating") : battleResult.mirror ? "👥 Your reflection wins this one" : "💀 DEFEAT — −25 rating"}
                    </p>
                    {typeof battleResult.rating === "number" && (
                      <p className="text-xs mt-1" style={{ color: MUTED }}>Your rating: <span style={{ color: AMBER, fontWeight: 800 }}>{battleResult.rating}</span></p>
                    )}
                    <button onClick={() => { setBattleResult(null); setBattleShown(0); }} className="mt-2 px-4 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: MAGENTA, color: MAGENTA }}>
                      ⚔️ BATTLE AGAIN
                    </button>
                    {battleResult.winner === "challenger" && !battleResult.mirror && (
                      <button
                        onClick={writeVictoryIntoCanon}
                        disabled={victoryWriting}
                        className="px-4 py-2 rounded-lg text-xs font-bold border"
                        style={{ borderColor: AMBER, color: AMBER, opacity: victoryWriting ? 0.6 : 1 }}
                      >
                        {victoryWriting ? "✍️ WRITING..." : "📜 WRITE THIS INTO CANON"}
                      </button>
                    )}
                    {victoryMsg && (
                      <p className="text-xs mt-2 w-full" style={{ color: victoryMsg.startsWith("✅") ? LIME : victoryMsg.startsWith("🔒") ? AMBER : MUTED }}>
                        {victoryMsg}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Leaderboard */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: LIME }}>🏆 Season Leaderboard</p>
              {leaderboard.length === 0 && <p className="text-sm" style={{ color: MUTED }}>No battles fought yet — be the first name on the board.</p>}
              {leaderboard.map((r, i) => (
                <div key={r.wallet} className="flex items-center justify-between py-1.5 text-xs" style={{ borderTop: i > 0 ? "1px solid #26232F" : "none" }}>
                  <span style={{ color: OFFWHITE }}>
                    <span className="font-black mr-2" style={{ color: i === 0 ? "#FFD700" : i === 1 ? "#C8CDD6" : i === 2 ? "#CD7F32" : MUTED }}>#{i + 1}</span>
                    {r.wallet === walletAddress ? "⭐ YOU" : `${r.wallet.slice(0, 4)}..${r.wallet.slice(-4)}`}
                  </span>
                  <span style={{ color: MUTED }}>
                    <span style={{ color: AMBER, fontWeight: 800 }}>{r.rating}</span> · {r.wins}W-{r.losses}L
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}


        {tab === "legion" && (
          <div className="max-w-5xl mx-auto">
            {/* ---- 🛡 CLANS -------------------------------------------------
                Lives in the Legion rather than taking a nav slot — the nav is
                already full, and a clan IS your legion at the next size up. */}
            <div className="rounded-xl border p-4 mb-5" style={{ backgroundColor: PANEL, borderColor: "#C084FC55" }}>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <p className="text-xs uppercase tracking-widest font-black" style={{ color: "#C084FC" }}>🛡 Clans</p>
                {myClan ? (
                  <button
                    onClick={() => clanAct("clan-leave", {}, "You've left the clan.")}
                    disabled={clanBusy}
                    className="btn-a text-[10px] px-2.5 py-1 rounded border font-bold"
                    style={{ borderColor: MAGENTA, color: MAGENTA }}
                  >LEAVE</button>
                ) : connected ? (
                  <button
                    onClick={() => setClanForm((f) => ({ ...f, open: !f.open }))}
                    className="btn-a text-[10px] px-2.5 py-1 rounded border font-bold"
                    style={{ borderColor: "#C084FC", color: "#C084FC" }}
                  >{clanForm.open ? "CANCEL" : "+ FOUND A CLAN"}</button>
                ) : null}
              </div>

              {!myClan && (
                <p className="text-[11px] mb-3" style={{ color: MUTED }}>
                  One Deep 7 beats a god one-on-one. A <b style={{ color: OFFWHITE }}>clan</b> beats a Deep 7.
                  Up to 33 members; the ladder ranks a clan by its <b style={{ color: OFFWHITE }}>top ten fighters</b>,
                  so a tight roster outranks a mob.
                </p>
              )}

              {/* ---- found one ---- */}
              {clanForm.open && !myClan && (
                <div className="rounded-lg border p-3 mb-3" style={{ borderColor: HAIRLINE }}>
                  <div className="flex gap-2 mb-2">
                    <input
                      value={clanForm.name}
                      onChange={(e) => setClanForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Clan name" maxLength={28}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded text-xs"
                      style={{ backgroundColor: PANEL2, border: `1px solid ${HAIRLINE}`, color: OFFWHITE }}
                    />
                    <input
                      value={clanForm.tag}
                      onChange={(e) => setClanForm((f) => ({ ...f, tag: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
                      placeholder="TAG" maxLength={5}
                      title="2-5 letters or numbers — it rides beside every member's name"
                      className="w-20 text-center px-2 py-1.5 rounded text-xs mono font-black"
                      style={{ backgroundColor: PANEL2, border: `1px solid ${HAIRLINE}`, color: "#C084FC" }}
                    />
                  </div>
                  <input
                    value={clanForm.motto}
                    onChange={(e) => setClanForm((f) => ({ ...f, motto: e.target.value }))}
                    placeholder="Motto (optional)" maxLength={90}
                    className="w-full px-2.5 py-1.5 rounded text-xs mb-2"
                    style={{ backgroundColor: PANEL2, border: `1px solid ${HAIRLINE}`, color: OFFWHITE }}
                  />
                  <button
                    onClick={() => clanAct("clan-create", clanForm, "🛡 Clan founded — you're the leader.")}
                    disabled={clanBusy || clanForm.name.trim().length < 3 || clanForm.tag.length < 2}
                    className="btn-a w-full py-2 rounded-lg text-xs font-black"
                    style={{ backgroundColor: "#C084FC", color: INK, opacity: clanBusy ? 0.6 : 1 }}
                  >{clanBusy ? "FOUNDING…" : "FOUND THE CLAN"}</button>
                </div>
              )}

              {/* ---- your clan ---- */}
              {myClan && (
                <div className="rounded-lg border p-3 mb-3" style={{ borderColor: "#C084FC55", backgroundColor: "#C084FC0D" }}>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded mono" style={{ backgroundColor: "#C084FC", color: INK }}>[{myClan.clan.tag}]</span>
                    <span className="text-sm font-black" style={{ color: OFFWHITE }}>{myClan.clan.name}</span>
                    <span className="text-[10px]" style={{ color: MUTED }}>{myClan.roster.length}/33 · you are {myClan.role}</span>
                  </div>
                  {myClan.clan.motto && <p className="text-[11px] italic mt-1" style={{ color: MUTED }}>"{myClan.clan.motto}"</p>}
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: "#C084FC22" }}>
                    {myClan.roster.map((m) => (
                      <div key={m.fullWallet} className="flex items-center gap-2 py-1 text-[11px]">
                        <span className="flex-1 truncate" style={{ color: m.role === "leader" ? AMBER : OFFWHITE }}>
                          {m.role === "leader" ? "★ " : ""}{m.username ? `@${m.username}` : m.wallet}
                        </span>
                        <span className="mono" style={{ color: MUTED }}>{m.wins}W</span>
                        <span className="mono font-bold w-10 text-right" style={{ color: "#C084FC" }}>{m.rating}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---- the ladder ---- */}
              {clanLadder.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>The clan ladder — combined strength of the top ten</p>
                  {clanLadder.slice(0, 10).map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2 py-1.5 border-t text-[11px]" style={{ borderColor: HAIRLINE }}>
                      <span className="mono w-5 text-right" style={{ color: i < 3 ? AMBER : MUTED }}>{i + 1}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded mono shrink-0" style={{ backgroundColor: "#C084FC22", color: "#C084FC" }}>{c.tag}</span>
                      <span className="flex-1 truncate font-bold" style={{ color: OFFWHITE }}>{c.name}</span>
                      <span className="mono shrink-0" style={{ color: MUTED }}>{c.members}/33</span>
                      {(c.wars_won || c.wars_lost) ? (
                        <span className="mono shrink-0 text-[10px]" style={{ color: AMBER }}>{c.wars_won || 0}W-{c.wars_lost || 0}L</span>
                      ) : null}
                      <span className="mono font-black w-12 text-right shrink-0" style={{ color: LIME }}>{c.strength}</span>
                      {!myClan && connected && (
                        <button
                          onClick={() => clanAct("clan-join", { clanId: c.id }, `🛡 You've joined ${c.name}.`)}
                          disabled={clanBusy || c.members >= 33}
                          className="btn-a text-[9px] px-2 py-0.5 rounded border font-bold shrink-0"
                          style={{ borderColor: c.members >= 33 ? HAIRLINE : LIME, color: c.members >= 33 ? MUTED : LIME }}
                        >{c.members >= 33 ? "FULL" : "JOIN"}</button>
                      )}
                      {/* ⚔️ Leaders only, and never against your own clan. */}
                      {myClan && myClan.role === "leader" && c.id !== myClan.clan.id && (
                        <button
                          onClick={() => declareWar(c.id, c.name)}
                          disabled={clanBusy}
                          className="btn-a text-[9px] px-2 py-0.5 rounded border font-bold shrink-0"
                          style={{ borderColor: AMBER, color: AMBER }}
                          title="Five vs five, best mascots, first to three"
                        >{clanBusy ? "…" : "⚔️ WAR"}</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* ⚔️ THE WAR REPORT — five bouts, first to three. */}
              {warResult && (
                <div className="rounded-lg border p-3 mt-3" style={{ borderColor: AMBER, backgroundColor: "rgba(255,182,39,0.06)" }}>
                  <p className="text-xs font-black mb-1" style={{ color: AMBER }}>
                    ⚔️ {warResult.a.name} {warResult.aScore} — {warResult.bScore} {warResult.b.name}
                  </p>
                  <p className="text-[11px] mb-2" style={{ color: warResult.winner ? LIME : MUTED }}>
                    {warResult.winner ? `🏆 ${warResult.winner} takes the war.` : "A draw. Nobody buries anybody."}
                  </p>
                  {warResult.bouts.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5 text-[11px]">
                      <span className="mono" style={{ color: MUTED }}>{i + 1}</span>
                      <span className="flex-1 truncate" style={{ color: b.winner === "a" ? LIME : MUTED }}>{b.a}</span>
                      <span style={{ color: MUTED }}>vs</span>
                      <span className="flex-1 truncate text-right" style={{ color: b.winner === "b" ? LIME : MUTED }}>{b.b}</span>
                    </div>
                  ))}
                  <button onClick={() => setWarResult(null)} className="text-[10px] mt-2 underline" style={{ color: MUTED }}>close</button>
                </div>
              )}
              {clanMsg && <p className="text-[11px] mt-2" style={{ color: "#C084FC" }}>{clanMsg}</p>}
            </div>

            <div className="flex items-center justify-between gap-2 mb-1">
              <h1 className="text-xl font-bold" style={{ color: LIME }}>🛡 The Legion</h1>
              {connected && (
                <button
                  onClick={syncWallet}
                  disabled={syncing}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 shrink-0"
                  style={{ borderColor: "#5EC9FF", color: "#5EC9FF", opacity: syncing ? 0.5 : 1 }}
                >
                  {syncing ? <Loader2 size={12} className="animate-spin" /> : "⟳"} SYNC WALLET
                </button>
              )}
            </div>
            <p className="text-sm mb-4" style={{ color: MUTED }}>
              Every character you've created, in one place. Tap any card to open its Story Studio right here — then use ◀ ▶ to flip through the whole roster without leaving the page. If the on-chain count on Stats is higher than your Minted number here, hit Sync Wallet — mints made from another device or browser live on the chain until you pull them in.
            </p>
            {syncMsg && <p className="text-xs mb-3 p-2 rounded-lg" style={{ backgroundColor: "rgba(94,201,255,0.08)", color: syncMsg.includes("failed") ? "#FF6B6B" : "#5EC9FF" }}>{syncMsg}</p>}

            {/* Roster summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {[
                ["Total", collection.length, LIME],
                ["Minted", collection.filter((c) => c.mintAddress).length, AMBER],
                ["Legendary+", collection.filter((c) => c.mintTier === "Legendary" || c.mintTier === "Super Legendary").length, "#FFD700"],
                ["🏎️ Cars", collection.filter((c) => ((c.traits || {}).archetypes || []).includes("Sports Car")).length, MAGENTA],
              ].map(([label, val, col]) => (
                <div key={label} className="rounded-lg border p-2 text-center" style={{ borderColor: HAIRLINE, backgroundColor: PANEL }}>
                  <p className="text-lg font-black" style={{ color: col }}>{val}</p>
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {[["all", "All"], ["minted", "💎 Minted"], ["unminted", "Drafts"], ["cars", "🏎️ Cars"]].map(([id, label]) => (
                <Chip key={id} label={label} active={legionFilter === id} accent={LIME} onClick={() => setLegionFilter(id)} />
              ))}
              <span className="mx-1 text-xs" style={{ color: HAIRLINE }}>|</span>
              {[["newest", "Newest"], ["rarity", "Rarity"], ["name", "A–Z"]].map(([id, label]) => (
                <Chip key={id} label={label} active={legionSort === id} accent={AMBER} onClick={() => setLegionSort(id)} />
              ))}
              <input
                value={legionSearch}
                onChange={(e) => setLegionSearch(e.target.value)}
                placeholder="Search your Legion…"
                className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg text-xs outline-none border"
                style={{ backgroundColor: PANEL2, borderColor: HAIRLINE, color: OFFWHITE }}
              />
            </div>

            {collection.length === 0 && (
              <div className="rounded-xl border p-8 text-center" style={{ borderColor: HAIRLINE, backgroundColor: PANEL }}>
                <p className="text-sm mb-1" style={{ color: OFFWHITE }}>Your Legion is empty.</p>
                <p className="text-xs" style={{ color: MUTED }}>Build a character in the Studio — or hit Sync Wallet in your Collection to pull in mascots you've minted or been sent.</p>
              </div>
            )}
            {collection.length > 0 && legionList.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: MUTED }}>Nothing matches that filter.</p>
            )}

            {/* The card wall */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {legionList.map((c) => {
                const tier = c.mintTier || null;
                const universe = c.mintUniverse || null;
                const isCar = ((c.traits || {}).archetypes || []).includes("Sports Car");
                const art = c.mintedArtUrl || c.artUrl;
                const frame = tier === "Super Legendary"
                  ? "linear-gradient(115deg,#FF9DF2,#7DF9FF,#FFF3B0,#C084FC,#FF9DF2)"
                  : tier === "Legendary" ? "linear-gradient(135deg,#F5D46A,#B8860B,#FFF3C4,#D4AF37)"
                  : tier === "Epic" ? "linear-gradient(135deg,#C084FC,#7C3AED,#E9D5FF,#A855F7)"
                  : tier === "Rare" ? "linear-gradient(135deg,#7DD3FC,#0284C7,#E0F2FE,#38BDF8)"
                  : tier === "Common" ? "linear-gradient(135deg,#D1D5DB,#6B7280,#F9FAFB,#9CA3AF)"
                  : HAIRLINE;
                const labelCol = rarityColorMap[tier] || MUTED;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setStudioEntry(c); setShowCard(false); }}
                    className="text-left rounded-xl p-[2px] transition-transform duration-150 hover:scale-[1.03]"
                    style={{
                      background: frame,
                      backgroundSize: "300% 300%",
                      animation: tier === "Super Legendary" ? "holoShift 6s linear infinite" : "none",
                      boxShadow: tier ? `0 0 14px ${labelCol}44` : "none",
                    }}
                  >
                    <div className="rounded-[10px] overflow-hidden h-full" style={{ backgroundColor: "#141218" }}>
                      <div className="relative">
                        {art ? (
                          <img src={art} alt={c.result?.characterName || "mascot"} className="w-full aspect-square object-cover block" />
                        ) : (
                          <div className="w-full aspect-square flex items-center justify-center" style={{ backgroundColor: "#1B1922" }}>
                            <MascotSVG
                              archetypes={(c.traits || {}).archetypes || ["Frog"]}
                              colors={(c.traits || {}).colors || ["Neon Green"]}
                              accessories={(c.traits || {}).accessories || []}
                              size={110}
                            />
                          </div>
                        )}
                        {c.mintAddress && (
                          <span className="absolute top-1 right-1 text-[9px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(0,0,0,0.75)", color: labelCol }}>
                            {tier === "Super Legendary" ? "✧ GOD" : tier === "Legendary" ? "⭐ LEG" : (tier || "MINTED").toUpperCase().slice(0, 6)}
                          </span>
                        )}
                        {!c.mintAddress && (
                          <span className="absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(0,0,0,0.7)", color: MUTED }}>DRAFT</span>
                        )}
                        {/* 📖 How much of this mascot's saga is public. */}
                        {c.mintAddress && (() => {
                          const live = published.filter((p) => p.mint_address === c.mintAddress).length;
                          if (!live) return null;
                          return (
                            <span
                              onClick={(ev) => { ev.stopPropagation(); if (profile && profile.username) openAuthor(profile.username); }}
                              className="absolute bottom-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: "rgba(0,0,0,0.75)", color: "#5EC9FF" }}
                              title="Published chapters — tap to read the public saga"
                            >
                              📖 {live}
                            </span>
                          );
                        })()}
                        {isCar && (
                          <span className="absolute top-1 left-1 text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>🏎️</span>
                        )}
                        {c.status && c.status !== "alive" && (
                          <span className="absolute bottom-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(0,0,0,0.78)", color: "#C4A7F5" }}>
                            {c.status === "purgatory" ? "🕯 PURGATORY" : "🌊 AT REST"}
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-bold truncate" style={{ color: OFFWHITE }}>{c.result?.characterName || "Unnamed"}</p>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] truncate" style={{ color: MUTED }}>${c.result?.ticker || "—"}</span>
                          {universe && (
                            <span className="text-[9px] font-bold shrink-0" style={{ color: UNIVERSE_COLORS[universe] || MUTED }}>
                              {UNIVERSE_ICONS[universe] || "◈"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {legionList.length > 0 && (
              <p className="text-[10px] text-center mt-4" style={{ color: MUTED }}>
                Showing {legionList.length} of {collection.length} · tap a card to open its studio, then ◀ ▶ to flip through
              </p>
            )}
          </div>
        )}

        {tab === "race" && (
          <div className="max-w-3xl mx-auto">
            <h1 className="text-xl font-bold mb-1" style={{ color: LIME }}>🏁 The Grand Circuit <span className="text-xs px-2 py-0.5 rounded align-middle" style={{ backgroundColor: LIME, color: INK }}>BETA</span></h1>
            <p className="text-sm mb-5" style={{ color: MUTED }}>
              Combat racing across the Pentaverse: pick up to 3 MINTED mascots and hit the grid. SPD is top speed, PWR is weapon damage, HP is armor, SPC is fire rate. 🏎️ Sports Car mascots race in true form with their equipped mods — everyone else drives a Battle Kart. Lap 1 is clean, weapons go live on lap 2, and lap 3 wrecks are permanent. Win +25 race rating, lose −25. Racing has its own ladder — and losing never touches your NFT.
            </p>

            {!connected && (
              <p className="text-xs mb-4 p-3 rounded-lg" style={{ backgroundColor: "rgba(198,255,61,0.08)", color: LIME }}>Connect your wallet (top-right) to reach the grid.</p>
            )}

            {/* Squad picker */}
            <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: LIME }}>Your racers — tap to pick up to 3 ({raceTeam.length}/3)</p>
              <p className="text-xs mb-2" style={{ color: MUTED }}>Squad score is the sum of everyone's finishing points — even your P4 matters.</p>
              {collection.filter((c) => c.mintAddress).length === 0 && (
                <p className="text-sm" style={{ color: MUTED }}>No minted mascots yet — mint one in the Studio, or hit Sync Wallet in your Collection.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {collection.filter((c) => c.mintAddress).map((c) => {
                  const picked = raceTeam.includes(c.mintAddress);
                  const isCar = ((c.traits || {}).archetypes || []).includes("Sports Car");
                  return (
                    <button
                      key={c.mintAddress}
                      onClick={() => toggleRacePick(c.mintAddress)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5"
                      style={{
                        borderColor: picked ? LIME : HAIRLINE,
                        backgroundColor: picked ? LIME : "transparent",
                        color: picked ? INK : OFFWHITE,
                      }}
                    >
                      {isCar ? "🏎️" : "🛺"} {c.result.characterName}
                      {isCar && <span className="text-[9px] px-1 rounded" style={{ backgroundColor: picked ? INK : HAIRLINE, color: picked ? LIME : MUTED }}>CAR</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <input
                  value={raceOpp}
                  onChange={(e) => setRaceOpp(e.target.value)}
                  placeholder="Rival wallet (optional — blank = random)"
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-lg text-xs outline-none border"
                  style={{ backgroundColor: PANEL2, borderColor: HAIRLINE, color: OFFWHITE }}
                />
                <button
                  onClick={runRace}
                  disabled={raceLoading || !connected || raceTeam.length < 1}
                  className="btn-a px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5"
                  style={{ backgroundColor: LIME, color: INK, opacity: raceLoading || !connected || raceTeam.length < 1 ? 0.5 : 1 }}
                >
                  {raceLoading ? <Loader2 size={13} className="animate-spin" /> : "🏁"}
                  {raceLoading ? "ON THE GRID…" : raceOpp.trim() ? "RACE THIS WALLET" : "RACE A RANDOM RIVAL"}
                </button>
              </div>
              <p className="text-[10px] mt-2" style={{ color: MUTED }}>The circuit is rolled at lights-out — 8 tracks, each favoring an element. Watch for the rare ☠ Post-Apocalyptic roll: no respawns there, any lap.</p>
            </div>

            {/* Broadcast */}
            {raceResult && raceResult.error && (
              <p className="text-xs mb-4 p-3 rounded-lg" style={{ backgroundColor: "rgba(255,90,90,0.08)", color: "#FF6B6B" }}>{raceResult.error}</p>
            )}
            {raceResult && raceResult.events && (
              <RaceStage events={raceResult.events} upTo={raceShown} track={raceResult.track} yourTeam={raceResult.yourTeam} theirTeam={raceResult.theirTeam} />
            )}
            {raceResult && raceResult.log && (
              <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: PANEL2, borderColor: LIME }}>
                {raceShown < raceResult.events.length && (
                  <button onClick={() => setRaceShown(raceResult.events.length)} className="text-[10px] font-bold mb-2 px-2 py-0.5 rounded border" style={{ borderColor: HAIRLINE, color: MUTED }}>
                    SKIP TO PODIUM ⏩
                  </button>
                )}
                <div className="flex flex-col gap-1.5">
                  {raceResult.events.slice(0, raceShown).filter((e) => e.text && e.t !== "tick").map((e, i) => (
                    <p
                      key={i}
                      className="text-xs leading-relaxed"
                      style={{
                        color: e.t === "podium" ? "#FFD700" : e.t === "wreck" ? "#FF6B6B" : e.t === "finish" ? "#FFD700" : e.t === "nitro" ? "#7DF9FF" : e.t === "overtake" ? LIME : OFFWHITE,
                        fontWeight: e.t === "podium" || e.t === "start" || e.t === "finalLap" ? 800 : 400,
                      }}
                    >
                      {e.text}
                    </p>
                  ))}
                </div>
                {raceShown >= raceResult.events.length && (
                  <div className="mt-3 pt-3 border-t text-center" style={{ borderColor: HAIRLINE }}>
                    <p className="text-sm font-black" style={{ color: raceResult.winner === "challenger" ? LIME : "#FF6B6B" }}>
                      {raceResult.winner === "challenger" ? (raceResult.mirror ? "🏆 VICTORY over your reflections" : "🏆 SQUAD VICTORY — +25 race rating") : raceResult.mirror ? "👥 Your reflections take it" : "💀 OUTRACED — −25 race rating"}
                    </p>
                    {raceResult.scores && (
                      <p className="text-xs mt-1" style={{ color: MUTED }}>
                        Squad points: <span style={{ color: LIME, fontWeight: 800 }}>{raceResult.scores.yours}</span> — <span style={{ color: MAGENTA, fontWeight: 800 }}>{raceResult.scores.theirs}</span>
                      </p>
                    )}
                    {typeof raceResult.rating === "number" && (
                      <p className="text-xs mt-1" style={{ color: MUTED }}>Your race rating: <span style={{ color: AMBER, fontWeight: 800 }}>{raceResult.rating}</span></p>
                    )}
                    <button onClick={() => { setRaceResult(null); setRaceShown(0); }} className="mt-2 px-4 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: LIME, color: LIME }}>
                      🏁 RACE AGAIN
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Racing ladder */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: LIME }}>🏆 Fastest in the Pentaverse</p>
              {raceLb.length === 0 && <p className="text-sm" style={{ color: MUTED }}>Nobody's set a time yet — the board is waiting for its first name.</p>}
              {raceLb.map((r, i) => (
                <div key={r.wallet} className="flex items-center justify-between py-1.5 text-xs" style={{ borderTop: i > 0 ? "1px solid #26232F" : "none" }}>
                  <span style={{ color: OFFWHITE }}>
                    <span className="font-black mr-2" style={{ color: i === 0 ? "#FFD700" : i === 1 ? "#C8CDD6" : i === 2 ? "#CD7F32" : MUTED }}>#{i + 1}</span>
                    {r.wallet === walletAddress ? "⭐ YOU" : `${r.wallet.slice(0, 4)}..${r.wallet.slice(-4)}`}
                  </span>
                  <span style={{ color: MUTED }}>
                    <span style={{ color: AMBER, fontWeight: 800 }}>{r.rating}</span> · {r.wins}W-{r.losses}L
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "learn" && <LearnPage />}
        {tab === "whitepaper" && <WhitepaperPage />}
        {tab === "pricing" && <PricingPage tier={tier} onBuy={handleBuy} onPortal={handlePortal} />}

        {tab === "studio" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-xl border p-5" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-sm tracking-wider" style={{ color: LIME }}>BUILD YOUR MASCOT</h2>
                <button onClick={randomize} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border" style={{ borderColor: MAGENTA, color: MAGENTA }}>
                  <Dice5 size={14} /> RANDOM
                </button>
              </div>

              <div className="mb-6 rounded-lg border p-3" style={{ borderColor: HAIRLINE, backgroundColor: "rgba(0,0,0,0.2)" }}>
                <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: LIME }}>
                  Your Email
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => {
                      if (email) {
                        try { localStorage.setItem("mascotgen-email", email); } catch (err) {}
                        checkSubscription(email);
                      }
                    }}
                    placeholder="you@email.com"
                    className="flex-1 px-3 py-2 rounded-lg text-xs border bg-transparent"
                    style={{ borderColor: HAIRLINE, color: OFFWHITE }}
                  />
                  <button
                    onClick={() => {
                      if (email) {
                        try { localStorage.setItem("mascotgen-email", email); } catch (err) {}
                        checkSubscription(email);
                      }
                    }}
                    className="btn-a px-4 py-2 rounded-lg text-xs font-bold"
                    style={{ backgroundColor: LIME, color: INK }}
                  >
                    SET
                  </button>
                </div>
                <p className="text-xs mt-2" style={{ color: MUTED }}>
                  Enter your email to track generations and unlock your tier. Current: <span style={{ color: isPaid ? LIME : MUTED }}>{tier}</span>
                </p>
              </div>

              <div className="mb-6 rounded-lg border p-3" style={{ borderColor: HAIRLINE, backgroundColor: "rgba(0,0,0,0.2)" }}>
                <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: LIME }}>
                  🌐 Story Language
                </p>
                <select
                  value={lang}
                  onChange={(e) => pickLang(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs border"
                  style={{ borderColor: HAIRLINE, color: OFFWHITE, backgroundColor: PANEL }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l} style={{ backgroundColor: PANEL, color: OFFWHITE }}>{l}</option>
                  ))}
                </select>
                <p className="text-xs mt-2" style={{ color: MUTED }}>
                  Bios, stories, tweets and the launch package are written in this language.
                </p>
              </div>

              {lockMsg && (
                <p className="text-xs mb-4 p-2 rounded-lg" style={{ backgroundColor: "rgba(255,182,39,0.08)", color: AMBER }}>{lockMsg}</p>
              )}

              <Section title="Gender" accent={LIME}>
                {["Male", "Female"].map((g) => (
                  <Chip key={g} label={g} active={gender === g} accent={LIME} onClick={() => setGender(g)} />
                ))}
              </Section>

              <Section title="Complexion" sub="Cosmetic only — never affects stats or rarity" accent={LIME}>
                {SKIN_TONES.map((s) => (
                  <Chip key={s} label={s} active={skinTone === s} accent={LIME} onClick={() => setSkinTone(s)} />
                ))}
              </Section>

              <Section title="Archetype" sub={`Pick up to ${LIMITS.arch}${LIMITS.arch > 1 ? " — mix for hybrids" : ""}`} accent={LIME}>
                {ARCHETYPES_COMMON.map((a) => (
                  <Chip key={a} label={a} active={archetypes.includes(a)} accent={LIME} onClick={() => setArchetypes(toggleIn(archetypes, a, LIMITS.arch))} />
                ))}
                {ARCHETYPES_RARE.map((a) => (
                  <Chip key={a} label={`✦ ${a}`} active={archetypes.includes(a)} accent="#5EC9FF" onClick={() => setArchetypes(toggleIn(archetypes, a, LIMITS.arch))} />
                ))}
                {ALPHA_ARCHETYPES.map((a) => (
                  <Chip key={a} label={isPremium ? `⭐ ${a}` : `🔒 ${a}`} active={archetypes.includes(a)} accent={AMBER} dim={!isPremium} onClick={() => { setArchetypes(toggleIn(archetypes, a, LIMITS.arch)); if (!isPremium) tease(`${a} is a Platinum+ archetype`); }} />
                ))}
              </Section>

              <Section title="Vibe" sub={`Pick up to ${LIMITS.vibe}`} accent={LIME}>
                {VIBES_COMMON.map((v) => (
                  <Chip key={v} label={v} active={vibes.includes(v)} accent={LIME} onClick={() => setVibes(toggleIn(vibes, v, LIMITS.vibe))} />
                ))}
                {VIBES_RARE.map((v) => (
                  <Chip key={v} label={`✦ ${v}`} active={vibes.includes(v)} accent="#5EC9FF" onClick={() => setVibes(toggleIn(vibes, v, LIMITS.vibe))} />
                ))}
                {ALPHA_VIBES.map((v) => (
                  <Chip key={v} label={isPremium ? `⭐ ${v}` : `🔒 ${v}`} active={vibes.includes(v)} accent={AMBER} dim={!isPremium} onClick={() => { setVibes(toggleIn(vibes, v, LIMITS.vibe)); if (!isPremium) tease(`${v} is a Platinum+ vibe`); }} />
                ))}
              </Section>

              <Section title="World" sub={`Pick up to ${LIMITS.world}${LIMITS.world > 1 ? " for travel arcs" : ""}`} accent={LIME}>
                {WORLDS_COMMON.map((w) => (
                  <Chip key={w} label={w} active={worlds.includes(w)} accent={LIME} onClick={() => setWorlds(toggleIn(worlds, w, LIMITS.world))} />
                ))}
                {WORLDS_RARE.map((w) => (
                  <Chip key={w} label={`✦ ${w}`} active={worlds.includes(w)} accent="#5EC9FF" onClick={() => setWorlds(toggleIn(worlds, w, LIMITS.world))} />
                ))}
                {ALPHA_WORLDS.map((w) => (
                  <Chip key={w} label={isPremium ? `⭐ ${w}` : `🔒 ${w}`} active={worlds.includes(w)} accent={AMBER} dim={!isPremium} onClick={() => { setWorlds(toggleIn(worlds, w, LIMITS.world)); if (!isPremium) tease(`${w} is a Platinum+ world`); }} />
                ))}
              </Section>

              <Section title="Color" sub={`Pick up to ${LIMITS.color}${LIMITS.color > 1 ? " for gradients" : ""}`} accent={LIME}>
                {COLORS_COMMON.map((c) => (
                  <Chip key={c} label={c} active={colors.includes(c)} accent={LIME} onClick={() => setColors(toggleIn(colors, c, LIMITS.color))} />
                ))}
                {COLORS_RARE.map((c) => (
                  <Chip key={c} label={`✦ ${c}`} active={colors.includes(c)} accent="#5EC9FF" onClick={() => setColors(toggleIn(colors, c, LIMITS.color))} />
                ))}
                {ALPHA_COLORS.map((c) => (
                  <Chip key={c} label={isPremium ? `⭐ ${c}` : `🔒 ${c}`} active={colors.includes(c)} accent={AMBER} dim={!isPremium} onClick={() => { setColors(toggleIn(colors, c, LIMITS.color)); if (!isPremium) tease(`${c} is a Platinum+ color`); }} />
                ))}
              </Section>

              <Section title="Accessories" sub={`Pick up to ${maxAccessories} (${tier} tier)`} accent={LIME}>
                {ACCESSORIES_COMMON.map((a) => (
                  <Chip key={a} label={a} active={cappedAccessories.includes(a)} accent={LIME} onClick={() => setAccessories(toggleIn(accessories, a, maxAccessories))} />
                ))}
                {ACCESSORIES_RARE.map((a) => (
                  <Chip key={a} label={`✦ ${a}`} active={cappedAccessories.includes(a)} accent="#5EC9FF" onClick={() => setAccessories(toggleIn(accessories, a, maxAccessories))} />
                ))}
                {ALPHA_ACCESSORIES.map((a) => (
                  <Chip key={a} label={isPremium ? `⭐ ${a}` : `🔒 ${a}`} active={cappedAccessories.includes(a)} accent={AMBER} dim={!isPremium} onClick={() => { setAccessories(toggleIn(accessories, a, maxAccessories)); if (!isPremium) tease(`${a} is a Platinum+ accessory`); }} />
                ))}
              </Section>

              {archetypes.includes("Sports Car") && (
                <Section title="🏎️ Car Mods" sub={`Sports Car gear — counts toward your ${maxAccessories} accessory picks`} accent={MAGENTA}>
                  {CAR_MODS.map((m) => (
                    <Chip key={m} label={m} active={cappedAccessories.includes(m)} accent={MAGENTA} onClick={() => setAccessories(toggleIn(accessories, m, maxAccessories))} />
                  ))}
                </Section>
              )}

              <Section title="Aura" sub={isAlpha ? "Elite exclusive" : "🔒 Elite exclusive — tap any aura to preview it on your mascot"} accent={AMBER}>
                {AURAS.map((a) => (
                  <Chip
                    key={a}
                    label={a === "None" ? a : isAlpha ? `⭐ ${a}` : `🔒 ${a}`}
                    active={aura === a}
                    accent={AMBER}
                    dim={!isAlpha && a !== "None"}
                    onClick={() => { setAura(a); if (!isAlpha && a !== "None") tease(`${a} is an Elite aura`); }}
                  />
                ))}
              </Section>

              <Section title="Art Style" accent={LIME}>
                {ART_STYLES_COMMON.map((s) => (
                  <Chip key={s} label={s} active={artStyle === s} accent={LIME} onClick={() => setArtStyle(s)} />
                ))}
                {ART_STYLES_RARE.map((s) => (
                  <Chip key={s} label={`✦ ${s}`} active={artStyle === s} accent="#5EC9FF" onClick={() => setArtStyle(s)} />
                ))}
              </Section>

              <button
                onClick={generate}
                disabled={loading || trendingLoading}
                className="btn-a w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                style={{ backgroundColor: LIME, color: INK, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> GENERATING...</> : <><Sparkles size={16} /> GENERATE MASCOT</>}
              </button>
              <button
                onClick={() => (isPremium ? generateTrending() : setTab("pricing"))}
                disabled={loading || trendingLoading}
                className="w-full mt-2 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border"
                style={{ borderColor: AMBER, color: isPremium ? AMBER : MUTED, opacity: trendingLoading ? 0.6 : 1 }}
              >
                {trendingLoading ? <><Loader2 size={16} className="animate-spin" /> SCANNING THE INTERNET...</> : <>🔥 TRENDING MODE {!isPremium && "(Platinum+)"}</>}
              </button>
              {error && <p className="text-xs mt-2 text-center" style={{ color: MAGENTA }}>{error}</p>}
            </div>

            <div>
              {!result && !loading && (
                <div className="rounded-xl border border-dashed p-10 text-center h-full flex flex-col items-center justify-center" style={{ borderColor: HAIRLINE }}>
                  <MascotSVG archetypes={archetypes.length ? archetypes : ["Frog"]} colors={colors.length ? colors : ["Neon Green"]} accessories={aura !== "None" ? [...cappedAccessories, aura] : cappedAccessories} size={160} />
                  <p className="text-sm mt-4" style={{ color: MUTED }}>Your mascot preview updates as you build. Hit Generate for lore + a launch package.</p>
                </div>
              )}

              {loading && (
                <div className="rounded-xl border p-10 text-center h-full flex flex-col items-center justify-center" style={{ borderColor: HAIRLINE, backgroundColor: PANEL }}>
                  <Loader2 size={40} className="animate-spin" style={{ color: LIME }} />
                  <p className="text-sm mt-4" style={{ color: MUTED }}>Summoning your character...</p>
                </div>
              )}

              {result && !loading && view === "card" && (
                <div className="rounded-xl border p-5" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
                  <div className="relative flex justify-center mb-4 rounded-lg py-6" style={{ backgroundColor: PANEL2 }}>
                    <MascotSVG archetypes={archetypes.length ? archetypes : ["Frog"]} colors={colors.length ? colors : ["Neon Green"]} accessories={aura !== "None" ? [...cappedAccessories, aura] : cappedAccessories} size={160} />
                    <div className="absolute top-0 right-0 text-xs font-bold px-3 py-1 rounded-bl-lg" style={{ backgroundColor: HAIRLINE, color: MUTED }}>
                      TIER: ???
                    </div>
                  </div>

                  {liveStats && <div className="mb-4"><StatPanel stats={liveStats} /></div>}

                  <h2 className="text-xl font-bold" style={{ color: OFFWHITE }}>{result.characterName}</h2>
                  <p className="text-sm" style={{ color: LIME }}>${result.ticker} · {result.tokenName}</p>
                  {result.trendSource && (
                    <p className="text-xs mt-2 p-2 rounded-lg" style={{ backgroundColor: "rgba(255,182,39,0.08)", color: AMBER }}>
                      🔥 Born from a viral moment: {result.trendSource}
                    </p>
                  )}
                  <p className="text-sm mt-2 italic" style={{ color: MUTED }}>"{result.tagline}"</p>
                  <p className="text-sm mt-3 leading-relaxed" style={{ color: OFFWHITE }}>{result.bio}</p>

                  {isPaid && result.originStory && (
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: MUTED }}>Origin Story</p>
                      <div className="grid grid-cols-2 gap-2">
                        {result.originStory.map((panel, i) => (
                          <div key={i} className="text-xs p-2 rounded-lg" style={{ backgroundColor: PANEL2, color: OFFWHITE }}>
                            <span style={{ color: LIME }}>{i + 1}.</span> {panel}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!isPaid && (
                    <div className="mt-4 rounded-lg border p-3 text-center" style={{ borderColor: AMBER, backgroundColor: "rgba(255,182,39,0.05)" }}>
                      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: AMBER }}>🔒 Origin Story — subscribers only</p>
                      <p className="text-xs" style={{ color: MUTED }}>
                        Every subscriber mascot is born with a 4-panel origin story — the first chapter of a saga you can expand forever in the Story Studio.
                      </p>
                      <button onClick={() => setTab("pricing")} className="mt-2 px-4 py-1.5 rounded-lg text-xs font-bold" style={{ backgroundColor: AMBER, color: INK }}>
                        UNLOCK THE STORY ENGINE
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setView("launch")} className="btn-a flex-1 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: AMBER, color: INK }}>
                      🚀 LAUNCH PACKAGE
                    </button>
                    <button onClick={() => { setView("site"); setTimeout(() => document.getElementById("site-preview")?.scrollIntoView({ behavior: "smooth" }), 60); }} className="flex-1 py-2 rounded-lg text-xs font-bold border" style={{ borderColor: LIME, color: LIME }}>
                      <Globe size={12} className="inline" /> SITE PREVIEW
                    </button>
                  </div>

                  <button onClick={saveCurrent} className="w-full mt-3 py-2 rounded-lg text-xs font-bold border" style={{ borderColor: AMBER, color: AMBER }}>
                    💎 SAVE, THEN MINT IN STUDIO
                  </button>
                  <button onClick={saveCurrent} className="btn-a w-full mt-2 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2" style={{ backgroundColor: LIME, color: INK }}>
                    <Save size={14} /> SAVE TO COLLECTION
                  </button>
                  {saveMsg && <p className="text-xs text-center mt-2" style={{ color: LIME }}>{saveMsg}</p>}
                  <button onClick={generate} className="w-full mt-2 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border" style={{ borderColor: MAGENTA, color: MAGENTA }}>
                    <RefreshCw size={14} /> REGENERATE MASCOT (NEW NAME & STORY)
                  </button>
                </div>
              )}

              {result && !loading && view === "launch" && (
                <div className="rounded-xl border p-5" style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-sm tracking-wider" style={{ color: AMBER }}>🚀 LAUNCH PACKAGE</h2>
                    <button onClick={() => setView("card")} className="text-xs" style={{ color: MUTED }}>← Back</button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {[
                      ["Name", result.tokenName],
                      ["Ticker", `$${result.ticker}`],
                      ["Tagline", result.tagline],
                      ["Art Prompt", result.visualDescription],
                      ["Social Bio", result.socialBio],
                      ["Launch Tweet", result.firstTweet],
                      ["Telegram Welcome", result.telegramWelcome],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <button key={label} onClick={() => copyText(label, value)} className="text-left text-xs p-2 rounded-lg flex justify-between gap-2" style={{ backgroundColor: PANEL2 }}>
                        <span style={{ color: OFFWHITE }}>
                          <span style={{ color: MUTED }}>{label}: </span>
                          {value}
                        </span>
                        <span className="shrink-0 font-bold" style={{ color: copiedField === label ? LIME : AMBER }}>
                          {copiedField === label ? "COPIED ✓" : "COPY"}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* 🚀 Guided launch — YOU launch it on pump.fun; we just prep. */}
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: HAIRLINE }}>
                    <p className="text-xs uppercase tracking-widest mb-2" style={{ color: AMBER }}>🚀 Launch it on pump.fun</p>
                    <ol className="text-xs leading-relaxed mb-3" style={{ color: OFFWHITE }}>
                      <li>1. Copy the Name, Ticker and Tagline above. Save your art (right-click the card → save).</li>
                      <li>2. Open pump.fun's create page and paste each field in. You launch it from your own wallet.</li>
                      <li>3. Copy the token address pump.fun gives you, then link it to your minted mascot in the Story Studio — your mascot page gets a live BUY button.</li>
                    </ol>
                    <a href="https://pump.fun/create" target={EXT_TAB} rel="noopener noreferrer" className="btn-a block w-full text-center py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: AMBER, color: INK }}>
                      OPEN PUMP.FUN CREATE PAGE ↗
                    </a>
                    <p className="text-[10px] mt-2 leading-snug" style={{ color: MUTED }}>
                      MascotGen does not create, sell, or endorse any token. Launching is done by you, on pump.fun, from your own wallet, at your own risk. Nothing here is financial advice.
                    </p>
                  </div>
                </div>
              )}

              {result && !loading && view === "site" && (
                <div id="site-preview">
                <WebsitePreview result={result} traits={{ archetypes, colors, accessories: aura !== "None" ? [...cappedAccessories, aura] : cappedAccessories }} token={studioEntry && studioEntry.tokenAddress ? { address: studioEntry.tokenAddress, url: studioEntry.tokenUrl, telegram: studioEntry.tokenTelegram } : null} />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      )}

      {/* Footer — legal links live here so they're reachable from every page. */}
      <footer className="mt-10 px-4 py-6" style={{ borderTop: "1px solid #26232F" }}>
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs" style={{ color: MUTED }}>
            © {new Date().getFullYear()} Ultra Freight Company LLC dba MascotGen
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a href={OFFICIAL_LINKS.telegram} target={EXT_TAB} rel="noopener noreferrer" className="text-xs font-bold" style={{ color: "#5EC9FF" }}>
              💬 Telegram
            </a>
            <a href={OFFICIAL_LINKS.x} target={EXT_TAB} rel="noopener noreferrer" className="text-xs font-bold" style={{ color: OFFWHITE }}>
              𝕏 Twitter
            </a>
            <button
              onClick={() => { setTab("learn"); window.scrollTo(0, 0); }}
              className="text-xs underline"
              style={{ color: MUTED }}
            >
              Terms and Privacy
            </button>
            <a href="mailto:support@mascotgen.studio" className="text-xs underline" style={{ color: MUTED }}>
              support@mascotgen.studio
            </a>
          </div>
        </div>

        {/* 🛡 OFFICIAL LINKS — the anti-impersonation block. Scammers clone
            projects and point people at fake groups; this is the canonical list
            people can check against. Keep it accurate above all else. */}
        <div className="max-w-3xl mx-auto mt-4 rounded-lg border p-3" style={{ borderColor: HAIRLINE, backgroundColor: "rgba(94,201,255,0.04)" }}>
          <p className="text-xs font-bold mb-1" style={{ color: "#5EC9FF" }}>🛡 OFFICIAL LINKS — anything not on this list is fake</p>
          <p className="text-xs" style={{ color: MUTED }}>
            Website <span style={{ color: OFFWHITE }}>mascotgen.studio</span> · Telegram <span style={{ color: OFFWHITE }}>{OFFICIAL_LINKS.telegramHandle}</span> · X <span style={{ color: OFFWHITE }}>{OFFICIAL_LINKS.xHandle}</span> · Support <span style={{ color: OFFWHITE }}>support@mascotgen.studio</span>
          </p>
          <p className="text-xs mt-1" style={{ color: "#6B6880" }}>
            We will never DM you first, never ask for your seed phrase, and never run a giveaway that asks you to connect a wallet. $MGEN has not launched — any token claiming to be it is not ours.
          </p>
        </div>
        <p className="text-xs mt-3 max-w-3xl mx-auto" style={{ color: "#4A4757" }}>
          MascotGen is a creative tool in Alpha. Digital collectibles are not investments — nothing here is financial advice.
        </p>
      </footer>

      {showCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={() => setShowCollection(false)}>
          <div
            className="w-full max-w-4xl rounded-xl p-[3px]"
            style={{
              background: "linear-gradient(115deg,#FF9DF2,#7DF9FF,#FFF3B0,#C084FC,#7DF9FF,#FF9DF2)",
              backgroundSize: "300% 300%",
              animation: "holoShift 6s linear infinite",
              boxShadow: "0 0 38px rgba(255,157,242,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
          <div className="rounded-[10px] w-full max-h-[85vh] overflow-y-auto" style={{ backgroundColor: PANEL }}>
            <div className="flex items-center justify-between p-4 border-b sticky top-0" style={{ borderColor: HAIRLINE, backgroundColor: PANEL }}>
              <h2 className="font-bold text-sm" style={{ color: LIME }}>MY COLLECTION ({collection.length})</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={syncWallet}
                  disabled={syncing}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border"
                  style={{ borderColor: "#5EC9FF", color: "#5EC9FF", opacity: syncing ? 0.6 : 1 }}
                  title="Scan your connected wallet and pull in every MascotGen NFT you own — including ones you were traded"
                >
                  {syncing ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />} SYNC WALLET
                </button>
                <button onClick={() => setShowCollection(false)} style={{ color: MUTED }}><X size={18} /></button>
              </div>
            </div>
            {syncMsg && <p className="text-xs px-4 pt-2" style={{ color: syncMsg.includes("failed") ? MAGENTA : "#5EC9FF" }}>{syncMsg}</p>}
            {walletAddress === DEV_REPAIR_WALLET && collection.some((c) => c.mintAddress) && (
              <div className="mx-4 mt-2 p-2 rounded-lg border" style={{ borderColor: "#5EC9FF" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={repairAllNfts}
                    disabled={repairing}
                    className="px-3 py-1 rounded-lg text-xs font-bold"
                    style={{ backgroundColor: repairing ? HAIRLINE : "#5EC9FF", color: repairing ? MUTED : INK }}
                  >
                    {repairing ? "REPAIRING..." : "🔧 REPAIR NFT IMAGES"}
                  </button>
                  {!COLLECTION_ADDRESS ? (
                    <button
                      onClick={createCollection}
                      disabled={repairing}
                      className="px-3 py-1 rounded-lg text-xs font-bold"
                      style={{ backgroundColor: repairing ? HAIRLINE : "#C084FC", color: repairing ? MUTED : INK }}
                    >
                      🏛 CREATE COLLECTION
                    </button>
                  ) : (
                    <button
                      onClick={joinCollectionAll}
                      disabled={repairing}
                      className="px-3 py-1 rounded-lg text-xs font-bold"
                      style={{ backgroundColor: repairing ? HAIRLINE : "#C084FC", color: repairing ? MUTED : INK }}
                    >
                      ✅ JOIN COLLECTION
                    </button>
                  )}
                  <button
                    onClick={setRoyaltyAll}
                    disabled={repairing}
                    className="px-3 py-1 rounded-lg text-xs font-bold"
                    style={{ backgroundColor: repairing ? HAIRLINE : AMBER, color: repairing ? MUTED : INK }}
                  >
                    {repairing ? "WORKING..." : "💰 SET 5% ROYALTY"}
                  </button>
                  <span className="text-xs" style={{ color: MUTED }}>
                    Repair fixes vanished pictures; royalty backfills older mints. One wallet approval each.
                  </span>
                </div>
                {repairMsg && <p className="text-xs mt-1" style={{ color: "#5EC9FF" }}>{repairMsg}</p>}
              </div>
            )}
            {isPremium && collection.filter((c) => c.mintAddress).length >= 2 && (
              <div className="mx-4 mt-2 p-2 rounded-lg border flex flex-wrap items-center gap-2" style={{ borderColor: AMBER }}>
                <span className="text-xs font-bold" style={{ color: AMBER }}>⚔️ CROSSOVER SAGA:</span>
                <span className="text-xs" style={{ color: MUTED }}>check 2+ minted mascots below, then</span>
                <button
                  onClick={generateCrossover}
                  disabled={crossoverLoading || crossoverPicks.length < 2}
                  className="px-3 py-1 rounded-lg text-xs font-bold"
                  style={{ backgroundColor: crossoverPicks.length >= 2 ? AMBER : HAIRLINE, color: crossoverPicks.length >= 2 ? INK : MUTED }}
                >
                  {crossoverLoading ? "WRITING SAGA..." : `GENERATE (${crossoverPicks.length} picked)`}
                </button>
              </div>
            )}
            <div className="p-4">
              {collection.length === 0 && <p className="text-sm text-center py-8" style={{ color: MUTED }}>No saved characters yet. Generate one and hit Save.</p>}
              {collection.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 p-3 mb-2 rounded-lg" style={{ backgroundColor: PANEL2 }}>
                  {isPremium && entry.mintAddress && (
                    <input
                      type="checkbox"
                      checked={crossoverPicks.includes(entry.id)}
                      onChange={() => toggleCrossoverPick(entry.id)}
                      className="shrink-0 accent-yellow-400"
                      title="Select for a Crossover Saga"
                    />
                  )}
                  <MascotSVG archetypes={entry.traits.archetypes || ["Frog"]} colors={entry.traits.colors || ["Neon Green"]} accessories={(entry.traits.accessories || []).filter((a) => a !== entry.traits.aura)} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate" style={{ color: OFFWHITE }}>
                      {entry.result.characterName} · ${entry.result.ticker}
                      {entry.mintAddress && <span className="ml-2" style={{ color: rarityColorMap[entry.mintTier] || LIME }}>◆ {entry.mintTier}</span>}
                      {entry.mintUniverse && <span className="ml-2 font-bold" style={{ color: UNIVERSE_COLORS[entry.mintUniverse] || MUTED }}>{UNIVERSE_ICONS[entry.mintUniverse]} {entry.mintUniverse}</span>}
                      {entry.mintAddress && !entry.mintUniverse && <span className="ml-2 font-bold" style={{ color: "#C8CDD6" }}>✦ Genesis</span>}
                    </p>
                    <p className="text-xs truncate" style={{ color: MUTED }}>
                      {new Date(entry.savedAt).toLocaleDateString()} — {entry.result.tagline}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => loadSaved(entry)} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ backgroundColor: LIME, color: INK }}>Open</button>
                    <button
                      onClick={() => { setShowCollection(false); openStudio(entry); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                      style={{ borderColor: LIME, color: LIME }}
                      title="Generate art, and expand the story if you're Alpha tier"
                    >
                      🎨 Studio
                    </button>
                    <button onClick={() => deleteSaved(entry.id)} style={{ color: MAGENTA }}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      )}

      {profileOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.78)" }}
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border p-4"
            style={{ backgroundColor: PANEL, borderColor: HAIRLINE }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm" style={{ color: AMBER }}>
                ✍️ {profile && profile.username ? "Your author name" : "Claim your author name"}
              </h2>
              <button onClick={() => setProfileOpen(false)} style={{ color: MUTED }}><X size={18} /></button>
            </div>

            <p className="text-xs mb-3 leading-relaxed" style={{ color: MUTED }}>
              This is the byline on every chapter you publish, and the address of your
              public saga page. One wallet, one name — pick it carefully.
            </p>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-black" style={{ color: MUTED }}>@</span>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value.replace(/\s+/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter" && nameCheck === "free") claimUsername(); }}
                placeholder="yourname"
                maxLength={20}
                autoFocus
                className="flex-1 px-3 py-2 rounded-lg text-sm border bg-transparent"
                style={{
                  borderColor:
                    nameCheck === "taken" || nameCheck === "invalid" ? MAGENTA
                    : nameCheck === "free" ? LIME
                    : HAIRLINE,
                  color: OFFWHITE,
                }}
              />
            </div>
            <p className="text-[10px] mb-3 h-4" style={{
              color: nameCheck === "free" ? LIME : nameCheck === "checking" ? MUTED : MAGENTA,
            }}>
              {nameCheck === "invalid" && "3–20 characters: letters, numbers, underscores."}
              {nameCheck === "checking" && "checking…"}
              {nameCheck === "free" && "✓ available"}
              {nameCheck === "taken" && "already claimed — try another."}
              {!nameCheck && "3–20 characters: letters, numbers, underscores."}
            </p>

            {/* Avatar — any mascot this wallet has minted can be the face. */}
            {collection.filter((c) => c.mintAddress && (c.artUrl || c.mintedArtUrl)).length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: MUTED }}>
                  Avatar — pick a minted mascot
                </p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {collection
                    .filter((c) => c.mintAddress && (c.artUrl || c.mintedArtUrl))
                    .map((c) => (
                      <button
                        key={c.mintAddress}
                        onClick={() => setAvatarMint(avatarMint === c.mintAddress ? null : c.mintAddress)}
                        title={c.result?.characterName}
                        className="shrink-0 rounded-lg overflow-hidden border-2"
                        style={{
                          borderColor: avatarMint === c.mintAddress ? LIME : HAIRLINE,
                          width: 48,
                          height: 48,
                        }}
                      >
                        <img
                          src={c.mintedArtUrl || c.artUrl}
                          alt={c.result?.characterName || ""}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                </div>
              </div>
            )}

            {profileError && (
              <p className="text-xs mb-2 break-all" style={{ color: profileError.startsWith("🔗") ? "#5EC9FF" : MAGENTA }}>
                {profileError.startsWith("🔗") ? `Link copied! ${profileError}` : profileError}
              </p>
            )}

            <button
              onClick={claimUsername}
              disabled={profileSaving || nameCheck !== "free"}
              className="w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
              style={{
                backgroundColor: AMBER,
                color: INK,
                opacity: profileSaving || nameCheck !== "free" ? 0.5 : 1,
                cursor: profileSaving || nameCheck !== "free" ? "not-allowed" : "pointer",
              }}
            >
              {profileSaving
                ? <><Loader2 size={14} className="animate-spin" /> CLAIMING…</>
                : profile && profile.username ? "UPDATE MY NAME" : "CLAIM THIS NAME"}
            </button>

            {profile && profile.username && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setProfileOpen(false); openAuthor(profile.username); }}
                  className="flex-1 py-2 rounded-lg text-[11px] font-bold border"
                  style={{ borderColor: "#5EC9FF", color: "#5EC9FF" }}
                >
                  👁 VIEW MY PAGE
                </button>
                <button
                  onClick={async () => {
                    const link = `${window.location.origin}/?a=${encodeURIComponent(profile.username)}`;
                    try { await navigator.clipboard.writeText(link); } catch (e) {}
                    setProfileError(`🔗 ${link}`);
                  }}
                  className="flex-1 py-2 rounded-lg text-[11px] font-bold border"
                  style={{ borderColor: LIME, color: LIME }}
                >
                  🔗 COPY PAGE LINK
                </button>
              </div>
            )}
            <p className="text-[10px] mt-2 leading-snug" style={{ color: MUTED }}>
              Names are case-insensitive and can't be traded. Changing yours later
              moves your published chapters with it — the wallet is the real author.
            </p>
          </div>
        </div>
      )}

      {showCard && studioEntry && (
        <TradingCardView entry={studioEntry} stats={computeStats({ ...studioEntry.traits, characterName: studioEntry.result.characterName, element: studioEntry.mintElement || undefined }, studioEntry.mintTier || null, studioEntry.markedBy || null, studioEntry.ageCard || null, studioEntry.ageNumber || null, !!studioEntry.mintAddress && !studioEntry.mintUniverse)} onClose={() => setShowCard(false)} />
      )}
      {studioEntry && (
        <div
          className={studioPage ? "py-6 px-4" : "fixed inset-0 z-50 flex items-center justify-center p-4"}
          style={studioPage ? {} : { backgroundColor: "rgba(0,0,0,0.75)" }}
          onClick={studioPage ? undefined : () => setStudioEntry(null)}
        >
          <div
            className={studioPage ? "w-full max-w-2xl mx-auto rounded-xl p-[3px]" : "w-full max-w-lg rounded-xl p-[3px]"}
            style={{
              background: "linear-gradient(115deg,#FFD700,#FFF3B0,#FFB627,#FF9DF2,#FFD700)",
              backgroundSize: "300% 300%",
              animation: "holoShift 6s linear infinite",
              boxShadow: "0 0 34px rgba(255,215,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
          <div
            className={studioPage ? "rounded-[10px] w-full overflow-hidden" : "rounded-[10px] w-full max-h-[88vh] overflow-y-auto"}
            style={{ backgroundColor: PANEL }}
          >
            <div className="flex items-center justify-between p-4 border-b sticky top-0 z-10" style={{ borderColor: HAIRLINE, backgroundColor: PANEL }}>
              <h2 className="font-bold text-sm truncate" style={{ color: AMBER }}>★ Story Studio — {studioEntry.result.characterName}</h2>
              <div className="flex items-center gap-1 shrink-0">
              {!studioPage && collection.length > 1 && (
                <>
                  <button
                    onClick={() => legionStep(-1)}
                    title="Previous mascot"
                    className="px-2 py-1 rounded text-xs font-bold border"
                    style={{ borderColor: HAIRLINE, color: OFFWHITE }}
                  >◀</button>
                  <button
                    onClick={() => legionStep(1)}
                    title="Next mascot"
                    className="px-2 py-1 rounded text-xs font-bold border"
                    style={{ borderColor: HAIRLINE, color: OFFWHITE }}
                  >▶</button>
                </>
              )}
              <button
                onClick={() => {
                  if (studioPage) {
                    // This tab was opened by the app, so it can close itself.
                    // If the browser blocks that, gracefully become the normal
                    // app instead of hard-reloading back to the landing page.
                    window.close();
                    setTimeout(() => {
                      try { window.history.replaceState(null, "", window.location.pathname); } catch (e) {}
                      setStudioPage(false);
                      setStudioEntry(null);
                      setTab("studio");
                    }, 200);
                  } else setStudioEntry(null);
                }}
                style={{ color: MUTED }}
              ><X size={18} /></button>
              </div>
            </div>

            <div className="p-4">
              <p className="text-xs mb-4" style={{ color: MUTED }}>
                Expand this character's world. Traits and identity stay locked — the Studio only adds new canon.
              </p>

              {(() => {
                const studioStats = computeStats(
                  { ...studioEntry.traits, characterName: studioEntry.result.characterName, element: studioEntry.mintElement || undefined },
                  studioEntry.mintTier || null,
                  studioEntry.markedBy || null,
                  studioEntry.ageCard || null,
                  studioEntry.ageNumber || null,
                  !!studioEntry.mintAddress && !studioEntry.mintUniverse   // ⏳ Elder
                );
                return <div className="mb-4"><StatPanel stats={studioStats} /></div>;
              })()}

              {/* Life status — drives the saga engine */}
              <div className="mb-4 rounded-lg border p-3" style={{ borderColor: HAIRLINE }}>
                <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: MUTED }}>⚖️ Life Status — drives the story</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[["alive", "🟢 Alive"], ["purgatory", "⚰️ Purgatory"], ["rest", "🌊 At Rest"]].map(([sk, sl]) => (
                    <button
                      key={sk}
                      onClick={() => setEntryStatus(studioEntry, sk)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold border"
                      style={{
                        borderColor: (studioEntry.status || "alive") === sk ? LIME : HAIRLINE,
                        color: (studioEntry.status || "alive") === sk ? INK : OFFWHITE,
                        backgroundColor: (studioEntry.status || "alive") === sk ? LIME : "transparent",
                      }}
                    >
                      {sl}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] mt-1.5 leading-snug" style={{ color: MUTED }}>
                  Dead in the lower universes = 1,000 years in Purgatory (only 1 minute passes here). Empyrion-born rest above the cosmic waterfall. Every story honors the status you set.
                </p>
              </div>

              <div className="mb-4 rounded-lg border p-3" style={{ borderColor: HAIRLINE }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-widest" style={{ color: LIME }}>🎨 Character Art</p>
                  <span className="text-xs" style={{ color: MUTED }}>{regenInfo || (isPaid ? "Included with your plan" : "Paid tiers")}</span>
                </div>
                {studioEntry.artUrl ? (
                  <>
                  <img
                    key={imgRetryKey}
                    src={studioEntry.artUrl}
                    alt={studioEntry.result.characterName}
                    className="w-full rounded-lg"
                    onError={() => { if (!imgFailed) { setImgFailed(true); setImgRetryKey((k) => k + 1); } }}
                  />
                  {(studioEntry.artHistory || []).length > 1 && (
                    <div className="mt-2">
                      <p className="text-[10px] mb-1" style={{ color: MUTED }}>ART HISTORY — tap any version to restore it{studioEntry.mintedArtUrl ? " · 🔒 = the image locked into the minted NFT" : ""}</p>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {studioEntry.artHistory.map((u, hi) => (
                          <button
                            key={hi}
                            onClick={() => {
                              const next = collection.map((c) => (c.id === studioEntry.id ? { ...c, artUrl: u } : c));
                              persistCollection(next);
                              setStudioEntry((s) => ({ ...s, artUrl: u }));
                            }}
                            className="relative shrink-0 rounded overflow-hidden border-2"
                            style={{ borderColor: u === studioEntry.artUrl ? LIME : HAIRLINE, width: 52, height: 52 }}
                          >
                            {u !== studioEntry.artUrl && u !== studioEntry.mintedArtUrl && (
                              <span
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  const hist = (studioEntry.artHistory || []).filter((x) => x !== u);
                                  const next = collection.map((c) => (c.id === studioEntry.id ? { ...c, artHistory: hist } : c));
                                  persistCollection(next);
                                  setStudioEntry((s) => ({ ...s, artHistory: hist }));
                                }}
                                title="Delete this version"
                                className="absolute top-0 right-0 text-[9px] leading-none px-1 py-0.5 rounded-bl"
                                style={{ color: "#FF6B6B", backgroundColor: "rgba(0,0,0,0.65)" }}
                              >
                                ✕
                              </span>
                            )}
                            <img src={u} alt={`v${hi + 1}`} className="w-full h-full object-cover" />
                            {u === studioEntry.mintedArtUrl && (
                              <span className="absolute bottom-0 right-0 text-[9px] px-0.5" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>🔒</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {studioEntry.videoUrl && (
                    <>
                      <video src={studioEntry.videoUrl} controls loop className="w-full rounded-lg mt-2" />
                      <a
                        href={studioEntry.videoUrl}
                        download={`${studioEntry.result.characterName || "mascot"}-clip.mp4`}
                        target={EXT_TAB}
                        rel="noreferrer"
                        className="block w-full mt-1 py-2 rounded-lg text-xs font-bold text-center"
                        style={{ backgroundColor: "#5EC9FF", color: INK }}
                      >
                        ⬇️ DOWNLOAD VIDEO — post it anywhere (TikTok, X, IG)
                      </a>
                    </>
                  )}
                  <button
                    onClick={() => setShowCard(true)}
                    className="w-full mt-2 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "linear-gradient(135deg,#E5E4E2,#A8A9AD)", color: INK }}
                  >
                    🃏 CARD VIEW — see the full trading card
                  </button>
                  <div className="flex gap-2 mt-2">
                    {(!studioEntry.result.bio || !(studioEntry.result.originStory || []).length || !studioEntry.result.visualDescription) && (
                      <button
                        onClick={() => rebuildProfile(studioEntry)}
                        disabled={rebuildLoading}
                        className="flex-1 py-2 rounded-lg text-[11px] font-bold"
                        style={{ backgroundColor: "#5EC9FF", color: INK, opacity: rebuildLoading ? 0.6 : 1 }}
                      >
                        {rebuildLoading ? "🔧 Restoring…" : "🔧 Rebuild profile"}
                      </button>
                    )}
                    <button
                      onClick={() => exportStory(studioEntry)}
                      className="flex-1 py-2 rounded-lg text-[11px] font-bold border"
                      style={{ borderColor: "#FF9F1C", color: "#FF9F1C" }}
                      title="Print or save every chapter as a PDF"
                    >
                      🖨️ Export the saga
                    </button>
                    <button
                      onClick={() => shareMascot(studioEntry)}
                      className="flex-1 py-2 rounded-lg text-[11px] font-bold border"
                      style={{ borderColor: "#5EC9FF", color: "#5EC9FF" }}
                      title="Publish a public page for this character and copy the link"
                    >
                      🔗 Share page
                    </button>
                  </div>
                  {shareMsg && <p className="text-xs mt-1 break-all" style={{ color: "#5EC9FF" }}>{shareMsg}</p>}
                  </>
                ) : (
                  <div className="flex flex-col items-center py-6">
                    <MascotSVG archetypes={studioEntry.traits.archetypes || ["Frog"]} colors={studioEntry.traits.colors || ["Neon Green"]} accessories={(studioEntry.traits.accessories || []).filter((a) => a !== studioEntry.traits.aura)} size={120} />
                    <p className="text-xs mt-2 text-center" style={{ color: MUTED }}>No art yet — generate a real illustration below.</p>
                  </div>
                )}
                <button
                  onClick={() => generateArt(studioEntry)}
                  disabled={artLoadingFor === studioEntry.id || (!isPaid && artCredits <= 0)}
                  className="btn-a w-full mt-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                  style={{ backgroundColor: LIME, color: INK, opacity: artLoadingFor === studioEntry.id ? 0.6 : 1 }}
                >
                  {artLoadingFor === studioEntry.id ? (
                    <><Loader2 size={14} className="animate-spin" /> GENERATING ART...</>
                  ) : studioEntry.artUrl ? (
                    "🎨 Regenerate Art (1 credit)"
                  ) : (
                    "🎨 Generate Art (1 credit)"
                  )}
                </button>
                {artError && <p className="text-xs mt-2" style={{ color: MAGENTA }}>{artError}</p>}
              </div>

              {studioEntry.artUrl && (
                <div className="mb-4 p-3 rounded-lg border" style={{ borderColor: AMBER }}>
                  <p className="text-xs uppercase tracking-widest mb-2" style={{ color: AMBER }}>💎 Mint as NFT</p>
                  {studioEntry.mintAddress ? (
                    <div className="text-center py-2">
                      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Minted On-Chain</p>
                      <p className="text-2xl font-bold mb-2" style={{ color: rarityColorMap[studioEntry.mintTier] || AMBER }}>
                        {studioEntry.mintTier === "Super Legendary" ? "✧ SUPER LEGENDARY ✧" : <>{studioEntry.mintTier === "Legendary" && "⭐ "}{(studioEntry.mintTier || "").toUpperCase()}{studioEntry.mintTier === "Legendary" && " ⭐"}</>}
                      </p>
                      {studioEntry.mintTier === "Legendary" && studioEntry.mintSeason && (
                        <p className="text-xs mb-2" style={{ color: AMBER }}>Season {studioEntry.mintSeason} Legendary</p>
                      )}
                      {studioEntry.mintUniverse === "Empyrion" && (
                        <p className="text-xs mb-2 holo-text">⭐ BORN IN EMPYRION — THE NORTH UNIVERSE</p>
                      )}
                      {studioEntry.mintUniverse && studioEntry.mintUniverse !== "Empyrion" && (
                        <p className="text-xs mb-2 font-bold" style={{ color: UNIVERSE_COLORS[studioEntry.mintUniverse] || MUTED }}>
                          {UNIVERSE_ICONS[studioEntry.mintUniverse]} BORN IN {studioEntry.mintUniverse.toUpperCase()}
                        </p>
                      )}
                      {!studioEntry.mintUniverse && (
                        <p className="text-xs mb-2 font-bold" style={{ color: "#C8CDD6" }}>✦ GENESIS ERA — pre-Pentaverse</p>
                      )}
                      <a href={`https://explorer.solana.com/address/${studioEntry.mintAddress}`} target={EXT_TAB} rel="noopener noreferrer" className="inline-block text-xs font-bold" style={{ color: LIME, textDecoration: "underline" }}>
                        View on Solana Explorer ↗
                      </a>

                      {/* 🔥 THE BURN — the only irreversible action in MascotGen.
                          Two steps, and the second makes you type the name, so
                          nothing here can happen by accident. Deliberately plain
                          and unglamorous: this is not a feature to encourage. */}
                      <div className="mt-4 pt-3 border-t text-left" style={{ borderColor: HAIRLINE }}>
                        {burnTarget && burnTarget.id === studioEntry.id ? (
                          <div className="rounded-lg border p-3" style={{ borderColor: MAGENTA, backgroundColor: "rgba(255,62,165,0.06)" }}>
                            <p className="text-[11px] font-black mb-1" style={{ color: MAGENTA }}>🔥 BURN THIS MASCOT — PERMANENT</p>
                            <p className="text-[10px] mb-2 leading-relaxed" style={{ color: MUTED }}>
                              The NFT is destroyed on Solana forever. Nobody can undo this — not you, not us, not Solana.
                              Its written chapters stay in your canon; only the asset dies.
                              Type <b style={{ color: OFFWHITE }}>{studioEntry.result.characterName}</b> to confirm.
                            </p>
                            <input
                              value={burnConfirm}
                              onChange={(e) => setBurnConfirm(e.target.value)}
                              placeholder="Type the character's name"
                              className="w-full mb-2 px-3 py-2 rounded-lg text-xs"
                              style={{ backgroundColor: "rgba(0,0,0,0.4)", border: "1px solid #33303F", color: OFFWHITE }}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setBurnTarget(null); setBurnConfirm(""); setBurnMsg(""); }}
                                disabled={burning}
                                className="flex-1 py-2 rounded-lg text-xs font-bold border"
                                style={{ borderColor: HAIRLINE, color: OFFWHITE }}
                              >Keep it</button>
                              <button
                                onClick={doBurn}
                                disabled={burning || burnConfirm.trim().toLowerCase() !== String(studioEntry.result.characterName || "").trim().toLowerCase()}
                                className="flex-1 py-2 rounded-lg text-xs font-black"
                                style={{
                                  backgroundColor: burnConfirm.trim().toLowerCase() === String(studioEntry.result.characterName || "").trim().toLowerCase() ? MAGENTA : HAIRLINE,
                                  color: burnConfirm.trim().toLowerCase() === String(studioEntry.result.characterName || "").trim().toLowerCase() ? INK : "#4A4756",
                                  opacity: burning ? 0.6 : 1,
                                }}
                              >{burning ? "BURNING…" : "🔥 BURN FOREVER"}</button>
                            </div>
                            {burnMsg && <p className="text-[11px] mt-2" style={{ color: MAGENTA }}>{burnMsg}</p>}
                          </div>
                        ) : (
                          <button
                            onClick={() => { setBurnTarget(studioEntry); setBurnConfirm(""); setBurnMsg(""); }}
                            className="text-[10px] underline"
                            style={{ color: "#5A5468" }}
                            title="Permanently destroy this NFT on-chain"
                          >
                            🔥 burn this mascot
                          </button>
                        )}
                      </div>

                      {/* 🚀 Guided token launch — link a token you launched. */}
                      <div className="mt-4 pt-3 border-t text-left" style={{ borderColor: HAIRLINE }}>
                        {studioEntry.tokenAddress ? (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: AMBER }}>🚀 Token linked</p>
                            <a href={studioEntry.tokenUrl || `https://pump.fun/coin/${studioEntry.tokenAddress}`} target={EXT_TAB} rel="noopener noreferrer" className="text-xs font-bold break-all" style={{ color: LIME }}>
                              {studioEntry.tokenAddress.slice(0, 8)}…{studioEntry.tokenAddress.slice(-6)} — view on pump.fun ↗
                            </a>
                            <button onClick={() => setTokenForm({ open: true, address: studioEntry.tokenAddress, telegram: studioEntry.tokenTelegram || "" })} className="block text-[10px] mt-1 underline" style={{ color: MUTED }}>edit</button>
                          </div>
                        ) : !tokenForm.open ? (
                          <button onClick={() => setTokenForm({ open: true, address: "", telegram: "" })} className="w-full py-2 rounded-lg text-xs font-bold border" style={{ borderColor: AMBER, color: AMBER }}>
                            🚀 Launched a token? Link it →
                          </button>
                        ) : null}
                        {tokenForm.open && (
                          <div className="mt-2">
                            <p className="text-[10px] mb-2 leading-snug" style={{ color: MUTED }}>
                              Launch your token on pump.fun (use 🚀 LAUNCH PACKAGE for the copy-paste fields), then paste its token address here. MascotGen never launches or holds tokens — you do, from your own wallet.
                            </p>
                            <input value={tokenForm.address} onChange={(e) => setTokenForm((f) => ({ ...f, address: e.target.value }))} placeholder="pump.fun token address" className="w-full px-3 py-2 rounded-lg text-xs border bg-transparent mb-2" style={{ borderColor: HAIRLINE, color: OFFWHITE }} />
                            <input value={tokenForm.telegram} onChange={(e) => setTokenForm((f) => ({ ...f, telegram: e.target.value }))} placeholder="Telegram link (optional)" className="w-full px-3 py-2 rounded-lg text-xs border bg-transparent mb-2" style={{ borderColor: HAIRLINE, color: OFFWHITE }} />
                            <div className="flex gap-2">
                              <button onClick={() => linkToken(studioEntry)} disabled={tokenSaving || !tokenForm.address.trim()} className="btn-a flex-1 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: AMBER, color: INK, opacity: tokenSaving || !tokenForm.address.trim() ? 0.5 : 1 }}>
                                {tokenSaving ? "LINKING…" : "LINK TOKEN"}
                              </button>
                              <button onClick={() => setTokenForm({ open: false, address: "", telegram: "" })} className="px-3 py-2 rounded-lg text-xs font-bold border" style={{ borderColor: HAIRLINE, color: MUTED }}>Cancel</button>
                            </div>
                          </div>
                        )}
                        {tokenMsg && <p className="text-[10px] mt-2" style={{ color: "#5EC9FF" }}>{tokenMsg}</p>}
                      </div>
                    </div>
                  ) : !mintResult ? (
                    <>
                      <p className="text-xs mb-3" style={{ color: MUTED }}>
                        Permanently mint this character on Solana. Your rarity tier AND birth universe are rolled at mint — never chosen. A small SOL network fee applies, paid by your wallet.
                      </p>
                      {!connected && <p className="text-xs mb-2" style={{ color: MAGENTA }}>Connect your wallet (top-right) to mint.</p>}
                      {!connected && isMobileNoWallet && (
                        <div className="rounded-lg border p-3 mb-3" style={{ borderColor: HAIRLINE, backgroundColor: PANEL2 }}>
                          <p className="text-xs font-bold mb-1" style={{ color: OFFWHITE }}>📱 Minting from your phone?</p>
                          <p className="text-[11px] mb-2 leading-relaxed" style={{ color: MUTED }}>
                            Wallet apps open their own private browser, which can't see the mascot you made here. These buttons carry it over safely — you'll land right back on this screen inside your wallet, ready to mint.
                          </p>
                          <div className="flex gap-2">
                            <button onClick={() => handoffToWallet(studioEntry, "phantom")} className="btn-a flex-1 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: "#AB9FF2", color: INK }}>
                              OPEN IN PHANTOM
                            </button>
                            <button onClick={() => handoffToWallet(studioEntry, "solflare")} className="btn-a flex-1 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: "#FC7227", color: INK }}>
                              OPEN IN SOLFLARE
                            </button>
                          </div>
                          {handoffMsg && <p className="text-[11px] mt-2" style={{ color: LIME }}>{handoffMsg}</p>}
                        </div>
                      )}
                      <button
                        onClick={() => mintNFT(studioEntry)}
                        disabled={minting || !connected}
                        className="btn-a w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                        style={{ backgroundColor: AMBER, color: INK, opacity: minting || !connected ? 0.6 : 1, cursor: minting || !connected ? "not-allowed" : "pointer" }}
                      >
                        {minting ? <><Loader2 size={14} className="animate-spin" /> {mintStatus || "MINTING..."}</> : "💎 MINT AS NFT"}
                      </button>
                      {/* ⚜️ The granted champion mint — free, no pack roll, no allowance. */}
                      {champStatus && champStatus.pending && !champStatus.minted && (
                        <button
                          onClick={() => mintNFT(studioEntry, champStatus.pending)}
                          disabled={minting || !connected}
                          className="w-full mt-2 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-2"
                          style={{ background: "linear-gradient(135deg,#FFD700,#FF9F1C)", color: INK, opacity: minting || !connected ? 0.6 : 1 }}
                        >
                          ⚜️ MINT AS CHAMPION #{champStatus.pending.ageNumber} — ON THE HOUSE
                        </button>
                      )}
                      {mintError && <p className="text-xs mt-2" style={{ color: MAGENTA }}>{mintError}</p>}
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>You pulled</p>
                      <p className="text-2xl font-bold mb-2" style={{ color: rarityColorMap[mintResult.tier] || OFFWHITE }}>
                        {mintResult.tier === "Super Legendary" ? "✧ SUPER LEGENDARY ✧" : <>{mintResult.tier === "Legendary" && "⭐ "}{(mintResult.tier || "").toUpperCase()}{mintResult.tier === "Legendary" && " ⭐"}</>}
                      </p>
                      {mintResult.tier === "Super Legendary" && (
                        <p className="text-xs mb-2 font-bold" style={{ color: "#FF9DF2" }}>
                          A GOD AWAKENS{mintResult.godNumber ? ` — THRONE #${mintResult.godNumber} OF 11` : ""}
                        </p>
                      )}
                      {mintResult.tier === "Legendary" && (
                        <p className="text-xs mb-2" style={{ color: AMBER }}>
                          {mintResult.season ? `Season ${mintResult.season} Legendary — a limited seasonal pull.` : "A limited Legendary pull."}
                        </p>
                      )}
                      {mintResult.markNumber && (
                        <p className="text-xs mb-2 font-bold" style={{ color: "#FFF3B0" }}>
                          ✋ GOD-MARKED #{mintResult.markNumber}/777 — Throne {mintResult.markedBy} reached down
                        </p>
                      )}
                      {mintResult.ageCard && AGE_CARDS[mintResult.ageCard] && (
                        <p className="text-xs mb-2 font-bold" style={{ color: "#FFD700" }}>
                          {AGE_CARDS[mintResult.ageCard].icon} {AGE_CARDS[mintResult.ageCard].name.toUpperCase()} #{mintResult.ageNumber} of {AGE_CARDS[mintResult.ageCard].supply} — {AGE_CARDS[mintResult.ageCard].hp} BATTLE HP
                        </p>
                      )}
                      {mintResult.universe === "Empyrion" && (
                        <p className="text-xs mb-2 holo-text">⭐ BORN IN EMPYRION — THE NORTH UNIVERSE</p>
                      )}
                      {mintResult.universe && mintResult.universe !== "Empyrion" && (
                        <p className="text-xs mb-2 font-bold" style={{ color: UNIVERSE_COLORS[mintResult.universe] || MUTED }}>
                          {UNIVERSE_ICONS[mintResult.universe]} BORN IN {mintResult.universe.toUpperCase()}
                        </p>
                      )}
                      <a href={mintResult.explorerUrl} target={EXT_TAB} rel="noopener noreferrer" className="inline-block mt-1 text-xs font-bold" style={{ color: LIME, textDecoration: "underline" }}>
                        View on Solana Explorer ↗
                      </a>
                    </div>
                  )}
                </div>
              )}

              {isPaid ? (
                <>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <button onClick={() => expandCharacter("panels")} disabled={studioLoading} className="px-3 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: LIME, color: LIME }}>
                      +4 Story Panels
                    </button>
                    <button onClick={() => expandCharacter("fight")} disabled={studioLoading} className="px-3 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: MAGENTA, color: MAGENTA }}>
                      ⚔️ +12-16 FIGHT SCENE
                    </button>
                  </div>
                  <div className="mb-2">
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>
                      📓 Writer's Bible <span style={{ textTransform: "none", letterSpacing: 0 }}>— saved with this character and given to the story AI every chapter (voice, motives, backstory, rules). Minted mascots sync it across your devices.</span>
                      {bibleSaved && <span style={{ textTransform: "none", letterSpacing: 0, color: LIME, marginLeft: 6 }}>{bibleSaved}</span>}
                    </p>
                    <textarea
                      value={studioEntry.characterNotes || ""}
                      onChange={(ev) => {
                        const notes = ev.target.value;
                        setStudioEntry((s) => ({ ...s, characterNotes: notes }));
                        persistCollection(collection.map((c) => (c.id === studioEntry.id ? { ...c, characterNotes: notes } : c)));
                        saveBibleRemote(studioEntry, notes);
                      }}
                      rows={3}
                      placeholder="Paste this character's bible here once — who they are, how they talk, what they want, lines they'd say. Every future chapter will follow it."
                      className="w-full px-3 py-2 rounded-lg text-xs border bg-transparent resize-y"
                      style={{ borderColor: "#443A2A", color: OFFWHITE, minHeight: 64 }}
                    />
                  </div>
                  <div>
                    <textarea
                      value={studioInput}
                      onChange={(e) => setStudioInput(e.target.value)}
                      rows={3}
                      placeholder={'Or ask anything — describe the next chapter in as much detail as you want:\n"panels where they meet a rival at the world championship"\n"a flashback to their childhood in the swamp"'}
                      className="w-full px-3 py-2 rounded-lg text-xs border bg-transparent resize-y"
                      style={{ borderColor: HAIRLINE, color: OFFWHITE, minHeight: 72 }}
                    />
                    <button onClick={() => expandCharacter("custom")} disabled={studioLoading} className="btn-a w-full mt-1 px-4 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: AMBER, color: INK }}>
                      {studioLoading ? <Loader2 size={14} className="animate-spin" /> : "EXPAND THE STORY"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border p-3 text-center" style={{ borderColor: HAIRLINE }}>
                  <p className="text-xs" style={{ color: MUTED }}>The Story Studio is for subscribers — any paid plan unlocks it.</p>
                  <button
                    onClick={() => {
                      // The Studio can be a FULL TAB, where the main app is not
                      // rendered — so we must leave studio mode, not just clear
                      // the entry, or the page goes blank with no way back.
                      try { window.history.replaceState(null, "", window.location.pathname); } catch (e) {}
                      setStudioPage(false);
                      setStudioEntry(null);
                      setShowCollection(false);
                      setTab("pricing");
                    }}
                    className="mt-2 text-xs font-bold"
                    style={{ color: AMBER }}
                  >
                    See plans →
                  </button>
                </div>
              )}

              {studioError && <p className="text-xs mt-2" style={{ color: MAGENTA }}>{studioError}</p>}

              <div className="mt-2 text-right">
                <button onClick={() => setPasteOpen((v) => !v)} className="text-[10px] underline" style={{ color: MUTED }}>
                  {pasteOpen ? "✕ close" : "➕ paste / restore a chapter"}
                </button>
              </div>
              {pasteOpen && (
                <div className="mt-1 rounded-lg border p-3" style={{ borderColor: "#5EC9FF", backgroundColor: "rgba(94,201,255,0.05)" }}>
                  <input
                    value={pasteTitle}
                    onChange={(e) => setPasteTitle(e.target.value)}
                    placeholder="Chapter title"
                    className="w-full px-3 py-2 rounded-lg text-xs border bg-transparent mb-2"
                    style={{ borderColor: HAIRLINE, color: OFFWHITE }}
                  />
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={"Paste the chapter text — separate each panel with a BLANK LINE."}
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg text-xs border bg-transparent mb-2"
                    style={{ borderColor: HAIRLINE, color: OFFWHITE }}
                  />
                  <button
                    onClick={addPastedChapter}
                    disabled={!pasteText.trim()}
                    className="w-full py-2 rounded-lg text-xs font-bold"
                    style={{ backgroundColor: "#5EC9FF", color: INK, opacity: pasteText.trim() ? 1 : 0.5 }}
                  >
                    SAVE TO CANON — permanent, on every device
                  </button>
                </div>
              )}

              {studioEntry.expansions && studioEntry.expansions.length > 0 && (
                <div className="mt-4">
                  {studioEntry.expansions.map((exp, i) => (
                    <div key={i} className="mb-3">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <p className="text-xs font-bold truncate" style={{ color: LIME }}>{exp.title}</p>
                        <div className="flex items-center gap-1 flex-none">
                          {(() => {
                            const live = publishedRow(studioEntry, exp);
                            const busy = publishing === i;
                            if (!studioEntry.mintAddress) {
                              return (
                                <span
                                  className="text-[10px] px-2 py-0.5 rounded border"
                                  style={{ borderColor: HAIRLINE, color: MUTED }}
                                  title="Publishing is for minted mascots — mint this one to put its saga on your author page."
                                >
                                  📖 mint to publish
                                </span>
                              );
                            }
                            return (
                              <button
                                onClick={() => (live ? unpublishChapter(live, i) : publishChapter(studioEntry, exp, i))}
                                disabled={busy}
                                title={live
                                  ? "Live on your public author page — tap to take it down"
                                  : "Publish this chapter to your public author page"}
                                className="text-[10px] px-2 py-0.5 rounded border flex items-center gap-1"
                                style={{
                                  borderColor: live ? LIME : "#5EC9FF",
                                  color: live ? LIME : "#5EC9FF",
                                  opacity: busy ? 0.5 : 1,
                                }}
                              >
                                {busy
                                  ? <><Loader2 size={10} className="animate-spin" /> …</>
                                  : live ? "✓ PUBLISHED" : "📖 PUBLISH"}
                              </button>
                            );
                          })()}
                          <button
                            onClick={() => setPendingDelete({ type: "chapter", ci: i })}
                            className="text-[10px] px-2 py-0.5 rounded border flex-none"
                            style={{ borderColor: "#FF6B6B", color: "#FF6B6B" }}
                          >
                            🗑 DELETE
                          </button>
                        </div>
                      </div>

                      {pendingDelete && pendingDelete.ci === i && (
                        <div className="mb-2 p-3 rounded-lg border" style={{ borderColor: "#FF6B6B", backgroundColor: "rgba(255,107,107,0.08)" }}>
                          <p className="text-xs font-bold" style={{ color: "#FF6B6B" }}>
                            ⚠️ PERMANENT DELETE —{" "}
                            {pendingDelete.type === "chapter"
                              ? `the entire chapter "${exp.title}" and all ${(exp.panels || []).length} of its panels`
                              : `panel ${pendingDelete.pi + 1} of "${exp.title}"`}
                          </p>
                          <p className="text-xs mt-1" style={{ color: MUTED }}>
                            This erases it from your collection AND from this mascot's permanent canon record. It cannot be undone, and Sync Wallet will not bring it back. Use 🖨️ EXPORT THE SAGA first if you want a copy.
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button onClick={confirmDelete} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ backgroundColor: "#FF6B6B", color: INK }}>
                              YES — DELETE FOREVER
                            </button>
                            <button onClick={() => setPendingDelete(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: HAIRLINE, color: MUTED }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {(exp.panels || []).map((p, j) => (
                          <div key={j} className="text-xs p-2 pr-6 rounded-lg relative" style={{ backgroundColor: PANEL2, color: OFFWHITE }}>
                            <button
                              onClick={() => setPendingDelete({ type: "panel", ci: i, pi: j })}
                              title="Permanently delete this panel"
                              className="absolute top-1 right-1 text-[10px] leading-none px-1.5 py-1 rounded"
                              style={{ color: "#FF6B6B", backgroundColor: "rgba(0,0,0,0.45)" }}
                            >
                              ✕
                            </button>
                            {p}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {publishMsg && (
                <p className="text-xs mt-2" style={{ color: "#5EC9FF" }}>{publishMsg}</p>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
