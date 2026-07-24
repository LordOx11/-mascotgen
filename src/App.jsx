import React, { useState, useEffect } from "react";
import { Dice5, Sparkles, Loader2, RefreshCw, Globe, CreditCard, Save, FolderOpen, Trash2, X } from "lucide-react";

const INK = "#14121A";
const PANEL = "#1D1A26";
const LIME = "#C6FF3D";
const MAGENTA = "#FF3EA5";
const AMBER = "#FFB627";
const OFFWHITE = "#F2F0F5";
const MUTED = "#8B87A0";

const ARCHETYPES = ["Animal", "Dog", "Cat", "Frog", "Ape", "Bull", "Bear", "Hamster", "Penguin", "Zombie", "Creature", "Object", "Human-like", "Robot", "Food", "Insect", "Plant", "Ghost", "Alien", "Blob"];
const VIBES = ["Degen", "Wholesome", "Chaotic", "Mysterious", "Heroic", "Comedic", "Villainous", "Zen", "Feral", "Corporate", "Royal", "Unhinged", "Lovestruck", "Sad Boi / Melancholy"];
const WORLDS = ["Space", "Fantasy", "Street Culture", "Corporate Satire", "Ocean", "Jungle", "Cyberpunk", "Wild West", "Underworld", "Retro Arcade", "Post-Apocalyptic", "Casino", "The Moon", "Circus / Carnival", "Heaven & Clouds", "Gym / Fitness", "Beach Paradise", "Haunted Mansion"];
const COLORS = ["Neon Green", "Hot Pink", "Gold", "Deep Purple", "Cyan", "Blood Red", "Electric Blue", "Toxic Orange", "Black & White", "Rainbow", "Lavender", "Mint", "Chrome Silver", "Bubblegum", "Midnight Blue", "Acid Yellow"];
const ACCESSORIES = ["Wif Hat (Knit Beanie)", "Laser Eyes", "Diamond Hands", "Green Candle", "Long Lashes", "Glam Nails", "Long Flowing Hair", "Designer Purse", "Earrings", "Basic Sneakers", "Sword", "Sunglasses", "Crown", "Chain", "Cape", "Headphones", "Rocket Backpack", "Top Hat", "Boxing Gloves", "Halo", "Devil Horns", "Cigar", "Katana"];
const ALPHA_ACCESSORIES = ["Golden Wif Hat", "Cyber Visor", "Dragon Aura", "Hype Kicks", "Guitar", "Lollipop"];
const ART_STYLES = ["Anime / Manga", "Western Comic", "Pixel Art", "3D Render", "Sticker / Chibi", "Hand-Drawn Sketch"];

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

// toggle a value in an array with a max cap
function toggleIn(list, value, max) {
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (list.length >= max) return [...list.slice(1), value]; // drop oldest, add new
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
        return null; // handled in eyes()
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
      case "Top Hat":
        return (
          <g key={i}>
            <rect x="75" y="30" width="50" height="35" fill={INK} />
            <rect x="65" y="60" width="70" height="8" fill={INK} />
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
      {/* hybrid: second archetype ghosted behind */}
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

// ---------- HOME PAGE (CRT / old-TV aesthetic) ----------
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

      {/* meme rain */}
      {rain.map((m, i) => (
        <div key={i} className="meme-drop" style={{ left: m.left, animationDuration: m.dur, animationDelay: m.delay }}>
          <MascotSVG archetypes={m.archetypes} colors={["Black & White"]} accessories={m.accessories} size={m.size} />
        </div>
      ))}

      {/* centered supercomputer */}
      <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: fullscreen ? "100vh" : "70vh", position: "relative", zIndex: 10 }}>
        <div style={{ position: "relative" }}>
          {/* monitor frame */}
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
            {/* screen with matrix rain */}
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
          {/* stand */}
          <div style={{ width: 46, height: 12, backgroundColor: "#111", border: "2px solid #FFF", margin: "0 auto" }} />
          <div style={{ width: 100, height: 10, backgroundColor: "#111", border: "2px solid #FFF", borderRadius: 4, margin: "0 auto" }} />
        </div>

        <h1 className="text-2xl md:text-4xl font-bold mt-6 tracking-widest" style={{ color: "#FFF" }}>
          MASCOTGEN
        </h1>
        <p className="text-sm md:text-base mt-3 max-w-md" style={{ color: "#AAA" }}>
          Part studio, part university. Create original characters with living lore, launch them as tokens, and learn crypto from grade 1 to graduation — all in one place.
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

// ---------- WHITEPAPER PAGE ----------
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
        A hybrid character & story engine (fuse archetypes, blend vibes, gradient colors, tiered accessories, anime/manga & comic art styles with panel-based origin stories), instant branded websites, a legitimate Telegram bot suite, Trending Mode (live web scanning for emerging narratives — premium), and one-click pump.fun launch handoff. Every creation is provenance-stamped at generation.
      </S>
      <S n="04" title="The $MGEN Token">
        Native access token on Solana. Holding unlocks feature tiers; fees payable at a discount in $MGEN; platform revenue may fund transparent buybacks, marketing, and development. No transfer taxes — revenue comes from the product, not the token.
      </S>
      <S n="05" title="What We Won't Do">
        No fake volume, wash trading, or bundled buy bots. No guaranteed-profit claims. No impersonation of real people. These are manipulation, not marketing.
      </S>
      <S n="06" title="Roadmap">
        Phase 1: Character engine + websites (live). Phase 2: Trending Mode + $MGEN launch. Phase 3: Telegram bot suite. Phase 4: pump.fun integration + creator dashboard. Phase 5: NFT minting via Metaplex — including Alpha-exclusive rare traits and on-chain provenance for original creations.
      </S>
      <p className="text-xs mt-6" style={{ color: MUTED }}>
        $MGEN is a utility/access token, not an investment product. Nothing here is financial advice. Meme tokens are highly volatile and most lose value.
      </p>
    </div>
  );
}

// ---------- PRICING PAGE ----------
function PricingPage({ tier, onBuy }) {
  const notice = null;
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
        <Card name="Free" price="$0" per="" desc="3 generations / month · Hand-drawn sketch style · 1 accessory" color="#8B87A0" />
        <Card name="One-Month Pass" price="$11" per="once" desc="11 generations · All art styles · 3 accessories · 30 days, no auto-renew" color="#5EC9FF" cta="Get Pass" plan="pass" />
        <Card name="Starter" price="$11" per="/mo" desc="11 generations / month · All art styles · 3 accessories · renews monthly" color={LIME} cta="Get Starter" plan="starter" />
        <Card name="Platinum" price="$33" per="/mo" desc="Unlimited · Trending Mode · 5 accessories · ⭐ exclusive traits · discounted NFT mints (Phase 5)" color={AMBER} cta="Get Platinum" plan="platinum" />
        <Card name="All-Access Pass" price="$44" per="once" desc="Everything in Platinum · 30 days · no auto-renew" color={MAGENTA} cta="Get All-Access" plan="platinum_pass" />
      </div>
    </div>
  );
}


// ---------- LEARN PAGE (Crypto School, Grades 1-12) ----------
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

export default function MascotGenerator() {
  const [archetypes, setArchetypes] = useState(["Dog"]);
  const [vibes, setVibes] = useState(["Degen"]);
  const [world, setWorld] = useState("Space");
  const [colors, setColors] = useState(["Neon Green"]);
  const [accessories, setAccessories] = useState(["Wif Hat (Knit Beanie)"]);
  const [artStyle, setArtStyle] = useState("Hand-Drawn Sketch");
  const [loading, setLoading] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingInfo, setTrendingInfo] = useState(null);
  const [tier, setTier] = useState("Free");
  const [showPricing, setShowPricing] = useState(false);
  const [subEmail, setSubEmail] = useState("");
  const [subChecking, setSubChecking] = useState(false);
  const [subMsg, setSubMsg] = useState(null);
  const [genCount, setGenCount] = useState(0);

  // restore subscription on load
  useEffect(() => {
    const savedEmail = window.localStorage.getItem("mascotgen-email");
    const savedCount = parseInt(window.localStorage.getItem("mascotgen-gencount-" + new Date().toISOString().slice(0, 7)) || "0", 10);
    setGenCount(savedCount);
    if (savedEmail) {
      setSubEmail(savedEmail);
      checkSubscription(savedEmail, true);
    }
  }, []);

  const checkSubscription = async (email, silent) => {
    if (!email) return;
    setSubChecking(true);
    if (!silent) setSubMsg(null);
    try {
      const r = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await r.json();
      if (json.active) {
        window.localStorage.setItem("mascotgen-email", email);
        setTier(json.plan === "platinum" || json.plan === "platinum_pass" ? "Alpha" : "Creator");
        if (!silent) {
          setSubMsg(`Unlocked: ${json.plan === "platinum" ? "Platinum (Alpha tier)" : json.plan === "platinum_pass" ? "All-Access Pass (Alpha tier)" : json.plan === "pass" ? "One-Month Pass (Creator tier)" : "Starter (Creator tier)"} ✓`);
          setTimeout(() => setShowPricing(false), 1200);
        }
      } else if (!silent) {
        setSubMsg("No active subscription found for that email.");
      }
    } catch (e) {
      if (!silent) setSubMsg("Couldn't check subscription — try again.");
    } finally {
      setSubChecking(false);
    }
  };

  const startCheckout = async (plan) => {
    setSubMsg(null);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, email: subEmail || undefined }),
      });
      const json = await r.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        setSubMsg(json.error || "Checkout failed — try again.");
      }
    } catch (e) {
      setSubMsg("Checkout failed — try again.");
    }
  };

  const bumpGenCount = () => {
    const key = "mascotgen-gencount-" + new Date().toISOString().slice(0, 7);
    const next = genCount + 1;
    setGenCount(next);
    window.localStorage.setItem(key, String(next));
  };

  const STARTER_MONTHLY_LIMIT = 11;
  const FREE_MONTHLY_LIMIT = 3;
  const monthlyLimit = tier === "Alpha" ? Infinity : tier === "Creator" ? STARTER_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT;
  const overLimit = genCount >= monthlyLimit;
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [view, setView] = useState("card");
  const [page, setPage] = useState("home");
  const [entered, setEntered] = useState(false);

  // ---- Story Studio (Alpha): expand a saved character without altering it ----
  const [studioEntry, setStudioEntry] = useState(null);
  const [studioInput, setStudioInput] = useState("");
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioError, setStudioError] = useState(null);

  const expandCharacter = async (mode) => {
    if (!studioEntry) return;
    const req =
      mode === "panels"
        ? "Write the NEXT 4 story panels continuing this character's saga from where the existing story left off."
        : mode === "scene"
        ? "Write one vivid new scene art prompt (one paragraph) showing this character in a brand new moment."
        : studioInput.trim();
    if (!req) return;
    setStudioLoading(true);
    setStudioError(null);
    try {
      const r = studioEntry.result;
      const prompt = `You are expanding an EXISTING, LOCKED character. You must NOT change or contradict any of these established facts — name, ticker, traits, appearance, or existing lore. Only ADD new material consistent with them.

CHARACTER (locked):
Name: ${r.characterName} | Token: ${r.tokenName} ($${r.ticker})
Lore: ${r.bio}
Appearance: ${r.visualDescription}
Existing story: ${(r.storyBeats || []).join(" / ")}
${(studioEntry.additions || []).map((a) => `Prior addition: ${a.text}`).join("\n")}

REQUEST: ${req}

Respond ONLY with raw JSON (no markdown fences): {"addition": "string, the new content — if story panels, separate each panel with | "}`;
      const parsed = await callApi(prompt, false);
      const addition = {
        at: new Date().toISOString(),
        request: mode === "custom" ? studioInput.trim() : req,
        text: parsed.addition || "",
      };
      const next = saved.map((s) => (s.id === studioEntry.id ? { ...s, additions: [...(s.additions || []), addition] } : s));
      setSaved(next);
      setStudioEntry({ ...studioEntry, additions: [...(studioEntry.additions || []), addition] });
      await persistCollection(next);
      setStudioInput("");
    } catch (e) {
      setStudioError(`Expansion failed: ${e.message || "unknown error"} — try again.`);
    } finally {
      setStudioLoading(false);
    }
  };

  const [copiedField, setCopiedField] = useState(null);

  const copyText = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 1600);
    } catch (e) {
      setCopiedField("err");
      setTimeout(() => setCopiedField(null), 1600);
    }
  };

  const [showPlans, setShowPlans] = useState(false);
  const [subEmail, setSubEmail] = useState("");
  const [subStatus, setSubStatus] = useState(null); // null | {active, plan}
  const [subChecking, setSubChecking] = useState(false);

  const startCheckout = async (plan) => {
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, email: subEmail || undefined }),
      });
      const json = await r.json();
      if (json.url) window.location.href = json.url;
      else setError(json.error || "Checkout failed");
    } catch (e) {
      setError("Checkout failed — try again.");
    }
  };

  const checkSubscription = async () => {
    if (!subEmail) return;
    setSubChecking(true);
    try {
      const r = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: subEmail }),
      });
      const json = await r.json();
      setSubStatus(json);
      if (json.active) {
        setTier(json.plan === "platinum" || json.plan === "platinum_pass" ? "Alpha" : "Creator");
        setShowPlans(false);
      }
    } catch (e) {
      setSubStatus({ active: false, plan: null, error: true });
    } finally {
      setSubChecking(false);
    }
  };
  const [saved, setSaved] = useState([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = window.localStorage.getItem("mascotgen-collection");
        if (raw) {
          setSaved(JSON.parse(raw));
        }
      } catch (e) {
        // no saved collection yet — that's fine
      } finally {
        setSavedLoaded(true);
      }
    })();
  }, []);

  const persistCollection = async (list) => {
    try {
      window.localStorage.setItem("mascotgen-collection", JSON.stringify(list));
    } catch (e) {
      setSaveMsg("Couldn't save — try again.");
    }
  };

  const saveCurrent = async () => {
    if (!result) return;
    const entry = {
      id: `${Date.now()}`,
      savedAt: new Date().toISOString(),
      result,
      traits: { archetypes, vibes, world, colors, accessories: cappedAccessories, artStyle },
    };
    const next = [entry, ...saved].slice(0, 100);
    setSaved(next);
    await persistCollection(next);
    setSaveMsg("Saved to your collection ✓");
    setTimeout(() => setSaveMsg(null), 2500);
  };

  const deleteSaved = async (id) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    await persistCollection(next);
  };

  const loadSaved = (entry) => {
    setResult(entry.result);
    setTrendingInfo(entry.result.trendSource && entry.result._fromTrending ? entry.result.trendSource : null);
    if (entry.traits) {
      setArchetypes(entry.traits.archetypes || ["Dog"]);
      setVibes(entry.traits.vibes || ["Degen"]);
      setWorld(entry.traits.world || "Space");
      setColors(entry.traits.colors || ["Neon Green"]);
      setAccessories(entry.traits.accessories || []);
      setArtStyle(entry.traits.artStyle || "Hand-Drawn Sketch");
    }
    setView("card");
    setShowCollection(false);
  };

  const exportCollection = () => {
    const payload = {
      app: "MascotGen",
      exportedAt: new Date().toISOString(),
      count: saved.length,
      entries: saved,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mascotgen-collection-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importCollection = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const payload = JSON.parse(reader.result);
        const entries = payload.entries || [];
        // merge: imported entries + existing, dedupe by id, keep newest first
        const byId = {};
        [...entries, ...saved].forEach((en) => {
          if (en && en.id && !byId[en.id]) byId[en.id] = en;
        });
        const merged = Object.values(byId).sort((a, b) => (b.id > a.id ? 1 : -1)).slice(0, 100);
        setSaved(merged);
        await persistCollection(merged);
        setSaveMsg("Collection imported ✓");
        setTimeout(() => setSaveMsg(null), 2500);
      } catch (err) {
        setSaveMsg("Import failed — not a valid collection file.");
        setTimeout(() => setSaveMsg(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const accessoryMax = tier === "Alpha" ? 5 : tier === "Creator" ? 3 : 1;
  // keep accessories within cap when tier drops
  const cappedAccessories = accessories.slice(-accessoryMax);

  const buildPrompt = (trending) => {
    const base = trending
      ? `Search the web for what is trending RIGHT NOW on social media, in the news, and in pop culture — viral phrases, trending hashtags, notable quotes from public figures, breakout moments. Then pick the single most meme-able trend and design an original meme token concept around it, incorporating these creative picks where they fit:`
      : `You are helping brainstorm a meme cryptocurrency token concept. Based on these picks, invent an original character and token concept:`;

    return `${base}

Archetype${archetypes.length > 1 ? "s (HYBRID — fuse both into one creature)" : ""}: ${archetypes.join(" + ")}
Vibe${vibes.length > 1 ? "s (blend both)" : ""}: ${vibes.join(" + ")}
World/Theme: ${world}
Color${colors.length > 1 ? "s (two-tone/gradient)" : ""}: ${colors.join(" + ")}
Accessories: ${cappedAccessories.join(", ")}
Art Style: ${artStyle}

Respond ONLY with raw JSON (no markdown fences, no preamble) matching exactly this shape:
{
  ${trending ? `"trendSource": "string, 1-2 sentences describing the trend you found and where it's trending",\n  ` : ""}"characterName": "string, a fun character name",
  "tokenName": "string, a catchy token name",
  "ticker": "string, 3-5 letter uppercase ticker",
  "tagline": "string, punchy, under 12 words",
  "bio": "string, 2-3 sentences of lore/backstory, playful tone",
  "visualDescription": "string, one-paragraph art prompt in ${artStyle} style describing the ${archetypes.join("-")} hybrid with all accessories",
  "storyBeats": ["array of 4 short strings, origin story beats written like a ${artStyle} synopsis"],
  "socialBio": "string, a bio under 160 characters for the token's X and Telegram profiles",
  "firstTweet": "string, the launch announcement tweet, punchy, with 2-3 relevant hashtags, no financial promises",
  "telegramWelcome": "string, 2-3 sentence welcome message for new Telegram members, warm and on-theme",
  "rarity": "one of: Common, Rare, Epic, Legendary"
}`;
  };

  const callApi = async (prompt, useSearch) => {
    let data = null;
    let lastErr = null;
    const maxAttempts = 4;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, useSearch }),
        });
        const json = await response.json();
        if (json.error) {
          lastErr = new Error(json.error.message || json.error || "API error");
          await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
          continue;
        }
        data = json;
        break;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
      }
    }
    if (!data) {
      const e = lastErr || new Error("API unavailable");
      e._exhaustedRetries = true;
      throw e;
    }
    const text = data.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found in response");
    const parsed = JSON.parse(match[0]);
    return parsed;
  };

  const generate = async () => {
    if (overLimit) {
      setShowPricing(true);
      return;
    }
    setLoading(true);
    setError(null);
    setTrendingInfo(null);
    try {
      const parsed = await callApi(buildPrompt(false), false);
      setResult(parsed);
      setView("card");
      bumpGenCount();
    } catch (e) {
      const hint = e._exhaustedRetries
        ? " This is a temporary hiccup in the preview's connection to the API — wait ~30 seconds and try again, or test on your deployed version instead."
        : "";
      setError(`Generation failed: ${e.message || "unknown error"}.${hint}`);
    } finally {
      setLoading(false);
    }
  };

  const generateTrending = async () => {
    setTrendingLoading(true);
    setError(null);
    setTrendingInfo(null);
    try {
      const parsed = await callApi(buildPrompt(true), true);
      setTrendingInfo(
        parsed._searchUnavailable
          ? "Live web search isn't authorized in this preview environment, so this trend is based on general knowledge, not real-time data. Live search will work once deployed with your own API key."
          : parsed.trendSource || null
      );
      setResult(parsed);
      setView("card");
    } catch (e) {
      setError(`Trending mode failed: ${e.message || "unknown error"} — try again.`);
    } finally {
      setTrendingLoading(false);
    }
  };

  const rarityColor = { Common: MUTED, Rare: "#5EC9FF", Epic: MAGENTA, Legendary: AMBER };

  if (!entered) {
    return (
      <div className="min-h-screen w-full" style={{ backgroundColor: "#0A0A0A", color: OFFWHITE, fontFamily: "'Space Mono', monospace" }}>
        <HomePage
          fullscreen
          onStart={() => {
            setEntered(true);
            setPage("generator");
          }}
        />
        <p className="text-center text-xs pb-6 font-mono tracking-widest" style={{ color: "#555", backgroundColor: "#0A0A0A" }}>
          STORY &amp; MEME STUDIO · CRYPTO UNIVERSITY
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full p-6 md:p-10" style={{ backgroundColor: INK, color: OFFWHITE, fontFamily: "'Space Mono', monospace" }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Dice5 size={22} style={{ color: LIME }} />
            <h1 className="text-xl md:text-2xl tracking-tight" style={{ color: LIME }}>
              MASCOTGEN
            </h1>
          </div>
          <button
            onClick={() => setShowCollection(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
            style={{ borderColor: "#33303F", color: MUTED }}
          >
            <FolderOpen size={14} /> COLLECTION ({saved.length})
          </button>
        </div>

        {/* NAV TABS */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {[
            ["home", "HOME"],
            ["generator", "GENERATOR"],
            ["learn", "UNIVERSITY"],
            ["whitepaper", "WHITEPAPER"],
            ["pricing", "PRICING"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPage(key)}
              className="px-4 py-2 rounded-lg text-xs font-bold tracking-widest border transition-all"
              style={{
                borderColor: page === key ? LIME : "#33303F",
                color: page === key ? INK : MUTED,
                backgroundColor: page === key ? LIME : "transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {page === "home" && <HomePage onStart={() => setPage("generator")} />}
        {page === "learn" && <LearnPage />}
        {page === "whitepaper" && <WhitepaperPage />}
        {page === "pricing" && <PricingPage tier={tier} onBuy={startCheckout} />}
        <p className="text-sm mb-8" style={{ color: MUTED }}>
          STORY & MEME STUDIO · CRYPTO UNIVERSITY
        </p>

        {page === "generator" && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="rounded-xl p-5 md:p-6 border" style={{ backgroundColor: PANEL, borderColor: "#2A2733" }}>
            <div className="mb-6 p-3 rounded-lg border flex items-center justify-between gap-3" style={{ borderColor: "#33303F" }}>
              <div>
                <p className="text-xs uppercase tracking-widest" style={{ color: MUTED }}>
                  Plan: <span style={{ color: tier === "Alpha" ? AMBER : tier === "Creator" ? LIME : OFFWHITE }}>{tier === "Alpha" ? "Platinum" : tier === "Creator" ? "Starter" : "Free"}</span>
                </p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>
                  {monthlyLimit === Infinity ? "Unlimited generations" : `${Math.max(0, monthlyLimit - genCount)} of ${monthlyLimit} generations left this month`}
                </p>
              </div>
              <button
                onClick={() => setShowPricing(true)}
                className="px-4 py-2 rounded-lg text-xs font-bold shrink-0"
                style={{ backgroundColor: AMBER, color: INK }}
              >
                {tier === "Free" ? "UPGRADE" : "MANAGE"}
              </button>
            </div>

            <Section title="01 / Archetype" sub="Pick up to 2 for a hybrid creature" accent={LIME}>
              {ARCHETYPES.map((a) => (
                <Chip key={a} label={a} active={archetypes.includes(a)} onClick={() => setArchetypes((p) => toggleIn(p, a, 2))} accent={LIME} />
              ))}
            </Section>

            <Section title="02 / Vibe" sub="Pick up to 2 to blend" accent={MAGENTA}>
              {VIBES.map((v) => (
                <Chip key={v} label={v} active={vibes.includes(v)} onClick={() => setVibes((p) => toggleIn(p, v, 2))} accent={MAGENTA} />
              ))}
            </Section>

            <Section title="03 / World" accent={AMBER}>
              {WORLDS.map((w) => (
                <Chip key={w} label={w} active={world === w} onClick={() => setWorld(w)} accent={AMBER} />
              ))}
            </Section>

            <Section title="04 / Colors" sub="Pick up to 2 for a two-tone gradient" accent={LIME}>
              {COLORS.map((c) => (
                <Chip key={c} label={c} active={colors.includes(c)} onClick={() => setColors((p) => toggleIn(p, c, 2))} accent={LIME} />
              ))}
            </Section>

            <Section
              title="05 / Accessories"
              sub={`Your tier allows ${accessoryMax} — Free: 1, Creator: 3, Alpha: 5`}
              accent={MAGENTA}
            >
              {ACCESSORIES.map((ac) => (
                <Chip
                  key={ac}
                  label={ac}
                  active={cappedAccessories.includes(ac)}
                  onClick={() => setAccessories((p) => toggleIn(p, ac, accessoryMax))}
                  accent={MAGENTA}
                />
              ))}
              {ALPHA_ACCESSORIES.map((ac) => {
                const locked = tier !== "Alpha";
                return (
                  <Chip
                    key={ac}
                    label={locked ? `🔒 ⭐ ${ac}` : `⭐ ${ac}`}
                    active={cappedAccessories.includes(ac)}
                    onClick={() => {
                      if (!locked) setAccessories((p) => toggleIn(p, ac, accessoryMax));
                    }}
                    accent={AMBER}
                    dim={locked}
                  />
                );
              })}
            </Section>
            <p className="text-xs mb-4 -mt-2" style={{ color: MUTED }}>
              ⭐ Alpha-exclusive traits — these only exist at the top tier, making them naturally rare in the future NFT collection.
            </p>

            <Section title="06 / Art Style" accent={AMBER}>
              {ART_STYLES.map((s) => {
                const isPremiumStyle = s !== "Hand-Drawn Sketch";
                const locked = isPremiumStyle && tier === "Free";
                return (
                  <Chip
                    key={s}
                    label={locked ? `🔒 ${s}` : s}
                    active={artStyle === s}
                    onClick={() => {
                      if (!locked) setArtStyle(s);
                    }}
                    accent={AMBER}
                    dim={locked}
                  />
                );
              })}
            </Section>
            {tier === "Free" && (
              <p className="text-xs mb-4 -mt-2" style={{ color: MUTED }}>
                Creator tier unlocks all art styles including Anime / Manga.
              </p>
            )}

            <button
              onClick={generate}
              disabled={loading || trendingLoading || archetypes.length === 0}
              className="w-full mt-2 py-3 rounded-lg font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-opacity"
              style={{ backgroundColor: LIME, color: INK, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> GENERATING...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> GENERATE TOKEN
                </>
              )}
            </button>

            <button
              onClick={tier === "Alpha" ? generateTrending : undefined}
              disabled={trendingLoading || loading || tier !== "Alpha"}
              className="w-full mt-3 py-3 rounded-lg font-bold text-sm tracking-wide flex items-center justify-center gap-2 border-2 transition-opacity"
              style={{
                borderColor: tier === "Alpha" ? AMBER : "#33303F",
                color: tier === "Alpha" ? AMBER : MUTED,
                backgroundColor: "transparent",
                opacity: trendingLoading ? 0.7 : 1,
              }}
            >
              {trendingLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> SCANNING TRENDS...
                </>
              ) : tier === "Alpha" ? (
                <>🔥 TRENDING MODE — UNLOCKED</>
              ) : (
                <>🔒 TRENDING MODE — HOLD 1M $MGEN</>
              )}
            </button>
            <p className="text-xs mt-2 text-center" style={{ color: MUTED }}>
              {tier === "Alpha"
                ? "Trending Mode searches the live web for what's viral right now and builds a token concept from it."
                : "Reach Alpha tier to unlock live trend scanning — first-mover edge on emerging narratives."}
            </p>

            {error && (
              <p className="text-sm mt-3" style={{ color: MAGENTA }}>
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center">
            {result && !loading && !trendingLoading && (
              <div className="flex gap-2 mb-4 self-start">
                <button
                  onClick={() => setView("card")}
                  className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border"
                  style={{
                    borderColor: view === "card" ? LIME : "#33303F",
                    color: view === "card" ? INK : MUTED,
                    backgroundColor: view === "card" ? LIME : "transparent",
                  }}
                >
                  <CreditCard size={14} /> CARD
                </button>
                <button
                  onClick={() => setView("site")}
                  className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border"
                  style={{
                    borderColor: view === "site" ? LIME : "#33303F",
                    color: view === "site" ? INK : MUTED,
                    backgroundColor: view === "site" ? LIME : "transparent",
                  }}
                >
                  <Globe size={14} /> SITE PREVIEW
                </button>
              </div>
            )}

            {!result && !loading && !trendingLoading && (
              <div className="w-full max-w-sm rounded-xl border-2 border-dashed p-10 text-center" style={{ borderColor: "#33303F", color: MUTED }}>
                <div className="flex justify-center mb-4 opacity-60">
                  <MascotSVG archetypes={archetypes} colors={colors} accessories={cappedAccessories} size={120} />
                </div>
                <p className="text-sm">Live preview — hit generate for the full card.</p>
              </div>
            )}

            {(loading || trendingLoading) && (
              <div className="w-full max-w-sm rounded-xl border p-10 text-center" style={{ borderColor: "#2A2733", backgroundColor: PANEL, color: MUTED }}>
                <Loader2 size={24} className="animate-spin mx-auto mb-3" style={{ color: LIME }} />
                <p className="text-sm">{trendingLoading ? "Scanning the web for trends..." : "Cooking up your character..."}</p>
              </div>
            )}

            {result && !loading && !trendingLoading && view === "card" && (
              <div className="w-full max-w-sm rounded-xl border-2 p-5 relative overflow-hidden" style={{ borderColor: LIME, backgroundColor: PANEL }}>
                <div
                  className="absolute top-0 right-0 text-xs font-bold px-3 py-1 rounded-bl-lg"
                  style={{ backgroundColor: rarityColor[result.rarity] || MUTED, color: INK }}
                >
                  {result.rarity?.toUpperCase()}
                </div>

                <div className="flex justify-center mb-3">
                  <MascotSVG archetypes={archetypes} colors={colors} accessories={cappedAccessories} size={130} />
                </div>

                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>
                  ${result.ticker}
                </p>
                <h2 className="text-xl font-bold mb-1" style={{ color: LIME }}>
                  {result.characterName}
                </h2>
                <p className="text-sm mb-4" style={{ color: OFFWHITE }}>
                  {result.tokenName}
                </p>

                <p className="text-sm italic mb-4" style={{ color: AMBER }}>
                  "{result.tagline}"
                </p>

                {trendingInfo && (
                  <div className="mb-4 p-3 rounded-lg border" style={{ borderColor: AMBER, backgroundColor: "rgba(255,182,39,0.08)" }}>
                    <p className="text-xs uppercase tracking-widest mb-1" style={{ color: AMBER }}>
                      🔥 Trend Source
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: OFFWHITE }}>
                      {trendingInfo}
                    </p>
                  </div>
                )}

                {result.storyBeats && result.storyBeats.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>
                      Origin Story — {artStyle}
                    </p>
                    {result.storyBeats.map((beat, i) => (
                      <p key={i} className="text-xs leading-relaxed mb-1" style={{ color: OFFWHITE }}>
                        <span style={{ color: AMBER }}>Panel {i + 1}:</span> {beat}
                      </p>
                    ))}
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>
                    Lore
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: OFFWHITE }}>
                    {result.bio}
                  </p>
                </div>

                <div className="mb-2">
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>
                    Art Prompt
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                    {result.visualDescription}
                  </p>
                </div>

                <div className="mt-4 p-3 rounded-lg border" style={{ borderColor: "#33303F" }}>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: LIME }}>
                    Provenance
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                    Created {new Date().toLocaleString()} · Trait ID:{" "}
                    {btoa(`${archetypes.join("-")}|${cappedAccessories.join("-")}|${result.ticker}`)
                      .replace(/[^A-Za-z0-9]/g, "")
                      .slice(0, 12)
                      .toUpperCase()}
                  </p>
                  <p className="text-xs mt-1" style={{ color: MUTED }}>
                    On-chain minting stamps this permanently — verifiable proof you originated this character.
                  </p>
                </div>


                <div className="mt-4 p-3 rounded-lg border" style={{ borderColor: AMBER }}>
                  <p className="text-xs uppercase tracking-widest mb-2" style={{ color: AMBER }}>
                    🚀 Launch Package — pump.fun ready
                  </p>
                  <p className="text-xs mb-3" style={{ color: MUTED }}>
                    Tap to copy each field, then paste into pump.fun's create form. Direct in-app launch ships in Phase 4.
                  </p>
                  <div className="flex flex-col gap-2">
                    {[
                      ["Name", result.tokenName],
                      ["Ticker", result.ticker],
                      ["Description", `${result.tagline} — ${result.bio}`],
                      ["Art Prompt (for your image)", result.visualDescription],
                      ["X / Telegram Bio", result.socialBio],
                      ["Launch Tweet", result.firstTweet],
                      ["Telegram Welcome", result.telegramWelcome],
                    ]
                      .filter(([, value]) => value)
                      .map(([label, value]) => (
                      <button
                        key={label}
                        onClick={() => copyText(label, value)}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs border text-left"
                        style={{ borderColor: "#33303F", color: OFFWHITE }}
                      >
                        <span className="truncate">
                          <span style={{ color: MUTED }}>{label}: </span>
                          {value}
                        </span>
                        <span className="shrink-0 font-bold" style={{ color: copiedField === label ? LIME : AMBER }}>
                          {copiedField === label ? "COPIED ✓" : "COPY"}
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        copyText(
                          "All",
                          `Name: ${result.tokenName}\nTicker: ${result.ticker}\nDescription: ${result.tagline} — ${result.bio}\nArt Prompt: ${result.visualDescription}${result.socialBio ? `\nBio: ${result.socialBio}` : ""}${result.firstTweet ? `\nLaunch Tweet: ${result.firstTweet}` : ""}${result.telegramWelcome ? `\nTelegram Welcome: ${result.telegramWelcome}` : ""}`
                        )
                      }
                      className="w-full py-2 rounded-lg text-xs font-bold"
                      style={{ backgroundColor: AMBER, color: INK }}
                    >
                      {copiedField === "All" ? "COPIED ✓" : "📋 COPY FULL LAUNCH PACKAGE"}
                    </button>
                  </div>
                </div>

                <button
                  disabled
                  className="w-full mt-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border"
                  style={{ borderColor: "#33303F", color: MUTED, cursor: "not-allowed" }}
                >
                  💎 MINT AS NFT — PHASE 5
                </button>

                <button
                  onClick={saveCurrent}
                  className="w-full mt-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                  style={{ backgroundColor: LIME, color: INK }}
                >
                  <Save size={14} /> SAVE TO COLLECTION
                </button>
                {saveMsg && (
                  <p className="text-xs text-center mt-2" style={{ color: LIME }}>
                    {saveMsg}
                  </p>
                )}

                <button
                  onClick={generate}
                  className="w-full mt-2 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border"
                  style={{ borderColor: MAGENTA, color: MAGENTA }}
                >
                  <RefreshCw size={14} /> REROLL WITH SAME TRAITS
                </button>
              </div>
            )}

            {result && !loading && !trendingLoading && view === "site" && (
              <WebsitePreview result={result} traits={{ archetypes, colors, accessories: cappedAccessories }} />
            )}
          </div>
        </div>
        )}
      </div>

      {showPricing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-10 overflow-y-auto" style={{ backgroundColor: "rgba(10,9,14,0.9)" }}>
          <div className="w-full max-w-2xl rounded-xl border p-5 md:p-6" style={{ backgroundColor: PANEL, borderColor: "#2A2733" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: LIME }}>Plans</h2>
              <button onClick={() => setShowPricing(false)} style={{ color: MUTED }}><X size={20} /></button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg border p-4" style={{ borderColor: "#33303F" }}>
                <p className="text-sm font-bold" style={{ color: OFFWHITE }}>Free</p>
                <p className="text-xl font-bold my-1" style={{ color: OFFWHITE }}>$0</p>
                <p className="text-xs" style={{ color: MUTED }}>{FREE_MONTHLY_LIMIT} generations / month · Sketch art style only</p>
              </div>
              <div className="rounded-lg border p-4" style={{ borderColor: "#5EC9FF" }}>
                <p className="text-sm font-bold" style={{ color: "#5EC9FF" }}>One-Month Pass</p>
                <p className="text-xl font-bold my-1" style={{ color: OFFWHITE }}>$11<span className="text-xs font-normal" style={{ color: MUTED }}> once</span></p>
                <p className="text-xs mb-3" style={{ color: MUTED }}>11 generations · All art styles · 3 accessories · 30 days, no auto-renew</p>
                <button onClick={() => startCheckout("pass")} className="w-full py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: "#5EC9FF", color: INK }}>Get Pass</button>
              </div>
              <div className="rounded-lg border p-4" style={{ borderColor: LIME }}>
                <p className="text-sm font-bold" style={{ color: LIME }}>Starter</p>
                <p className="text-xl font-bold my-1" style={{ color: OFFWHITE }}>$11<span className="text-xs font-normal" style={{ color: MUTED }}>/mo</span></p>
                <p className="text-xs mb-3" style={{ color: MUTED }}>11 generations / month · All art styles · 3 accessories · renews monthly</p>
                <button onClick={() => startCheckout("starter")} className="w-full py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: LIME, color: INK }}>Get Starter</button>
              </div>
              <div className="rounded-lg border p-4" style={{ borderColor: AMBER }}>
                <p className="text-sm font-bold" style={{ color: AMBER }}>Platinum</p>
                <p className="text-xl font-bold my-1" style={{ color: OFFWHITE }}>$33<span className="text-xs font-normal" style={{ color: MUTED }}>/mo</span></p>
                <p className="text-xs mb-3" style={{ color: MUTED }}>Unlimited · Trending Mode · 5 accessories · ⭐ exclusive traits · discounted NFT mints (Phase 5)</p>
                <button onClick={() => startCheckout("platinum")} className="w-full py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: AMBER, color: INK }}>Get Platinum</button>
              </div>
              <div className="rounded-lg border p-4" style={{ borderColor: MAGENTA }}>
                <p className="text-sm font-bold" style={{ color: MAGENTA }}>All-Access Pass</p>
                <p className="text-xl font-bold my-1" style={{ color: OFFWHITE }}>$44<span className="text-xs font-normal" style={{ color: MUTED }}> once</span></p>
                <p className="text-xs mb-3" style={{ color: MUTED }}>Everything in Platinum · 30 days · no auto-renew</p>
                <button onClick={() => startCheckout("platinum_pass")} className="w-full py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: MAGENTA, color: INK }}>Get All-Access</button>
              </div>
            </div>

            <div className="rounded-lg border p-4" style={{ borderColor: "#33303F" }}>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: MUTED }}>Already subscribed? Unlock with your email</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none border"
                  style={{ backgroundColor: INK, borderColor: "#33303F", color: OFFWHITE }}
                />
                <button
                  onClick={() => checkSubscription(subEmail, false)}
                  disabled={subChecking}
                  className="px-4 py-2 rounded-lg text-xs font-bold"
                  style={{ backgroundColor: LIME, color: INK }}
                >
                  {subChecking ? "..." : "Unlock"}
                </button>
              </div>
              {subMsg && <p className="text-xs mt-2" style={{ color: subMsg.includes("✓") ? LIME : MAGENTA }}>{subMsg}</p>}
            </div>
          </div>
        </div>
      )}


      {studioEntry && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-10 overflow-y-auto" style={{ backgroundColor: "rgba(10,9,14,0.92)" }}>
          <div className="w-full max-w-2xl rounded-xl border p-5 md:p-6" style={{ backgroundColor: PANEL, borderColor: AMBER }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold" style={{ color: AMBER }}>
                ⭐ Story Studio — {studioEntry.result.characterName}
              </h2>
              <button onClick={() => setStudioEntry(null)} style={{ color: MUTED }}>
                <X size={20} />
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: MUTED }}>
              Expand this character's world. Traits and identity stay locked — the Studio only adds new canon.
            </p>

            <div className="flex gap-2 mb-3 flex-wrap">
              <button
                onClick={() => expandCharacter("panels")}
                disabled={studioLoading}
                className="px-3 py-2 rounded-lg text-xs font-bold border"
                style={{ borderColor: AMBER, color: AMBER }}
              >
                +4 Story Panels
              </button>
              <button
                onClick={() => expandCharacter("scene")}
                disabled={studioLoading}
                className="px-3 py-2 rounded-lg text-xs font-bold border"
                style={{ borderColor: AMBER, color: AMBER }}
              >
                New Scene Art Prompt
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                value={studioInput}
                onChange={(e) => setStudioInput(e.target.value)}
                placeholder='Or ask anything: "panels where they meet a rival", "describe their home"...'
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none border"
                style={{ backgroundColor: INK, borderColor: "#33303F", color: OFFWHITE }}
              />
              <button
                onClick={() => expandCharacter("custom")}
                disabled={studioLoading || !studioInput.trim()}
                className="px-4 py-2 rounded-lg text-xs font-bold shrink-0"
                style={{ backgroundColor: AMBER, color: INK }}
              >
                {studioLoading ? "..." : "EXPAND"}
              </button>
            </div>

            {studioLoading && (
              <p className="text-xs mb-3" style={{ color: MUTED }}>
                Writing new canon...
              </p>
            )}
            {studioError && (
              <p className="text-xs mb-3" style={{ color: MAGENTA }}>
                {studioError}
              </p>
            )}

            <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
              {(studioEntry.additions || [])
                .slice()
                .reverse()
                .map((a, i) => (
                  <div key={i} className="p-3 rounded-lg border" style={{ borderColor: "#33303F" }}>
                    <p className="text-xs mb-1" style={{ color: AMBER }}>
                      {new Date(a.at).toLocaleString()} — "{a.request.length > 60 ? a.request.slice(0, 60) + "..." : a.request}"
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: OFFWHITE }}>
                      {a.text.split(" | ").map((seg, j, arr) => (
                        <span key={j}>
                          {arr.length > 1 ? <span style={{ color: AMBER }}>Panel {j + 1}: </span> : null}
                          {seg}
                          {j < arr.length - 1 ? <br /> : null}
                        </span>
                      ))}
                    </p>
                  </div>
                ))}
              {(!studioEntry.additions || studioEntry.additions.length === 0) && !studioLoading && (
                <p className="text-xs" style={{ color: MUTED }}>
                  No expansions yet — use a quick action above or write your own request.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showCollection && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-10 overflow-y-auto"
          style={{ backgroundColor: "rgba(10,9,14,0.9)" }}
        >
          <div className="w-full max-w-2xl rounded-xl border p-5 md:p-6" style={{ backgroundColor: PANEL, borderColor: "#2A2733" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: LIME }}>
                My Collection
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportCollection}
                  disabled={saved.length === 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                  style={{ borderColor: saved.length ? LIME : "#33303F", color: saved.length ? LIME : MUTED }}
                >
                  ⬇ Export Backup
                </button>
                <label
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer"
                  style={{ borderColor: AMBER, color: AMBER }}
                >
                  ⬆ Import
                  <input type="file" accept="application/json,.json" onChange={importCollection} style={{ display: "none" }} />
                </label>
                <button onClick={() => setShowCollection(false)} style={{ color: MUTED }}>
                  <X size={20} />
                </button>
              </div>
            </div>
            {saveMsg && (
              <p className="text-xs mb-3" style={{ color: LIME }}>
                {saveMsg}
              </p>
            )}

            {!savedLoaded && (
              <p className="text-sm" style={{ color: MUTED }}>
                Loading...
              </p>
            )}

            {savedLoaded && saved.length === 0 && (
              <p className="text-sm" style={{ color: MUTED }}>
                Nothing saved yet. Generate a concept you like, then hit "Save to Collection" on the card.
              </p>
            )}

            <div className="flex flex-col gap-3">
              {saved.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border"
                  style={{ borderColor: "#33303F" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MascotSVG
                      archetypes={entry.traits?.archetypes || ["Animal"]}
                      colors={entry.traits?.colors || ["Neon Green"]}
                      accessories={entry.traits?.accessories || []}
                      size={48}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: OFFWHITE }}>
                        {entry.result.characterName} · ${entry.result.ticker}
                      </p>
                      <p className="text-xs truncate" style={{ color: MUTED }}>
                        {new Date(entry.savedAt).toLocaleDateString()} — {entry.result.tagline}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => loadSaved(entry)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ backgroundColor: LIME, color: INK }}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => {
                        if (tier === "Alpha") {
                          setShowCollection(false);
                          setStudioEntry(entry);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                      style={{
                        borderColor: tier === "Alpha" ? AMBER : "#33303F",
                        color: tier === "Alpha" ? AMBER : MUTED,
                        cursor: tier === "Alpha" ? "pointer" : "not-allowed",
                      }}
                      title={tier === "Alpha" ? "Expand this character" : "Top tier only"}
                    >
                      {tier === "Alpha" ? "⭐ Studio" : "🔒 Studio"}
                    </button>
                    <button onClick={() => deleteSaved(entry.id)} style={{ color: MAGENTA }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showPlans && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-10 overflow-y-auto"
          style={{ backgroundColor: "rgba(10,9,14,0.9)" }}
        >
          <div className="w-full max-w-2xl rounded-xl border p-5 md:p-6" style={{ backgroundColor: PANEL, borderColor: "#2A2733" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: LIME }}>
                Plans
              </h2>
              <button onClick={() => setShowPlans(false)} style={{ color: MUTED }}>
                <X size={20} />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border p-5" style={{ borderColor: "#33303F" }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: LIME }}>
                  Starter
                </p>
                <p className="text-2xl font-bold mb-1" style={{ color: OFFWHITE }}>
                  $11<span className="text-sm font-normal" style={{ color: MUTED }}>/mo</span>
                </p>
                <ul className="text-xs leading-relaxed mb-4" style={{ color: MUTED }}>
                  <li>• 11 generations per month</li>
                  <li>• All art styles incl. Anime / Manga</li>
                  <li>• Up to 3 accessories</li>
                  <li>• Save &amp; export collection</li>
                </ul>
                <button
                  onClick={() => startCheckout("starter")}
                  className="w-full py-2 rounded-lg text-xs font-bold"
                  style={{ backgroundColor: LIME, color: INK }}
                >
                  GET STARTER
                </button>
              </div>

              <div className="rounded-xl border-2 p-5" style={{ borderColor: AMBER }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: AMBER }}>
                  Platinum
                </p>
                <p className="text-2xl font-bold mb-1" style={{ color: OFFWHITE }}>
                  $33<span className="text-sm font-normal" style={{ color: MUTED }}>/mo</span>
                </p>
                <ul className="text-xs leading-relaxed mb-4" style={{ color: MUTED }}>
                  <li>• Unlimited generations</li>
                  <li>• 🔥 Trending Mode (live web scan)</li>
                  <li>• Up to 5 accessories + ⭐ exclusive traits</li>
                  <li>• Discounted NFT mint price (Phase 5)</li>
                </ul>
                <button
                  onClick={() => startCheckout("platinum")}
                  className="w-full py-2 rounded-lg text-xs font-bold"
                  style={{ backgroundColor: AMBER, color: INK }}
                >
                  GET PLATINUM
                </button>
              </div>
            </div>

            <div className="rounded-lg border p-4" style={{ borderColor: "#33303F" }}>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: MUTED }}>
                Already subscribed? Unlock with the email you paid with
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="flex-1 px-3 py-2 rounded-lg text-sm border bg-transparent outline-none"
                  style={{ borderColor: "#33303F", color: OFFWHITE }}
                />
                <button
                  onClick={checkSubscription}
                  disabled={subChecking || !subEmail}
                  className="px-4 py-2 rounded-lg text-xs font-bold"
                  style={{ backgroundColor: LIME, color: INK, opacity: subChecking ? 0.7 : 1 }}
                >
                  {subChecking ? "..." : "UNLOCK"}
                </button>
              </div>
              {subStatus && !subStatus.active && (
                <p className="text-xs mt-2" style={{ color: MAGENTA }}>
                  No active subscription found for that email.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
