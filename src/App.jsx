import React, { useState, useEffect } from "react";
import { Dice5, Sparkles, Loader2, RefreshCw, Globe, CreditCard, Save, FolderOpen, Trash2, X, Wallet } from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { mintCharacterNFT } from "./mint.js";
import { computeStats } from "./stats.js";

const INK = "#14121A";
const PANEL = "#1D1A26";
const LIME = "#C6FF3D";
const MAGENTA = "#FF3EA5";
const AMBER = "#FFB627";
const OFFWHITE = "#F2F0F5";
const MUTED = "#8B87A0";

const ARCHETYPES_COMMON = ["Animal", "Dog", "Cat", "Frog", "Bear", "Hamster", "Penguin", "Food", "Plant", "Object", "Human-like", "Bird", "Fish", "Rabbit", "Mouse", "Baby"];
const ARCHETYPES_RARE = ["Ape", "Creature", "Robot", "Insect", "Blob", "Dragon", "Dino", "Slime"];
const ARCHETYPES = [...ARCHETYPES_COMMON, ...ARCHETYPES_RARE];
const ALPHA_ARCHETYPES = ["Bull", "Ghost", "Zombie", "Alien", "Fighter", "Demon", "Angel"];
const VIBES_COMMON = ["Degen", "Wholesome", "Chaotic", "Heroic", "Comedic", "Corporate", "Zen", "Lovestruck", "Flirty", "FOMO", "Sarcastic", "Clumsy", "Cocky", "Sleepy", "Hyper", "Grumpy", "Curious"];
const VIBES_RARE = ["Mysterious", "Villainous", "Feral", "Royal", "Unhinged", "Sad Boi / Melancholy", "Vengeful", "Enlightened", "Rebellious"];
const VIBES = [...VIBES_COMMON, ...VIBES_RARE];
const ALPHA_VIBES = ["Superpowers", "Genius", "Brawler", "Immortal"];
const WORLDS_COMMON = ["Space", "Fantasy", "Street Culture", "Corporate Satire", "Ocean", "Jungle", "Cyberpunk", "Wild West", "Retro Arcade", "Gym / Fitness", "Beach Paradise", "City", "Island", "Boat", "Casino", "Mountain", "Pyramids", "Zoo", "Restaurant", "Mall", "Airport", "Desert", "Forest", "Stadium", "Farm", "Snow Peaks", "Volcano", "Swamp", "Racetrack", "Nightclub"];
const WORLDS_RARE = ["Heaven & Clouds", "Haunted Mansion", "Las Vegas", "Circus / Carnival", "Post-Apocalyptic", "Underworld", "Ancient Ruins", "Floating City", "Dreamscape"];
const WORLDS = [...WORLDS_COMMON, ...WORLDS_RARE];
const ALPHA_WORLDS = ["Boxing Ring", "Octagon Ring", "The Moon", "Mars Colony"];
const COLORS_COMMON = ["Neon Green", "Hot Pink", "Deep Purple", "Cyan", "Blood Red", "Electric Blue", "Toxic Orange", "Black & White", "Lavender", "Mint", "Sunset Orange", "Forest Green", "Crimson", "Sky Blue"];
const COLORS_RARE = ["Rainbow", "Chrome Silver", "Bubblegum", "Midnight Blue", "Acid Yellow", "Holographic", "Galaxy", "Rose Gold"];
const COLORS = [...COLORS_COMMON, ...COLORS_RARE];
const ALPHA_COLORS = ["Gold", "Platinum", "Diamond"];
const ACCESSORIES_COMMON = ["Wif Hat (Knit Beanie)", "Long Lashes", "Glam Nails", "Long Flowing Hair", "Designer Purse", "Earrings", "Basic Sneakers", "Sunglasses", "Chain", "Cape", "Headphones", "Rocket Backpack", "Halo", "Devil Horns", "Cowboy Hat", "Sweater", "Shorts", "Scarf", "Backpack", "Wristband", "Bandana", "Face Mask"];
const ACCESSORIES_RARE = ["Laser Eyes", "Diamond Hands", "Green Candle", "Rolex", "Harp", "Sword", "Katana", "Crown", "Cigar", "Jetpack", "Wings", "Shield"];
const ACCESSORIES = [...ACCESSORIES_COMMON, ...ACCESSORIES_RARE];
const ALPHA_ACCESSORIES = ["Golden Wif Hat", "Cyber Visor", "Hype Kicks", "Guitar", "Lollipop", "Gun", "Boxing Gloves", "Flaming Sword", "Angel Wings"];
const AURAS = ["None", "Dragon Aura", "Ultimate Aura", "Blessed Aura"];
const ART_STYLES_COMMON = ["Hand-Drawn Sketch", "Sticker / Chibi", "Western Comic", "3D Render"];
const ART_STYLES_RARE = ["Anime / Manga", "Pixel Art"];
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
};

function Chip({ label, active, onClick, accent, dim }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-sm font-medium rounded-full border transition-all duration-150"
      style={{
        borderColor: active ? accent : "#33303F",
        color: active ? INK : dim ? "#5A5670" : OFFWHITE,
        backgroundColor: active ? accent : "transparent",
      }}
    >
      {label}
    </button>
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
    stats.tier === "Legendary" ? "#FFD700" :
    stats.tier === "Epic" ? "#C77DFF" :
    stats.tier === "Rare" ? "#5EC9FF" : "#9A94AD";
  return (
    <div className="w-full rounded-lg border p-3" style={{ borderColor: "#33303F", backgroundColor: "rgba(0,0,0,0.25)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold tracking-widest" style={{ color: MUTED }}>BATTLE CARD</span>
        {stats.tier && (
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: tierColor, color: INK }}>
            {stats.tier}
          </span>
        )}
      </div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold w-8" style={{ color: MUTED }}>{r.label}</span>
          <div className="flex-1 flex gap-0.5">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <div
                key={n}
                className="flex-1 rounded-sm"
                style={{ height: "10px", backgroundColor: n <= r.value ? r.color : "#2A2733" }}
              />
            ))}
          </div>
          <span className="text-xs font-bold w-4 text-right" style={{ color: OFFWHITE }}>{r.value}</span>
        </div>
      ))}
      {!compact && (
        <div className="mt-2 pt-2 border-t" style={{ borderColor: "#33303F" }}>
          <p className="text-xs" style={{ color: MUTED }}>
            Battle HP: <span style={{ color: OFFWHITE }}>{stats.hpPoints}</span>
          </p>
          <p className="text-xs" style={{ color: MUTED }}>
            Signature: <span style={{ color: "#FFD700" }}>⚡ {stats.signatureMove.name}</span> — {stats.signatureMove.desc}
          </p>
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
            <path d="M70 158 Q68 150 76 150 L92 150 Q98 150 98 158 Z" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
            <path d="M102 158 Q102 150 108 150 L124 150 Q132 150 130 158 Z" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
            <rect x="70" y="155" width="28" height="3" fill={INK} opacity="0.3" />
            <rect x="102" y="155" width="28" height="3" fill={INK} opacity="0.3" />
          </g>
        );
      case "Hype Kicks":
        return (
          <g key={i}>
            <path d="M66 158 Q64 146 76 146 L94 146 Q100 148 100 158 Z" fill="#FF3EA5" stroke={INK} strokeWidth="2" />
            <path d="M100 158 Q100 148 106 146 L124 146 Q136 146 134 158 Z" fill="#5EC9FF" stroke={INK} strokeWidth="2" />
            <path d="M70 152 Q80 148 92 151" fill="none" stroke="#FFD700" strokeWidth="2.5" />
            <path d="M108 152 Q118 148 130 151" fill="none" stroke="#FFD700" strokeWidth="2.5" />
            <circle cx="72" cy="144" r="2" fill="#FFD700" />
            <circle cx="128" cy="144" r="2" fill="#FFD700" />
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
            <path d="M68 148 L68 168 L84 168 L86 156 L88 168 L104 168 L104 148 Z" fill="#3D9EFF" transform="translate(8,0)" />
            <rect x="66" y="146" width="46" height="8" rx="3" fill="#2B7ACC" transform="translate(8,0)" />
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
      default:
        return null;
    }
  };

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
      {archetypes[1] && <g opacity="0.35" transform="translate(8,-6) scale(0.95)">{shapeFor(archetypes[1], fill)}</g>}
      {shapeFor(archetypes[0] || "Animal", fill)}
      {eyes()}
      {accessories.map((a, i) => overlayFor(a, i))}
    </svg>
  );
}

function WebsitePreview({ result, traits }) {
  if (!result) return null;
  const fill = COLOR_HEX[traits.colors[0]] === "RAINBOW" ? LIME : COLOR_HEX[traits.colors[0]] || LIME;
  return (
    <div className="w-full rounded-xl border overflow-hidden" style={{ borderColor: "#2A2733", backgroundColor: PANEL }}>
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#2A2733" }}>
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
          <button className="px-5 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: fill, color: INK }}>
            BUY ON PUMP.FUN
          </button>
          <button className="px-5 py-2 rounded-lg text-xs font-bold border" style={{ borderColor: fill, color: fill }}>
            JOIN TELEGRAM
          </button>
        </div>
      </div>

      <div className="px-6 py-8 border-t" style={{ borderColor: "#2A2733" }}>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: MUTED }}>
          About {result.characterName}
        </p>
        <p className="text-sm leading-relaxed" style={{ color: OFFWHITE }}>
          {result.bio}
        </p>
      </div>

      <div className="px-6 py-8 border-t grid grid-cols-3 gap-4 text-center" style={{ borderColor: "#2A2733" }}>
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

      <div className="px-6 py-4 border-t text-center text-xs" style={{ borderColor: "#2A2733", color: MUTED }}>
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

function HomePage({ onStart, fullscreen }) {
  const rain = [
    { archetypes: ["Frog"], accessories: ["Sunglasses"], left: "5%", dur: "9s", delay: "0s", size: 56 },
    { archetypes: ["Dog"], accessories: ["Wif Hat (Knit Beanie)"], left: "16%", dur: "12s", delay: "2.5s", size: 64 },
    { archetypes: ["Cat"], accessories: ["Long Lashes"], left: "27%", dur: "10s", delay: "5s", size: 52 },
    { archetypes: ["Ghost"], accessories: ["Halo"], left: "38%", dur: "13s", delay: "1s", size: 58 },
    { archetypes: ["Ape"], accessories: ["Crown"], left: "58%", dur: "11s", delay: "3.5s", size: 60 },
    { archetypes: ["Penguin"], accessories: ["Top Hat"], left: "70%", dur: "9.5s", delay: "0.8s", size: 54 },
    { archetypes: ["Bull"], accessories: ["Laser Eyes"], left: "81%", dur: "12.5s", delay: "4.2s", size: 62 },
    { archetypes: ["Bear"], accessories: ["Chain"], left: "91%", dur: "10.5s", delay: "6s", size: 50 },
    { archetypes: ["Hamster"], accessories: ["Headphones"], left: "48%", dur: "14s", delay: "7s", size: 48 },
    { archetypes: ["Blob"], accessories: ["Devil Horns"], left: "11%", dur: "11.5s", delay: "8s", size: 46 },
  ];
  return (
    <div
      className={fullscreen ? "crt overflow-hidden" : "crt rounded-xl border overflow-hidden"}
      style={{
        borderColor: fullscreen ? "transparent" : "#3A3A3A",
        backgroundColor: "#0A0A0A",
        minHeight: fullscreen ? "100vh" : "70vh",
        position: "relative",
      }}
    >
      <CRTStyles />

      {rain.map((m, i) => (
        <div key={i} className="meme-drop" style={{ left: m.left, animationDuration: m.dur, animationDelay: m.delay }}>
          <MascotSVG archetypes={m.archetypes} colors={["Black & White"]} accessories={m.accessories} size={m.size} />
        </div>
      ))}

      <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: fullscreen ? "100vh" : "70vh", position: "relative", zIndex: 10 }}>
        <div style={{ position: "relative" }}>
          <div
            style={{
              width: 230,
              height: 150,
              backgroundColor: "#111",
              border: "3px solid #FFF",
              borderRadius: 10,
              padding: 10,
              boxShadow: "0 0 40px rgba(255,255,255,0.15)",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                backgroundColor: "#000",
                border: "1px solid #555",
                borderRadius: 4,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MatrixScreen />
              <span
                style={{
                  position: "relative",
                  zIndex: 5,
                  color: "#FFF",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  fontSize: 30,
                  textShadow: "0 0 12px rgba(255,255,255,0.9)",
                }}
              >
                $MGEN
              </span>
            </div>
          </div>
          <div style={{ width: 46, height: 12, backgroundColor: "#111", border: "2px solid #FFF", margin: "0 auto" }} />
          <div style={{ width: 100, height: 10, backgroundColor: "#111", border: "2px solid #FFF", borderRadius: 4, margin: "0 auto" }} />
        </div>

        <h1 className="text-2xl md:text-4xl font-bold mt-6 tracking-widest" style={{ color: "#FFF" }}>
          MASCOTGEN
        </h1>
        <p className="text-sm md:text-base mt-3 max-w-2xl" style={{ color: "#AAA" }}>
          Every day, thousands of meme coins launch. Almost none are original. MascotGen builds the ones that are — real characters, real lore, real launches that keep evolving long after the chart goes quiet.
        </p>
        <button
          onClick={onStart}
          className="mt-8 px-8 py-3 text-sm font-bold tracking-widest border-2"
          style={{ borderColor: "#FFF", color: "#000", backgroundColor: "#FFF" }}
        >
          ▶ ENTER THE STUDIO
        </button>
        <p className="text-xs mt-4 font-mono text-center w-full" style={{ color: "#666", whiteSpace: "nowrap" }}>
          [ SIGNAL: LIVE · CH 11 · EST. 2026 ]
        </p>
      </div>
    </div>
  );
}

function WhitepaperPage() {
  const S = ({ n, title, children }) => (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: LIME }}>
        {n} — {title}
      </p>
      <div className="text-sm leading-relaxed" style={{ color: OFFWHITE }}>{children}</div>
    </div>
  );
  return (
    <div className="rounded-xl border p-5 md:p-8 max-w-3xl mx-auto" style={{ backgroundColor: PANEL, borderColor: "#2A2733" }}>
      <h1 className="text-xl font-bold mb-1" style={{ color: LIME }}>MascotGen ($MGEN) — Whitepaper</h1>
      <p className="text-xs mb-6" style={{ color: MUTED }}>Draft v0.1 · Subject to change</p>

      <S n="01" title="Overview">
        MascotGen is an AI story & meme studio paired with a crypto university. The Studio compresses character creation, serialized lore, branding, websites, and community infrastructure into a guided, few-click experience ending with a launch-ready project on pump.fun. The University takes anyone from zero crypto knowledge to confident creator through a grade 1-12 curriculum. Tokens here are not just tickers; they are characters with stories that keep unfolding.
      </S>
      <S n="02" title="The Problem">
        Thousands of near-identical tokens launch daily. Most creators aren't designers or writers, tooling is fragmented, and meme cycles move faster than manual production allows.
      </S>
      <S n="03" title="The Product">
        A hybrid character & story engine (fuse archetypes, blend vibes, gradient colors, tiered accessories, anime/manga & comic art styles with panel-based origin stories), instant branded websites, a legitimate Telegram bot suite, Trending Mode (live web scanning for emerging narratives — premium) and the Story Studio for expanding saved characters, and one-click pump.fun launch handoff. Every creation is provenance-stamped at generation.
      </S>
      <S n="04" title="The $MGEN Token">
        Native access token on Solana. Holding unlocks feature tiers; fees payable at a discount in $MGEN; platform revenue may fund transparent buybacks, marketing, and development. No transfer taxes — revenue comes from the product, not the token.
      </S>
      <S n="05" title="What We Won't Do">
        No fake volume, wash trading, or bundled buy bots. No guaranteed-profit claims. No impersonation of real people. These are manipulation, not marketing.
      </S>
      <S n="06" title="Roadmap">
        Phase 1: Character engine + websites (live). Phase 2: Trending Mode + $MGEN launch. Phase 3: Telegram bot suite. Phase 4: pump.fun integration + creator dashboard. Phase 5: NFT minting via Metaplex — including top-tier exclusive rare traits and on-chain provenance for original creations.
      </S>
      <S n="07" title="Phase 6 — Physical Trading Cards (teaser)">
        Every character here is a structured, trait-based asset — which makes it printable. Collectible card packs featuring original MascotGen characters, each card carrying a redeemable code that mints its matching NFT on Solana. Rarity tiers mirror the platform's own exclusive traits, so the rarest traits become the variants collectors chase. Series 1 features the platform's earliest original characters. Pack structure, odds, and redemption mechanics to be announced.
      </S>
      <S n="08" title="Phase 7 — The Living Ecosystem (teaser)">
        Most meme tokens die quietly and are never heard from again. MascotGen is built so a project's story outlives its chart. <strong style={{ color: OFFWHITE }}>Meme Wars:</strong> recurring character-vs-character events between launched projects, with outcomes written into each character's ongoing lore. <strong style={{ color: OFFWHITE }}>The Graveyard &amp; Resurrection:</strong> inactive projects are preserved rather than erased, with a defined path back — no project is permanently dead. <strong style={{ color: OFFWHITE }}>Ecosystem Flow Map:</strong> a public on-chain view of activity across every MascotGen-launched token. Detailed mechanics announced ahead of release.
      </S>
      <p className="text-xs mt-6" style={{ color: MUTED }}>
        $MGEN is a utility/access token, not an investment product. Nothing here is financial advice. Meme tokens are highly volatile and most lose value. Phases 6-7 are forward-looking teasers, not commitments.
      </p>
    </div>
  );
}

function PricingPage({ tier, onBuy }) {
  const Card = ({ name, price, per, desc, color, cta, plan }) => (
    <div className="rounded-lg border p-4 flex flex-col" style={{ borderColor: color }}>
      <p className="text-sm font-bold" style={{ color }}>{name}</p>
      <p className="text-xl font-bold my-1" style={{ color: OFFWHITE }}>
        {price}
        <span className="text-xs font-normal" style={{ color: MUTED }}> {per}</span>
      </p>
      <p className="text-xs mb-3 flex-1" style={{ color: MUTED }}>{desc}</p>
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
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card name="Free" price="$0" per="" desc="3 generations / month · All art styles · 1 accessory" color="#8B87A0" />
        <Card name="One-Month Pass" price="$11" per="once" desc="11 generations · 3 accessories · Save & export · 30 days, no auto-renew" color="#5EC9FF" cta="Get Pass" plan="pass" />
        <Card name="Starter" price="$11" per="/mo" desc="11 generations / month · 3 accessories · Save & export · renews monthly" color={LIME} cta="Get Starter" plan="starter" />
        <Card name="Platinum" price="$33" per="/mo" desc="Unlimited generations · 🔥 Trending Mode · ⭐ Story Studio · 5 accessories · ⭐ exclusive traits · discounted NFT mints (Phase 5)" color={AMBER} cta="Get Platinum" plan="platinum" />
        <Card name="All-Access Pass" price="$44" per="once" desc="Everything in Platinum · 30 days · no auto-renew" color={MAGENTA} cta="Get All-Access" plan="platinum_pass" />
      </div>
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
    "Hit Generate: you get a character, lore, origin story, art prompt, and a full launch package.",
    "Save concepts you love to your Collection, and Export a backup file so they're never lost.",
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
    "MascotGen's roadmap grows with you: Trending Mode, Telegram bots, one-click launch, and NFT minting of your characters.",
    "Final lesson: in crypto, the ones who survive are the ones who stay curious AND stay skeptical. Be both. Class dismissed. 🎓",
  ]},
];

function LearnPage() {
  const [openGrade, setOpenGrade] = useState(1);
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-1" style={{ color: LIME }}>Crypto University</h1>
      <p className="text-sm mb-6" style={{ color: MUTED }}>
        The University wing of MascotGen: zero-to-launch in 12 grades, no prior knowledge needed. Quizzes and on-chain diplomas coming in a future update. Not financial advice — most meme tokens lose value; never risk money you can't afford to lose.
      </p>
      <div className="flex flex-col gap-2">
        {CURRICULUM.map((c) => (
          <div key={c.g} className="rounded-lg border overflow-hidden" style={{ borderColor: openGrade === c.g ? LIME : "#33303F" }}>
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
    </div>
  );
}

export default function App() {
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState("home");

  const [gender, setGender] = useState("Male");
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

  const isAlpha = tier === "Alpha";
  const isPaid = tier === "Creator" || tier === "Alpha";
  const maxAccessories = isAlpha ? 5 : tier === "Creator" ? 3 : 1;

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

  const checkSubscription = async (em) => {
    if (!em) return;
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const data = await res.json();
      if (data.tier) setTier(data.tier);
      if (typeof data.artCredits === "number") setArtCredits(data.artCredits);
    } catch (e) {}
  };

  const cappedAccessories = accessories.slice(0, maxAccessories);

  const randomize = () => {
    const pick = (arr, n) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, n);
    };
    const archPool = isAlpha ? [...ARCHETYPES, ...ALPHA_ARCHETYPES] : ARCHETYPES;
    const vibePool = isAlpha ? [...VIBES, ...ALPHA_VIBES] : VIBES;
    const worldPool = isAlpha ? [...WORLDS, ...ALPHA_WORLDS] : WORLDS;
    const colorPool = isAlpha ? [...COLORS, ...ALPHA_COLORS] : COLORS;
    const accPool = isAlpha ? [...ACCESSORIES, ...ALPHA_ACCESSORIES] : ACCESSORIES;
    setArchetypes(pick(archPool, 1 + Math.floor(Math.random() * 2)));
    setVibes(pick(vibePool, 1 + Math.floor(Math.random() * 3)));
    setWorlds(pick(worldPool, 1 + Math.floor(Math.random() * 2)));
    setColors(pick(colorPool, 1 + Math.floor(Math.random() * 2)));
    setAccessories(pick(accPool, Math.floor(Math.random() * maxAccessories)));
    if (isAlpha && Math.random() > 0.6) setAura(AURAS[1 + Math.floor(Math.random() * (AURAS.length - 1))]);
    else setAura("None");
  };

  const buildPrompt = () => {
    const allAccessories = aura !== "None" ? [...cappedAccessories, aura] : cappedAccessories;
    const nameVariety = `\n\nIMPORTANT: Use seed ${Math.floor(Math.random() * 100000)} to ensure a fresh, unique name and story different from any previous generation. Avoid generic or repeated names.`;
    return `You are a world-class meme coin character designer and storyteller. Create an original meme token character based on these traits. Treat the traits as creative inspiration, not a rigid checklist — weave them into something coherent and memorable.

Gender: ${gender}
Archetype(s): ${archetypes.join(", ") || "surprise me"}
Vibe(s): ${vibes.join(", ") || "surprise me"}
World(s)/Setting(s): ${worlds.join(", ") || "surprise me"}
Color palette: ${colors.join(", ") || "surprise me"}
Accessories: ${allAccessories.join(", ") || "none"}
Art style: ${artStyle}

Return ONLY valid JSON (no markdown, no backticks) with this exact shape:
{
 "characterName": "string, the character's actual name",
 "tokenName": "string, the token/project name",
 "ticker": "string, 3-6 uppercase letters, no dollar sign",
 "tagline": "string, one punchy sentence",
 "bio": "string, 2-3 sentences of character backstory",
 "originStory": ["string panel 1", "string panel 2", "string panel 3", "string panel 4"],
 "visualDescription": "string, a detailed AI art prompt to generate this character's image in ${artStyle} style",
 "socialBio": "string, a short X/Twitter bio for the character",
 "firstTweet": "string, the character's first launch tweet",
 "telegramWelcome": "string, 2-3 sentence welcome message for new Telegram members, warm and on-theme"
}${nameVariety}`;
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setView("card");
    setImgFailed(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt(), email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      if (data.tier) setTier(data.tier);
      if (typeof data.genCount === "number") setGenCount(data.genCount);
      const parsed = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
      setResult(parsed);
    } catch (e) {
      setError(e.message || "Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateArt = async (entry) => {
    setArtLoadingFor(entry.id);
    setArtError(null);
    setImgFailed(false);
    try {
      const res = await fetch("/api/generate-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: entry.result.visualDescription, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Art generation failed");
      const next = collection.map((c) => (c.id === entry.id ? { ...c, artUrl: data.imageUrl } : c));
      persistCollection(next);
      if (studioEntry && studioEntry.id === entry.id) setStudioEntry({ ...studioEntry, artUrl: data.imageUrl });
      if (typeof data.creditsRemaining === "number") setArtCredits(data.creditsRemaining);
    } catch (e) {
      setArtError("Art generation failed — try again.");
    } finally {
      setArtLoadingFor(null);
    }
  };

  const mintNFT = async (entry) => {
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
    setMintStatus("Opening pack — rolling your card...");

    const ownerWallet = publicKey.toBase58();
    const packType = tier === "Alpha" ? "elite" : tier === "Creator" ? "platinum" : "starter";

    try {
      const openRes = await fetch("/api/open-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerWallet, packType }),
      });
      const openJson = await openRes.json();
      if (!openRes.ok || !openJson.card) {
        throw new Error(openJson.error || "Couldn't open a pack — try again.");
      }
      const pendingMint = openJson.card;

      const res = await mintCharacterNFT({
        entry,
        pendingMint,
        wallet,
        rpcEndpoint: connection.rpcEndpoint,
        onProgress: (msg) => setMintStatus(msg),
      });

      // Persist the mint (address + tier) to the saved collection so it shows as minted.
      const next = collection.map((c) =>
        c.id === entry.id ? { ...c, mintAddress: res.mintAddress, mintTier: res.tier } : c
      );
      persistCollection(next);
      if (studioEntry && studioEntry.id === entry.id) {
        setStudioEntry({ ...studioEntry, mintAddress: res.mintAddress, mintTier: res.tier });
      }

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
            imageUrl: entry.artUrl,
          }),
        });
      } catch (e) {
        console.warn("record-mint failed (non-fatal):", e);
      }

      setMintResult(res);
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
    archetypes,
    vibes,
    worlds,
    colors,
    accessories: aura !== "None" ? [...cappedAccessories, aura] : cappedAccessories,
    aura,
    artStyle,
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

  const openStudio = (entry) => {
    setMintResult(null);
    setMintError(null);
    setMintStatus(null);
    setStudioEntry(entry);
  };

  const expandCharacter = async (mode) => {
    if (!studioEntry) return;
    setStudioLoading(true);
    setStudioError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `You are expanding the world of an existing meme character. Keep their established identity and traits locked — only ADD new canon.\n\nCharacter: ${JSON.stringify(studioEntry.result)}\n\nRequest: ${mode === "panels" ? "Write 4 new story panels continuing this character's adventures." : studioInput || "Expand this character's world with new lore."}\n\nReturn ONLY valid JSON: { "title": "string", "panels": ["string", "string", "string", "string"] }`,
          email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Expansion failed");
      const parsed = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
      const expansions = studioEntry.expansions || [];
      const updated = { ...studioEntry, expansions: [...expansions, parsed] };
      setStudioEntry(updated);
      const next = collection.map((c) => (c.id === studioEntry.id ? updated : c));
      persistCollection(next);
      setStudioInput("");
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

  const handleBuy = async (plan) => {
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError("Checkout failed — try again.");
    }
  };

  const liveStats = result ? computeStats(currentTraits()) : null;

  const rarityColorMap = { Legendary: "#FFD700", Epic: "#C77DFF", Rare: "#5EC9FF", Common: "#9A94AD" };

  if (!entered) {
    return (
      <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh" }}>
        <HomePage onStart={() => { setEntered(true); setTab("studio"); }} fullscreen />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: INK, minHeight: "100vh", color: OFFWHITE }}>
      <header className="border-b sticky top-0 z-40" style={{ borderColor: "#2A2733", backgroundColor: "rgba(20,18,26,0.95)", backdropFilter: "blur(8px)" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setTab("home")} className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: LIME }} />
            <span className="font-bold tracking-wider text-sm" style={{ color: OFFWHITE }}>MASCOTGEN</span>
          </button>
          <nav className="hidden md:flex gap-1">
            {[["studio", "Studio"], ["learn", "University"], ["whitepaper", "Whitepaper"], ["pricing", "Pricing"]].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg"
                style={{ color: tab === id ? INK : MUTED, backgroundColor: tab === id ? LIME : "transparent" }}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: isAlpha ? AMBER : isPaid ? LIME : "#33303F", color: isPaid ? INK : MUTED }}>
              {tier}
            </span>
            <button onClick={() => setShowCollection(true)} className="p-2 rounded-lg" style={{ color: MUTED }}>
              <FolderOpen size={16} />
            </button>
            <WalletMultiButton style={{ backgroundColor: PANEL, height: 32, fontSize: 12, borderRadius: 8 }} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "home" && <HomePage onStart={() => setTab("studio")} />}
        {tab === "learn" && <LearnPage />}
        {tab === "whitepaper" && <WhitepaperPage />}
        {tab === "pricing" && <PricingPage tier={tier} onBuy={handleBuy} />}

        {tab === "studio" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-xl border p-5" style={{ backgroundColor: PANEL, borderColor: "#2A2733" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-sm tracking-wider" style={{ color: LIME }}>BUILD YOUR MASCOT</h2>
                <button onClick={randomize} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border" style={{ borderColor: MAGENTA, color: MAGENTA }}>
                  <Dice5 size={14} /> RANDOM
                </button>
              </div>

              <Section title="Gender" accent={LIME}>
                {["Male", "Female"].map((g) => (
                  <Chip key={g} label={g} active={gender === g} accent={LIME} onClick={() => setGender(g)} />
                ))}
              </Section>

              <Section title="Archetype" sub="Pick up to 2 — mix for hybrids" accent={LIME}>
                {ARCHETYPES_COMMON.map((a) => (
                  <Chip key={a} label={a} active={archetypes.includes(a)} accent={LIME} onClick={() => setArchetypes(toggleIn(archetypes, a, 2))} />
                ))}
                {ARCHETYPES_RARE.map((a) => (
                  <Chip key={a} label={`✦ ${a}`} active={archetypes.includes(a)} accent="#5EC9FF" onClick={() => setArchetypes(toggleIn(archetypes, a, 2))} />
                ))}
                {ALPHA_ARCHETYPES.map((a) => (
                  <Chip key={a} label={`⭐ ${a}`} active={archetypes.includes(a)} accent={AMBER} dim={!isAlpha} onClick={() => isAlpha ? setArchetypes(toggleIn(archetypes, a, 2)) : setTab("pricing")} />
                ))}
              </Section>

              <Section title="Vibe" sub="Pick up to 5" accent={LIME}>
                {VIBES_COMMON.map((v) => (
                  <Chip key={v} label={v} active={vibes.includes(v)} accent={LIME} onClick={() => setVibes(toggleIn(vibes, v, 5))} />
                ))}
                {VIBES_RARE.map((v) => (
                  <Chip key={v} label={`✦ ${v}`} active={vibes.includes(v)} accent="#5EC9FF" onClick={() => setVibes(toggleIn(vibes, v, 5))} />
                ))}
                {ALPHA_VIBES.map((v) => (
                  <Chip key={v} label={`⭐ ${v}`} active={vibes.includes(v)} accent={AMBER} dim={!isAlpha} onClick={() => isAlpha ? setVibes(toggleIn(vibes, v, 5)) : setTab("pricing")} />
                ))}
              </Section>

              <Section title="World" sub="Pick up to 11 for travel arcs" accent={LIME}>
                {WORLDS_COMMON.map((w) => (
                  <Chip key={w} label={w} active={worlds.includes(w)} accent={LIME} onClick={() => setWorlds(toggleIn(worlds, w, 11))} />
                ))}
                {WORLDS_RARE.map((w) => (
                  <Chip key={w} label={`✦ ${w}`} active={worlds.includes(w)} accent="#5EC9FF" onClick={() => setWorlds(toggleIn(worlds, w, 11))} />
                ))}
                {ALPHA_WORLDS.map((w) => (
                  <Chip key={w} label={`⭐ ${w}`} active={worlds.includes(w)} accent={AMBER} dim={!isAlpha} onClick={() => isAlpha ? setWorlds(toggleIn(worlds, w, 11)) : setTab("pricing")} />
                ))}
              </Section>

              <Section title="Color" sub="Pick up to 2 for gradients" accent={LIME}>
                {COLORS_COMMON.map((c) => (
                  <Chip key={c} label={c} active={colors.includes(c)} accent={LIME} onClick={() => setColors(toggleIn(colors, c, 2))} />
                ))}
                {COLORS_RARE.map((c) => (
                  <Chip key={c} label={`✦ ${c}`} active={colors.includes(c)} accent="#5EC9FF" onClick={() => setColors(toggleIn(colors, c, 2))} />
                ))}
                {ALPHA_COLORS.map((c) => (
                  <Chip key={c} label={`⭐ ${c}`} active={colors.includes(c)} accent={AMBER} dim={!isAlpha} onClick={() => isAlpha ? setColors(toggleIn(colors, c, 2)) : setTab("pricing")} />
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
                  <Chip key={a} label={`⭐ ${a}`} active={cappedAccessories.includes(a)} accent={AMBER} dim={!isAlpha} onClick={() => isAlpha ? setAccessories(toggleIn(accessories, a, maxAccessories)) : setTab("pricing")} />
                ))}
              </Section>

              {isAlpha && (
                <Section title="Aura" sub="Alpha exclusive" accent={AMBER}>
                  {AURAS.map((a) => (
                    <Chip key={a} label={a === "None" ? a : `⭐ ${a}`} active={aura === a} accent={AMBER} onClick={() => setAura(a)} />
                  ))}
                </Section>
              )}

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
                disabled={loading}
                className="w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                style={{ backgroundColor: LIME, color: INK, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> GENERATING...</> : <><Sparkles size={16} /> GENERATE MASCOT</>}
              </button>
              {error && <p className="text-xs mt-2 text-center" style={{ color: MAGENTA }}>{error}</p>}
            </div>

            <div>
              {!result && !loading && (
                <div className="rounded-xl border border-dashed p-10 text-center h-full flex flex-col items-center justify-center" style={{ borderColor: "#33303F" }}>
                  <MascotSVG archetypes={archetypes.length ? archetypes : ["Frog"]} colors={colors.length ? colors : ["Neon Green"]} accessories={cappedAccessories} size={160} />
                  <p className="text-sm mt-4" style={{ color: MUTED }}>Your mascot preview updates as you build. Hit Generate for lore + a launch package.</p>
                </div>
              )}

              {loading && (
                <div className="rounded-xl border p-10 text-center h-full flex flex-col items-center justify-center" style={{ borderColor: "#2A2733", backgroundColor: PANEL }}>
                  <Loader2 size={40} className="animate-spin" style={{ color: LIME }} />
                  <p className="text-sm mt-4" style={{ color: MUTED }}>Summoning your character...</p>
                </div>
              )}

              {result && !loading && view === "card" && (
                <div className="rounded-xl border p-5" style={{ backgroundColor: PANEL, borderColor: "#2A2733" }}>
                  <div className="relative flex justify-center mb-4 rounded-lg py-6" style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>
                    <MascotSVG archetypes={archetypes.length ? archetypes : ["Frog"]} colors={colors.length ? colors : ["Neon Green"]} accessories={cappedAccessories} size={160} />
                    <div className="absolute top-0 right-0 text-xs font-bold px-3 py-1 rounded-bl-lg" style={{ backgroundColor: "#33303F", color: MUTED }}>
                      TIER: ???
                    </div>
                  </div>

                  {liveStats && <div className="mb-4"><StatPanel stats={liveStats} /></div>}

                  <h2 className="text-xl font-bold" style={{ color: OFFWHITE }}>{result.characterName}</h2>
                  <p className="text-sm" style={{ color: LIME }}>${result.ticker} · {result.tokenName}</p>
                  <p className="text-sm mt-2 italic" style={{ color: MUTED }}>"{result.tagline}"</p>
                  <p className="text-sm mt-3 leading-relaxed" style={{ color: OFFWHITE }}>{result.bio}</p>

                  {result.originStory && (
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: MUTED }}>Origin Story</p>
                      <div className="grid grid-cols-2 gap-2">
                        {result.originStory.map((panel, i) => (
                          <div key={i} className="text-xs p-2 rounded-lg" style={{ backgroundColor: "rgba(0,0,0,0.25)", color: OFFWHITE }}>
                            <span style={{ color: LIME }}>{i + 1}.</span> {panel}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setView("launch")} className="flex-1 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: AMBER, color: INK }}>
                      🚀 LAUNCH PACKAGE
                    </button>
                    <button onClick={() => setView("site")} className="flex-1 py-2 rounded-lg text-xs font-bold border" style={{ borderColor: LIME, color: LIME }}>
                      <Globe size={12} className="inline" /> SITE PREVIEW
                    </button>
                  </div>

                  <button onClick={saveCurrent} className="w-full mt-3 py-2 rounded-lg text-xs font-bold border" style={{ borderColor: AMBER, color: AMBER }}>
                    💎 SAVE, THEN MINT IN STUDIO
                  </button>
                  <button onClick={saveCurrent} className="w-full mt-2 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2" style={{ backgroundColor: LIME, color: INK }}>
                    <Save size={14} /> SAVE TO COLLECTION
                  </button>
                  {saveMsg && <p className="text-xs text-center mt-2" style={{ color: LIME }}>{saveMsg}</p>}
                  <button onClick={generate} className="w-full mt-2 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border" style={{ borderColor: MAGENTA, color: MAGENTA }}>
                    <RefreshCw size={14} /> REGENERATE MASCOT (NEW NAME & STORY)
                  </button>
                </div>
              )}

              {result && !loading && view === "launch" && (
                <div className="rounded-xl border p-5" style={{ backgroundColor: PANEL, borderColor: "#2A2733" }}>
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
                      <button key={label} onClick={() => copyText(label, value)} className="text-left text-xs p-2 rounded-lg flex justify-between gap-2" style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>
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
                </div>
              )}

              {result && !loading && view === "site" && (
                <WebsitePreview result={result} traits={{ archetypes, colors, accessories: aura !== "None" ? [...cappedAccessories, aura] : cappedAccessories }} />
              )}
            </div>
          </div>
        )}
      </main>

      {showCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={() => setShowCollection(false)}>
          <div className="rounded-xl border w-full max-w-2xl max-h-[80vh] overflow-y-auto" style={{ backgroundColor: PANEL, borderColor: "#2A2733" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b sticky top-0" style={{ borderColor: "#2A2733", backgroundColor: PANEL }}>
              <h2 className="font-bold text-sm" style={{ color: LIME }}>MY COLLECTION ({collection.length})</h2>
              <button onClick={() => setShowCollection(false)} style={{ color: MUTED }}><X size={18} /></button>
            </div>
            <div className="p-4">
              {collection.length === 0 && <p className="text-sm text-center py-8" style={{ color: MUTED }}>No saved characters yet. Generate one and hit Save.</p>}
              {collection.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 p-3 mb-2 rounded-lg" style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>
                  <MascotSVG archetypes={entry.traits.archetypes || ["Frog"]} colors={entry.traits.colors || ["Neon Green"]} accessories={(entry.traits.accessories || []).filter((a) => a !== entry.traits.aura)} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate" style={{ color: OFFWHITE }}>
                      {entry.result.characterName} · ${entry.result.ticker}
                      {entry.mintAddress && <span className="ml-2" style={{ color: rarityColorMap[entry.mintTier] || LIME }}>◆ {entry.mintTier}</span>}
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
      )}

      {studioEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }} onClick={() => setStudioEntry(null)}>
          <div className="rounded-xl border w-full max-w-lg max-h-[88vh] overflow-y-auto" style={{ backgroundColor: PANEL, borderColor: AMBER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b sticky top-0 z-10" style={{ borderColor: "#2A2733", backgroundColor: PANEL }}>
              <h2 className="font-bold text-sm" style={{ color: AMBER }}>★ Story Studio — {studioEntry.result.characterName}</h2>
              <button onClick={() => setStudioEntry(null)} style={{ color: MUTED }}><X size={18} /></button>
            </div>

            <div className="p-4">
              <p className="text-xs mb-4" style={{ color: MUTED }}>
                Expand this character's world. Traits and identity stay locked — the Studio only adds new canon.
              </p>

              {(() => {
                const studioStats = computeStats(studioEntry.traits, studioEntry.mintTier || null);
                return <div className="mb-4"><StatPanel stats={studioStats} /></div>;
              })()}

              <div className="mb-4 rounded-lg border p-3" style={{ borderColor: "#2A2733" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-widest" style={{ color: LIME }}>🎨 Character Art</p>
                  <span className="text-xs" style={{ color: MUTED }}>{isPaid ? `${artCredits} credits left` : "Paid tiers"}</span>
                </div>
                {studioEntry.artUrl ? (
                  <img
                    key={imgRetryKey}
                    src={studioEntry.artUrl}
                    alt={studioEntry.result.characterName}
                    className="w-full rounded-lg"
                    onError={() => { if (!imgFailed) { setImgFailed(true); setImgRetryKey((k) => k + 1); } }}
                  />
                ) : (
                  <div className="flex flex-col items-center py-6">
                    <MascotSVG archetypes={studioEntry.traits.archetypes || ["Frog"]} colors={studioEntry.traits.colors || ["Neon Green"]} accessories={(studioEntry.traits.accessories || []).filter((a) => a !== studioEntry.traits.aura)} size={120} />
                    <p className="text-xs mt-2 text-center" style={{ color: MUTED }}>No art yet — generate a real illustration below.</p>
                  </div>
                )}
                <button
                  onClick={() => generateArt(studioEntry)}
                  disabled={artLoadingFor === studioEntry.id || (!isPaid && artCredits <= 0)}
                  className="w-full mt-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
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
                        {studioEntry.mintTier === "Legendary" && "⭐ "}{(studioEntry.mintTier || "").toUpperCase()}{studioEntry.mintTier === "Legendary" && " ⭐"}
                      </p>
                      <a href={`https://explorer.solana.com/address/${studioEntry.mintAddress}`} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-bold" style={{ color: LIME, textDecoration: "underline" }}>
                        View on Solana Explorer ↗
                      </a>
                    </div>
                  ) : !mintResult ? (
                    <>
                      <p className="text-xs mb-3" style={{ color: MUTED }}>
                        Permanently mint this character on Solana. Your rarity tier is rolled at mint — never chosen. A small SOL network fee applies, paid by your wallet.
                      </p>
                      {!connected && <p className="text-xs mb-2" style={{ color: MAGENTA }}>Connect your wallet (top-right) to mint.</p>}
                      <button
                        onClick={() => mintNFT(studioEntry)}
                        disabled={minting || !connected}
                        className="w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                        style={{ backgroundColor: AMBER, color: INK, opacity: minting || !connected ? 0.6 : 1, cursor: minting || !connected ? "not-allowed" : "pointer" }}
                      >
                        {minting ? <><Loader2 size={14} className="animate-spin" /> {mintStatus || "MINTING..."}</> : "💎 MINT AS NFT"}
                      </button>
                      {mintError && <p className="text-xs mt-2" style={{ color: MAGENTA }}>{mintError}</p>}
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>You pulled</p>
                      <p className="text-2xl font-bold mb-2" style={{ color: rarityColorMap[mintResult.tier] || OFFWHITE }}>
                        {mintResult.tier === "Legendary" && "⭐ "}{(mintResult.tier || "").toUpperCase()}{mintResult.tier === "Legendary" && " ⭐"}
                      </p>
                      {mintResult.tier === "Legendary" && <p className="text-xs mb-2" style={{ color: AMBER }}>One of only 500 that will ever exist.</p>}
                      <a href={mintResult.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-xs font-bold" style={{ color: LIME, textDecoration: "underline" }}>
                        View on Solana Explorer ↗
                      </a>
                    </div>
                  )}
                </div>
              )}

              {isAlpha ? (
                <>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <button onClick={() => expandCharacter("panels")} disabled={studioLoading} className="px-3 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: LIME, color: LIME }}>
                      +4 Story Panels
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={studioInput}
                      onChange={(e) => setStudioInput(e.target.value)}
                      placeholder='Or ask anything: "panels where they meet a rival"'
                      className="flex-1 px-3 py-2 rounded-lg text-xs border bg-transparent"
                      style={{ borderColor: "#33303F", color: OFFWHITE }}
                    />
                    <button onClick={() => expandCharacter("custom")} disabled={studioLoading} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: AMBER, color: INK }}>
                      {studioLoading ? <Loader2 size={14} className="animate-spin" /> : "EXPAND"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border p-3 text-center" style={{ borderColor: "#33303F" }}>
                  <p className="text-xs" style={{ color: MUTED }}>Story expansion is an Alpha-tier feature.</p>
                  <button onClick={() => { setStudioEntry(null); setTab("pricing"); }} className="mt-2 text-xs font-bold" style={{ color: AMBER }}>Upgrade to Alpha →</button>
                </div>
              )}

              {studioError && <p className="text-xs mt-2" style={{ color: MAGENTA }}>{studioError}</p>}

              {studioEntry.expansions && studioEntry.expansions.length > 0 && (
                <div className="mt-4">
                  {studioEntry.expansions.map((exp, i) => (
                    <div key={i} className="mb-3">
                      <p className="text-xs font-bold mb-1" style={{ color: LIME }}>{exp.title}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(exp.panels || []).map((p, j) => (
                          <div key={j} className="text-xs p-2 rounded-lg" style={{ backgroundColor: "rgba(0,0,0,0.25)", color: OFFWHITE }}>{p}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
