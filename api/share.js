// 🐦 THE SHARE CARD — Vercel function #10 of 12.
//
// ONE function, TWO jobs, because the SPA cannot do either:
//   1. /s/<id>            → a tiny HTML page whose ONLY purpose is carrying
//      per-mascot OpenGraph/Twitter tags. X's crawler runs no JavaScript, so
//      the React app is invisible to it — this page is what the crawler sees.
//      A human who clicks the link is bounced straight into the app (/?m=id).
//   2. /api/share?id&img=1 → the 1200×630 card PNG itself, drawn fresh on
//      every request. The chapter count is queried LIVE from
//      published_chapters — the card can never go stale, because nothing is
//      ever stored. That count is the whole point of the card: it proves the
//      character has a history.
//
// X caches a link's card for up to ~a week and there is no reliable manual
// refresh. The app handles that upstream: share links carry ?v=<chapterCount>,
// so the URL — and therefore the cache key — changes exactly when the story
// grows. Old tweets keep the card from their era, which is correct.
//
// The font is a 9KB ASCII subset of DejaVu Sans Mono Bold embedded below —
// no runtime font fetch, no extra file for the deploy to lose.
//
// Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY. Optional: X_HANDLE (e.g.
// "@mascotgen") for twitter:site. Dependency: @resvg/resvg-js (package.json).

import { Resvg } from "@resvg/resvg-js";
import { computeStats } from "../src/stats.js";

const FONT = Buffer.from("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", "base64");
const MONO = "DejaVu Sans Mono";

const INK = "#0B0912", PANEL = "#161227", PANEL2 = "#100D1C", HAIRLINE = "#251F38";
const LIME = "#C6FF3D", MAGENTA = "#FF3EA5", OFFWHITE = "#F2F0F5", MUTED = "#8B87A0", AMBERISH = "#FFB627";
const TIER_COLOR = { "Super Legendary": "#FF9DF2", Legendary: "#FFD700", Epic: "#C77DFF", Rare: "#5EC9FF", Common: "#9A94AD" };
const ELEM_COLOR = { Fire: "#FF5A3C", Water: "#3CA9FF", Earth: "#B98A3C", Air: "#9FE6FF" };

async function sb(path) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
  });
  if (!r.ok) throw new Error(`sb ${r.status}`);
  return r.json();
}

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// The subset font is ASCII + a few marks — strip anything it can't draw so
// the card never shows tofu boxes.
const drawable = (s) => String(s || "").replace(/[^\x20-\x7E·«»—]/g, "").replace(/\s+/g, " ").trim();

async function fetchArt(url) {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const mime = (r.headers.get("content-type") || "image/png").split(";")[0];
    if (!/^image\/(png|jpeg|jpg|gif|webp)/.test(mime)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 6_000_000) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (e) { return null; }
}

// ---- The card itself --------------------------------------------------------
function segRow(x, y, label, v, w) {
  const segW = (w - 9 * 4) / 10;
  let segs = "";
  for (let i = 0; i < 10; i++) {
    const on = i < v;
    const col = on ? (v > 7 ? "#FFD700" : LIME) : "#1C1728";
    segs += `<rect x="${(x + 74 + i * (segW + 4)).toFixed(1)}" y="${y}" width="${segW.toFixed(1)}" height="18" rx="2" fill="${col}"${on ? ` filter="url(#glow)"` : ""}/>`;
  }
  return `<text x="${x}" y="${y + 15}" font-family="${MONO}" font-size="20" font-weight="bold" fill="${MUTED}">${label}</text>${segs}` +
    `<text x="${x + 74 + w + 14}" y="${y + 16}" font-family="${MONO}" font-size="22" font-weight="bold" fill="${v > 7 ? "#FFD700" : OFFWHITE}">${v}</text>`;
}

export function buildCardSVG(m) {
  const tierCol = TIER_COLOR[m.tier] || HAIRLINE;
  const elemCol = ELEM_COLOR[m.element] || MUTED;
  const name = drawable(m.name).toUpperCase().slice(0, 26) || "UNNAMED";
  const nameSize = name.length > 18 ? 34 : name.length > 13 ? 42 : 50;
  const ticker = drawable(m.ticker).toUpperCase().slice(0, 10);
  const chips = [
    { txt: (m.tier || "UNMINTED").toUpperCase(), col: tierCol },
    m.universe ? { txt: m.universe.toUpperCase(), col: "#9FE6FF" } : (m.tier !== "Unminted" ? { txt: "GENESIS ERA", col: "#FF9DF2" } : null),
    m.element ? { txt: m.element.toUpperCase(), col: elemCol } : null,
  ].filter(Boolean);
  let chipX = 596, chipsSvg = "";
  for (const c of chips) {
    const w = c.txt.length * 13.4 + 26;
    chipsSvg += `<rect x="${chipX}" y="170" width="${w.toFixed(0)}" height="34" rx="6" fill="${c.col}18" stroke="${c.col}" stroke-width="1.5"/>` +
      `<text x="${(chipX + w / 2).toFixed(0)}" y="193" text-anchor="middle" font-family="${MONO}" font-size="19" font-weight="bold" fill="${c.col}">${esc(c.txt)}</text>`;
    chipX += w + 12;
  }
  const s = m.stats || {};
  const statRows = s.power
    ? segRow(596, 242, "PWR", s.power, 380) + segRow(596, 276, "HP", s.hp, 380) +
      segRow(596, 310, "SPD", s.speed, 380) + segRow(596, 344, "SPC", s.special, 380)
    : `<text x="596" y="300" font-family="${MONO}" font-size="20" fill="${MUTED}">STATS SEALED UNTIL MINT</text>`;
  const battleHp = s.battleHp
    ? `<text x="596" y="416" font-family="${MONO}" font-size="22" font-weight="bold" fill="${MUTED}">BATTLE HP</text>` +
      `<text x="746" y="418" font-family="${MONO}" font-size="30" font-weight="bold" fill="#4DFF88" filter="url(#glow)">${s.battleHp}</text>`
    : "";
  // 📖 THE BANNER — the loudest thing on the card, by design.
  const n = m.chapters | 0;
  const banner = m.tier === "Unminted"
    ? { txt: "» UNMINTED PREVIEW — THE SAGA AWAITS «", col: MUTED }
    : n > 0
      ? { txt: `» ${n} CHAPTER${n === 1 ? "" : "S"} LIVE IN THE PENTAVERSE «`, col: MAGENTA }
      : { txt: "» MINTED — CHAPTER ONE IS COMING «", col: AMBERISH };
  const art = m.artData
    ? `<image href="${m.artData}" x="48" y="60" width="500" height="500" preserveAspectRatio="xMidYMid slice" clip-path="url(#artclip)"/>`
    : `<rect x="48" y="60" width="500" height="500" rx="14" fill="${PANEL2}"/>` +
      `<text x="298" y="330" text-anchor="middle" font-family="${MONO}" font-size="120" font-weight="bold" fill="${tierCol}" opacity="0.55">${esc(name.slice(0, 1) || "?")}</text>`;

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
<defs>
  <clipPath id="artclip"><rect x="48" y="60" width="500" height="500" rx="14"/></clipPath>
  <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="none"/><rect y="3" width="4" height="1" fill="#000" opacity="0.28"/></pattern>
</defs>
<rect width="1200" height="630" fill="${INK}"/>
<rect x="24" y="36" width="1152" height="558" rx="18" fill="${PANEL}" stroke="${HAIRLINE}" stroke-width="2"/>
${art}
<rect x="48" y="60" width="500" height="500" rx="14" fill="none" stroke="${tierCol}" stroke-width="3" filter="url(#glow)"/>
<text x="596" y="110" font-family="${MONO}" font-size="${nameSize}" font-weight="bold" fill="${OFFWHITE}" filter="url(#glow)">${esc(name)}</text>
${ticker ? `<text x="596" y="148" font-family="${MONO}" font-size="26" font-weight="bold" fill="${LIME}">$${esc(ticker)}</text>` : ""}
${chipsSvg}
${statRows}
${battleHp}
<rect x="576" y="446" width="576" height="66" rx="10" fill="${banner.col}14" stroke="${banner.col}" stroke-width="2" filter="url(#glow)"/>
<text x="864" y="489" text-anchor="middle" font-family="${MONO}" font-size="${banner.txt.length > 34 ? 22 : 26}" font-weight="bold" fill="${banner.col}">${esc(banner.txt)}</text>
<text x="596" y="566" font-family="${MONO}" font-size="22" font-weight="bold" fill="${LIME}">MASCOTGEN</text>
<text x="732" y="566" font-family="${MONO}" font-size="20" fill="${MUTED}">· mascotgen.studio</text>
<rect x="24" y="36" width="1152" height="558" rx="18" fill="url(#scan)" opacity="0.14" pointer-events="none"/>
</svg>`;
}

// ---- Load everything the card needs ----------------------------------------
async function loadMascot(id) {
  let data = null;
  try {
    const rows = await sb(`shared_mascots?id=eq.${encodeURIComponent(id)}&select=data`);
    if (rows[0] && rows[0].data && !rows[0].data.__resume) data = rows[0].data;
  } catch (e) {}
  const mintAddress = (data && data.mintAddress) || (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id) ? id : null);
  let mintRow = null, chapters = 0;
  if (mintAddress) {
    try {
      const rows = await sb(`mints?mint_address=eq.${encodeURIComponent(mintAddress)}&select=character_name,ticker,traits,card_tier,rarity,element,universe,image_url,marked_by,age_card,age_number,result_data`);
      mintRow = rows[0] || null;
    } catch (e) {}
    try {
      chapters = ((await sb(`published_chapters?mint_address=eq.${encodeURIComponent(mintAddress)}&select=id`)) || []).length;
    } catch (e) {}
  }
  if (!data && !mintRow) return null;

  // The mint row is the truth wherever both exist — a share snapshot frozen
  // before minting must never outrank the on-chain card.
  const tier = mintRow ? (mintRow.card_tier || mintRow.rarity || "Common") : (data && data.tier) || "Unminted";
  let stats = (data && data.stats) || null;
  let element = (data && data.element) || null;
  if (mintRow && mintRow.traits) {
    try {
      const live = computeStats(
        { ...mintRow.traits, characterName: mintRow.character_name, element: mintRow.element || undefined },
        tier, mintRow.marked_by || null, mintRow.age_card || null, mintRow.age_number || null,
        !mintRow.universe
      );
      stats = { power: live.power, hp: live.hp, speed: live.speed, special: live.special, battleHp: live.hpPoints };
      element = live.element ? live.element.id : (mintRow.element || element);
    } catch (e) {}
  }
  const rd = (mintRow && mintRow.result_data) || {};
  return {
    id,
    name: (mintRow && mintRow.character_name) || (data && data.name) || "Unnamed",
    ticker: (mintRow && mintRow.ticker) || (data && data.ticker) || "",
    tagline: (data && data.tagline) || rd.tagline || "",
    bio: (data && data.bio) || rd.bio || "",
    tier,
    universe: (mintRow && mintRow.universe) || (data && data.universe) || null,
    element,
    stats,
    image: (mintRow && mintRow.image_url) || (data && data.image) || null,
    chapters,
  };
}

export default async function handler(req, res) {
  const id = String((req.query && req.query.id) || "").slice(0, 80);
  if (!id) return res.status(400).send("Missing id");

  let m = null;
  try { m = await loadMascot(id); } catch (e) {}

  const host = (req.headers && req.headers.host) || "mascotgen.studio";
  const base = `https://${host}`;

  if (req.query && req.query.img) {
    if (!m) return res.status(404).send("Not found");
    m.artData = await fetchArt(m.image);
    try {
      const svg = buildCardSVG(m);
      const png = new Resvg(svg, {
        fitTo: { mode: "width", value: 1200 },
        font: { fontBuffers: [FONT], loadSystemFonts: false, defaultFontFamily: MONO },
      }).render().asPng();
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
      return res.status(200).send(Buffer.from(png));
    } catch (e) {
      // Card render failed — fall back to the raw art so the tweet still shows
      // SOMETHING rather than a broken image.
      if (m.image) { res.setHeader("Cache-Control", "public, s-maxage=120"); return res.redirect(302, m.image); }
      return res.status(500).send("Card render failed");
    }
  }

  // ---- HTML mode: the tags the crawler came for ----------------------------
  if (!m) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(404).send(`<!doctype html><html><head><meta charset="utf-8"><title>MascotGen</title></head><body style="background:${INK};color:${OFFWHITE};font-family:monospace;padding:40px"><p>This mascot page doesn't exist (or was never shared).</p><a style="color:${LIME}" href="/">mascotgen.studio</a></body></html>`);
  }
  const n = m.chapters | 0;
  const title = `${m.name}${m.ticker ? ` — $${m.ticker}` : ""}${n ? ` · ${n} chapter${n === 1 ? "" : "s"}` : ""}`;
  const descBits = [];
  if (m.tagline) descBits.push(m.tagline);
  descBits.push(n > 0 ? `${n} chapter${n === 1 ? "" : "s"} live in the Pentaverse.` : "A legend of the Pentaverse.");
  if (m.tier && m.tier !== "Unminted") descBits.push(`${m.tier}${m.universe ? ` · ${m.universe}` : " · Genesis Era"}${m.element ? ` · ${m.element}` : ""}.`);
  const desc = descBits.join(" ").slice(0, 280);
  const imgUrl = `${base}/api/share?id=${encodeURIComponent(id)}&img=1&ch=${n}`;
  const pageUrl = `${base}/s/${encodeURIComponent(id)}`;
  const appUrl = `/?m=${encodeURIComponent(id)}`;
  const xHandle = process.env.X_HANDLE ? `<meta name="twitter:site" content="${esc(process.env.X_HANDLE)}">` : "";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · MascotGen</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="MascotGen">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:image" content="${esc(imgUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${xHandle}
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(imgUrl)}">
</head>
<body style="background:${INK};color:${OFFWHITE};font-family:monospace;padding:40px">
<p>Opening <b>${esc(m.name)}</b>'s page&hellip;</p>
<a style="color:${LIME}" href="${esc(appUrl)}">Tap here if nothing happens</a>
<script>location.replace(${JSON.stringify(appUrl)});</script>
</body></html>`);
}
