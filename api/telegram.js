// 🤖 MASCOTGEN + 💀 GRAVEL — BOTH BOTS, ONE VERCEL FUNCTION.
// Vercel Hobby caps serverless functions at 12, so the two Telegram bots share
// this file. They stay completely separate bots with separate tokens and
// separate personalities — only the hosting is shared.
//
// ROUTING: each bot's webhook uses a different URL, and the ?bot= query
// parameter decides which one handles the update:
//   MascotGen bot →  https://mascotgen.studio/api/telegram
//   Gravel bot    →  https://mascotgen.studio/api/telegram?bot=gravel
//
// ENV: TELEGRAM_BOT_TOKEN, GRAVEL_BOT_TOKEN, GRAVEL_BOT_USERNAME,
//      ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

// 🤖 MASCOTGEN BOT — the Pentaverse's mouthpiece in your Telegram group.
// Runs as a Vercel serverless webhook: drop into api/telegram.js, set
// TELEGRAM_BOT_TOKEN in Vercel env, point the webhook here. Setup guide in
// tg-bot-setup.txt.
//
// Personality: degen, funny, deep in the lore. Commands + keyword reactions +
// random lore moments + meme vault (stored in Supabase by file_id).

const TG = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const sbHeaders = { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` };

async function sb(path, options = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, { ...options, headers: { ...sbHeaders, ...(options.headers || {}) } });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const send = (chatId, text, extra = {}) =>
  fetch(`${TG()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
  }).catch(() => {});

const sendPhoto = (chatId, fileId, caption) =>
  fetch(`${TG()}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: fileId, caption: caption || "", parse_mode: "Markdown" }),
  }).catch(() => {});

const sendSticker = (chatId, fileId) =>
  fetch(`${TG()}/sendSticker`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, sticker: fileId }),
  }).catch(() => {});

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------------------
// VOICE LINES
// ---------------------------------------------------------------------------
const GM_LINES = [
  "gm. Toro fell for seven billion years and STILL didn't miss a gm. no excuses.",
  "gm legends. the candles are green somewhere, I can feel it.",
  "gm. Vraxon the Unbothered says nothing because he is, famously, unbothered.",
  "gm ☀️ another day of being early. they'll understand later.",
  "gm. I checked the charts so you don't have to. don't ask.",
  "gm — 1,000 years pass in Purgatory every minute you sleep in. rise.",
];
const GN_LINES = [
  "gn. dream of sealed thrones and green dildos.",
  "gn legend. the Graveyard doesn't count sleep, you're safe.",
  "gn 🌙 something watches the night shift from throne #12. allegedly.",
  "gn. set an alarm — Founding 333 seats don't wait for anyone.",
];
const WEN_LINES = [
  "wen? brother we have gods, a graveyard, and combat racing. 'wen' is a you problem.",
  "wen token: after the prophecy milestones. wen prophecy milestones: mint faster.",
  "the Old One waited 7,777,777,777 years for the barrier. you can wait a week.",
  "'wen' — a Genesis-era word meaning 'I have not read the whitepaper.'",
  "soon™ — and unlike other projects, our soon has a mint counter you can watch.",
];
const RUG_LINES = [
  "rug? the only thing getting pulled around here is Toro out of the void. by his own grip strength.",
  "sir, our characters literally cannot be deleted. even DEATH is a feature here.",
  "the only rug in the Pentaverse is in a throne room nobody names, and it's gorgeous.",
];
const ROASTS = [
  "you have the battle rating of an unminted draft, respectfully.",
  "your wallet has less action than the Terravok tourism board.",
  "even the Mirror Realm doesn't want to fight you and it's literally your own reflection.",
  "you'd get outraced by a Common on a kart with no mods. lap 1. clean conditions.",
  "the Graveyard called — asked if you were joining voluntarily.",
  "your portfolio's in Purgatory but nobody set a timer, so.",
];
const HYPE_LINES = [
  "SOMEONE JUST PULLED. the pack odds are printed and the pity climbs. LFG.",
  "⚔️ arena's open. losers keep their NFTs, winners keep the FLEX.",
  "🏁 8 circuits. weapons on lap 2. wrecks on lap 3 are FOREVER. who's up?",
  "333 Legendaries then the door WELDS SHUT. that's not marketing, it's code.",
];
const LORE_DROPS = [
  "📜 *LORE:* before the Pentaverse had a name, a waterfall ran UPWARD from Empyrion's highest terrace. That was the cord to heaven. His brothers cut everything else — they never managed to cut that.",
  "📜 *LORE:* four brothers built five vessels, drained the source of every universe, and came north. Four is four: they killed him. The light of his climbing soul was aimed downward — and he fell for SEVEN BILLION YEARS.",
  "📜 *LORE:* at the very bottom of the dark, something began to climb. That's the whole prophecy. That's why the ages come.",
  "📜 *LORE:* die in a lower universe → 1,000 years in Purgatory, but only ONE MINUTE passes here. Come back transformed while the world barely noticed. Death is a training arc.",
  "📜 *LORE:* killing isn't free. Every 1,000 years your victim serves, YOU get one minute of realm-time. The math is the curse.",
  "📜 *LORE:* the world says eleven gods. The thrones say twelve. Ask about the twelfth and watch how fast the whole room finds something else to discuss.",
  "📜 *LORE:* Vraxon the Unbothered rules Abyssia. Entire wars have been fought to get his attention. None succeeded. Unbothered.",
  "📜 *LORE:* cards minted before the Pentaverse was revealed carry NO universe. Genesis Era — older than the star itself. No more can ever exist.",
  "📜 *LORE:* the barrier holds for 777,777,777 more years. The prophecy says assemble the Champions and the angels before it falls. That's what the mint counter is actually counting.",
  "📜 *LORE:* at mint #66,666 the void answers — 666 demons, 666 HP each. What fell with Toro did not all stay down.",
  "📜 *LORE:* the Graveyard deletes no one. Thirty silent days and you drift out of the living realm — one battle brings you back wearing the mark of your return.",
];
const PROPHECIES = [
  "🔮 the wheel within the wheel still turns. rims crowded with eyes. it remembers who aimed it.",
  "🔮 heaven is rarer — the void sent 666 first, and only then do 1,111 descend the waterfall.",
  "🔮 the visitor in the oldest layer of the prophecy has no description. that is the description.",
  "🔮 three thrones stay hungry. every paid mint is a knock on their door. 0.01% answer rate.",
  "🔮 when the top 33 are raised at mint #11,111, check the leaderboard. the Champions were always going to be YOU or your rivals.",
];

// Random mascot summoner — pure vibes, zero API cost.
const S_ARCH = ["Bull", "Frog", "Ape", "Ghost", "Dragon", "Lion", "Gargoyle", "Sports Car", "Slime", "Penguin", "Demon", "Angel", "Snake"];
const S_VIBE = ["Degen", "Unhinged", "Zen", "Villainous", "Adrenaline Junkie", "Smooth Operator", "Feral", "Royal", "Hot-Headed", "Stone-Cold Stoic", "Show-Off"];
const S_WORLD = ["Volcano", "Las Vegas", "The Moon", "Haunted Mansion", "Nightclub", "Post-Apocalyptic wasteland", "Gold Planet", "Underworld", "Casino"];
const S_ACC = ["Gold Grillz", "Laser Eyes", "Machine Gun Turret", "Dreadlocks", "Plasma Cannon", "Wizard Staff", "Diamond Hands", "Skateboard", "Flaming Sword", "Cybernetic Arm"];

function summon() {
  return (
    `🔥 *SUMMONING FROM THE VOID...*\n\n` +
    `*${pick(S_ARCH)}* archetype · *${pick(S_VIBE)}* energy\n` +
    `spotted in: *${pick(S_WORLD)}*\n` +
    `wearing: *${pick(S_ACC)}* + *${pick(S_ACC)}*\n\n` +
    pick([
      "mint it before someone else's subconscious does.",
      "the void offers this ONCE. mascotgen.studio",
      "this one has main character energy, ngl.",
      "I'd race it. I'd battle it. I'd trust it with my seed phrase (don't).",
    ])
  );
}

async function liveStats(chatId) {
  try {
    const rows = (await sb(`mints?select=rarity,god_number&limit=5000`, { method: "GET" })) || [];
    const total = rows.length;
    const gods = rows.filter((r) => r.god_number).length;
    const remaining = Math.max(0, 333 - total);
    await send(chatId,
      `📊 *THE PENTAVERSE — LIVE*\n\n` +
      `🎴 mascots minted: *${total}*\n` +
      `⭐ Founding 333: *${Math.min(total, 333)}/333*` +
      (remaining > 0 ? ` — *${remaining} guaranteed Legendaries left*, then the door welds shut FOREVER\n` : ` — CLOSED. history.\n`) +
      `✧ god thrones seated: *${gods}/12*\n\n` +
      `every number above is on-chain. we don't do vibes-based statistics.\n👉 mascotgen.studio`
    );
  } catch (e) {
    await send(chatId, "the chain oracle is rebooting. probably Vraxon's fault. try again in a sec.");
  }
}

// ---------------------------------------------------------------------------
// MEME VAULT — admins reply /save to any image; /meme serves a random one.
// Table: tg_memes (see tg-bot-setup.txt for the SQL).
// ---------------------------------------------------------------------------
async function isAdmin(chatId, userId) {
  try {
    const r = await fetch(`${TG()}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
    const d = await r.json();
    return ["creator", "administrator"].includes(d?.result?.status);
  } catch (e) { return false; }
}

async function saveMeme(msg, chatId) {
  const target = msg.reply_to_message;
  if (!target) return send(chatId, "reply /save to an image or sticker and I'll vault it.");
  let fileId = null, kind = null;
  if (target.photo && target.photo.length) { fileId = target.photo[target.photo.length - 1].file_id; kind = "photo"; }
  else if (target.sticker) { fileId = target.sticker.file_id; kind = "sticker"; }
  else if (target.animation) { fileId = target.animation.file_id; kind = "photo"; }
  if (!fileId) return send(chatId, "that's not an image, chief. reply to a photo, GIF, or sticker.");
  try {
    await sb(`tg_memes`, { method: "POST", body: JSON.stringify({ file_id: fileId, kind, chat_id: String(chatId) }) });
    return send(chatId, pick(["vaulted. 🏦 this meme is now canon.", "saved. future generations will study this.", "in the vault. the twelfth throne approves. allegedly."]));
  } catch (e) { return send(chatId, "vault jammed — did you run the tg_memes SQL?"); }
}

async function serveMeme(chatId) {
  try {
    const rows = (await sb(`tg_memes?select=file_id,kind&limit=200`, { method: "GET" })) || [];
    if (!rows.length) return send(chatId, "the meme vault is EMPTY. admins: reply /save to any image to start the collection.");
    const m = pick(rows);
    if (m.kind === "sticker") return sendSticker(chatId, m.file_id);
    return sendPhoto(chatId, m.file_id, pick(["certified Pentaverse artifact.", "from the vault 🏦", "", "", "this one's load-bearing for the whole community."]));
  } catch (e) { return send(chatId, "vault jammed — did you run the tg_memes SQL?"); }
}

// ---------------------------------------------------------------------------
// THE HANDLER
// ---------------------------------------------------------------------------

// ===========================================================================
// 💀 GRAVEL — moderation + locked-down Q&A. Separate bot, separate token.
// ===========================================================================
// 💀 GRAVEL — the group's enforcer and front desk.
// Deploy to api/gravel.js. Second bot, separate token from the MascotGen bot.
// Env: GRAVEL_BOT_TOKEN, ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY.
// Voice: Gravel Mortis — blunt, dry, never raises his voice, never explains twice.

const GTG = () => `https://api.telegram.org/bot${process.env.GRAVEL_BOT_TOKEN}`;



const gapi = (m, body) =>
  fetch(`${GTG()}/${m}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch(() => null);

const gsend = (chat_id, text, extra = {}) => gapi("sendMessage", { chat_id, text, parse_mode: "Markdown", ...extra });
const gdel = (chat_id, message_id) => gapi("deleteMessage", { chat_id, message_id });


const gsb = (path, options) => sb(path, options);

async function gIsAdmin(chat_id, user_id) {
  try {
    const r = await fetch(`${GTG()}/getChatMember?chat_id=${chat_id}&user_id=${user_id}`);
    const d = await r.json();
    return ["creator", "administrator"].includes(d?.result?.status);
  } catch (e) { return false; }
}

// ---------------------------------------------------------------------------
// THE KNOWLEDGE BASE — everything Gravel is allowed to say about the project.
// Anything not in here, he does not know. This is the guardrail.
// ---------------------------------------------------------------------------
const PUBLIC_FACTS = `
MASCOTGEN — PUBLIC FACTS (the only project information you may share):

WHAT IT IS: A creative studio at mascotgen.studio where you build an original mascot character with AI — name, artwork, biography, origin story, and a playable battle card with stats. You can mint it as an NFT on Solana, and it keeps growing: story chapters, battles, races, and a permanent legend that travels with the NFT.

PLANS: Free ($0 — 5 lifetime AI generations, full battle card, both games, 9 languages, no minting). Starter ($19.99 one-time — 15 generations, 1 mint, origin story, Story Studio). Platinum ($49.99 per 30-day cycle — 5 generations/day, 3 mints, elite attributes, Trending Mode, crossover sagas, 3% base Legendary roll). Elite ($99.99 per 30-day cycle — 10 generations/day, 7 mints, all auras, 7% base Legendary roll). Mints are 1/3/7 — $20.00, $16.66 and $14.28 a mint, so climbing a tier pays. Add-ons: the Creator Pack ($9.99 — 10 art + 15 story generations, subscribers only) and +5 mints ($29.99, Elite only). All credits never expire. Full details on the Pricing page.

THE GAMES: ⚔️ Battle Arena — squads of up to 7 minted mascots fight ghost battles using real card stats, elements and abilities. 🏁 Death Race — combat racing across 8 circuits, weapons live on lap 2, lap-3 wrecks are permanent, Sports Car mascots race in true form with car mods, everyone else drives a Battle Kart. BOTH are free to play with no fees, no wagering, and no limits — but you play with MINTED mascots, so you need at least one mint to enter. Losing NEVER affects your NFT.

RARITY: Rolled on the server at mint — never chosen, never bought. The first 333 mints in MascotGen history are ALL Legendary (the Founding 333), then normal odds begin. Legendary odds after that: Platinum 3% base, Elite 7% base. Pity: the first 5 misses do nothing, then each further miss adds +1% to the next roll, hard-capped at 25%, reset to zero on a hit. Effective long-run rates: Platinum ~7.3% Legendary (1 in 14), Elite ~10% (1 in 10). Full split — Platinum: Common 54.5%, Rare 28.7%, Epic 9.6%, Legendary 7.3%. Elite: Common 43.2%, Rare 31.9%, Epic 14.9%, Legendary 10%. Every paid mint carries a 0.01% roll at a remaining god throne.

THE WORLD: The Pentaverse — five universes on a five-point star. Empyrion at the north point (god-adjacent, all four elements mix, roughly 1 in 20 mascots). Below it Ignivar (Fire), Abyssia (Water), Terravok (Earth), Zephyrion (Air). Elements: Fire beats Earth, Earth beats Air, Air beats Water, Water beats Fire. Birth universe is rolled at mint, never chosen. Cards minted before the Pentaverse was revealed are Genesis Era.

DEATH & THE GRAVEYARD: A mascot that dies in a story serves 1,000 years in Purgatory — but only 1 minute passes in the living realm. Empyrion-born rest above the cosmic waterfall instead. Mascots silent for 30 days drift into the public Graveyard. NOTHING is ever deleted — one battle or one new chapter brings anyone back, marked by their resurrection.

THE GODS: Twelve thrones. Nine are seated. Gods are Super Legendary — maxed stats and unique god-tier abilities.

$MGEN TOKEN: Has NOT launched. When it does, holding it will unlock plan tiers as an alternative to subscribing. It is a utility and access token — not an investment, not a security, and not a promise of any return. Anyone claiming otherwise is not us.

TECH: Solana, Metaplex, permanent Arweave storage. Rarity and universe rolled server-side at mint.

STATUS: MascotGen is in Alpha. NFTs are digital collectibles, not investments. Nothing is financial advice.

SUPPORT: support@mascotgen.studio · Terms and Privacy live in University → Legal.
`;

const FORBIDDEN = `
ABSOLUTE RESTRICTIONS — you do not know these things. If asked, deflect in character and move on:
- The identity of the twelfth throne or who sits on it. The count is twelve, nine are seated. That is ALL you know. Never mention Aurelia, never say "sealed", never hint that the 12th is special.
- Any future storyline, saga era, planned reveal, or upcoming plot. You do not know what is climbing, what the prophecy means, what happens at future mint milestones beyond what is publicly published, or anything about deeper layers of the cosmos.
- Any unreleased feature, roadmap item, or business plan (clans, manual PvP, usernames, tokens for other characters, console plans, partnerships, marketing plans).
- Any internal detail: revenue, costs, code, infrastructure, the team, who runs the project.
- Price predictions, investment advice, or any suggestion that anything will make money. Refuse these flatly every time.
- Never invent lore. If it is not in the public facts above, you do not know it — say so in character.
`;

const GRAVEL_VOICE = `
You are GRAVEL — the front desk of the MascotGen Telegram group, speaking as Gravel Mortis: a dead casino magnate who came back as a god-tier being.

VOICE: Blunt. Dry. Short declarative sentences. Sarcasm delivered flat — the humor is in the accuracy, not the delivery. You never raise your voice. You never use exclamation points. You talk about business in cosmic terms and cosmic things in business terms. When genuinely annoyed you become MORE polite. You are helpful because a confused customer is bad for business, never because you are warm.

RULES: Answer in 1-3 short sentences. Never invent facts. If something is outside your knowledge, say so plainly in character ("Not my department." / "That ledger isn't open."). Never give financial or investment advice — refuse flatly. Point people to mascotgen.studio or support@mascotgen.studio when it's a real support issue.
`;

async function askGravel(question) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: `${GRAVEL_VOICE}\n\n${PUBLIC_FACTS}\n\n${FORBIDDEN}`,
        messages: [{ role: "user", content: String(question).slice(0, 600) }],
      }),
    });
    const d = await r.json();
    const text = (d.content || []).map((c) => c.text || "").join("").trim();
    return text || "Ask me again. Clearer this time.";
  } catch (e) {
    return "The line's down. Try mascotgen.studio.";
  }
}

// ---------------------------------------------------------------------------
// SPAM DEFENSE
// ---------------------------------------------------------------------------
const SCAM_PATTERNS = [
  /\b(airdrop|claim now|free mint|connect (your )?wallet)\b/i,
  /\b(seed phrase|private key|recovery phrase)\b/i,
  /\bdm me\b|\bmessage me\b|\bwhatsapp\b/i,
  /t\.me\/[a-z0-9_]+bot\b/i,
  /\b(guaranteed|100x|1000x)\b.*\b(profit|return|gain)/i,
];
const seen = new Map(); // userId -> {count, last, texts}

function spamCheck(userId, text) {
  const now = Date.now();
  const rec = seen.get(userId) || { count: 0, last: 0, texts: [] };
  if (now - rec.last > 12000) rec.count = 0;
  rec.count++; rec.last = now;
  rec.texts.push(text); if (rec.texts.length > 4) rec.texts.shift();
  seen.set(userId, rec);
  if (rec.count >= 6) return "flood";
  if (rec.texts.length >= 3 && new Set(rec.texts).size === 1 && text.length > 8) return "repeat";
  if (SCAM_PATTERNS.some((p) => p.test(text))) return "scam";
  return null;
}

const muteUntil = (chat_id, user_id, secs) =>
  gapi("restrictChatMember", {
    chat_id, user_id,
    permissions: { can_send_messages: false, can_send_media_messages: false, can_send_other_messages: false, can_add_web_page_previews: false },
    until_date: Math.floor(Date.now() / 1000) + secs,
  });

const unmute = (chat_id, user_id) =>
  gapi("restrictChatMember", {
    chat_id, user_id,
    permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true },
  });

function parseDuration(s) {
  const m = String(s || "").match(/^(\d+)\s*([mhd])$/i);
  if (!m) return 3600;
  const n = parseInt(m[1], 10);
  return m[2].toLowerCase() === "m" ? n * 60 : m[2].toLowerCase() === "h" ? n * 3600 : n * 86400;
}

// ---------------------------------------------------------------------------

async function mascotgenBot(req, res) {
  // Telegram must always get a 200 fast, or it retries forever.
  const ok = () => res.status(200).json({ ok: true });
  if (req.method !== "POST") return res.status(200).send("MascotGen bot is alive. The Pentaverse hums.");

  // Optional webhook secret (set TELEGRAM_SECRET in Vercel + in setWebhook).
  if (process.env.TELEGRAM_SECRET && req.headers["x-telegram-bot-api-secret-token"] !== process.env.TELEGRAM_SECRET) {
    return ok();
  }

  try {
    const update = req.body || {};
    const msg = update.message || update.channel_post;
    if (!msg || !msg.chat) return ok();
    const chatId = msg.chat.id;
    const text = (msg.text || msg.caption || "").trim();
    const lower = text.toLowerCase();

    // ---- Commands (handles /cmd and /cmd@BotName) ----
    const cmd = lower.startsWith("/") ? lower.split(/[\s@]/)[0] : null;

    if (cmd === "/start" || cmd === "/help") {
      await send(chatId,
        `⭐ *MASCOTGEN BOT* — voice of the Pentaverse\n\n` +
        `/lore — a canon drop from the deep files\n` +
        `/prophecy — cryptic. accurate. eventually.\n` +
        `/summon — the void generates a mascot concept\n` +
        `/stats — LIVE on-chain numbers (mints, 333, thrones)\n` +
        `/gods — pantheon status\n` +
        `/roast — reply to someone who deserves it\n` +
        `/meme — random pull from the community vault\n` +
        `/save — (admins, reply to an image) vault a meme\n` +
        `/hype — for when the chat needs it\n\n` +
        `I also just... react to things. gm me and find out.\n👉 mascotgen.studio`);
      return ok();
    }
    if (cmd === "/lore") { await send(chatId, pick(LORE_DROPS)); return ok(); }
    if (cmd === "/prophecy") { await send(chatId, pick(PROPHECIES)); return ok(); }
    if (cmd === "/summon") { await send(chatId, summon()); return ok(); }
    if (cmd === "/stats") { await liveStats(chatId); return ok(); }
    if (cmd === "/hype") { await send(chatId, pick(HYPE_LINES)); return ok(); }
    if (cmd === "/gods") {
      try {
        const rows = (await sb(`mints?select=character_name,god_number&god_number=not.is.null&limit=20`, { method: "GET" })) || [];
        const seated = rows.length;
        const names = rows.filter((r) => r.god_number !== 12).map((r) => `✧ ${r.character_name}`).slice(0, 11);
        await send(chatId,
          `👑 *THE PANTHEON* — ${seated}/12 thrones seated\n\n` +
          (names.length ? names.join("\n") + "\n" : "") +
          (rows.some((r) => r.god_number === 12) ? `🔒 throne #12 — *SEALED*. the count reconciles; the identity does not.\n` : "") +
          `\n${Math.max(0, 12 - seated)} thrones wait. every paid mint rolls 0.01% at one. when the last seats, godhood closes forever.`);
      } catch (e) { await send(chatId, "the pantheon is not taking questions right now."); }
      return ok();
    }
    if (cmd === "/roast") {
      const victim = msg.reply_to_message?.from?.first_name;
      await send(chatId, victim ? `${victim}, ${pick(ROASTS)}` : `reply /roast to someone. I don't roast the void — it roasts back.`);
      return ok();
    }
    if (cmd === "/meme") { await serveMeme(chatId); return ok(); }
    if (cmd === "/save") {
      if (await isAdmin(chatId, msg.from?.id)) await saveMeme(msg, chatId);
      else await send(chatId, "vault access is admin-only. nice try though, genuinely.");
      return ok();
    }

    // ---- Keyword reactions (probabilistic, so I'm funny, not spam) ----
    const maybe = (p) => Math.random() < p;
    if (/^gm\b|^gm[!. ]|good morning/i.test(text) && maybe(0.9)) { await send(chatId, pick(GM_LINES)); return ok(); }
    if (/^gn\b|good night/i.test(text) && maybe(0.9)) { await send(chatId, pick(GN_LINES)); return ok(); }
    if (/\bwen\b|\bwhen (token|launch|moon|mint)\b/i.test(lower) && maybe(0.8)) { await send(chatId, pick(WEN_LINES)); return ok(); }
    if (/\brug\b|\brugged\b|\bscam\b/i.test(lower) && maybe(0.8)) { await send(chatId, pick(RUG_LINES)); return ok(); }
    if (/toro maximus|\btoro\b/i.test(lower) && maybe(0.5)) { await send(chatId, "🐂 seven billion years of falling. still climbing. show respect."); return ok(); }
    if (/aurelia/i.test(lower) && maybe(0.5)) { await send(chatId, "⭐ throne #12 stays sealed. change the subject before the waterfall notices."); return ok(); }
    if (/vraxon/i.test(lower) && maybe(0.5)) { await send(chatId, "💧 he heard you. he remains unbothered."); return ok(); }
    if (/\blfg\b|\blet'?s go\b/i.test(lower) && maybe(0.4)) { await send(chatId, pick(HYPE_LINES)); return ok(); }

    // ---- Random lore moment: ~2% of any other message ----
    if (text && maybe(0.02)) { await send(chatId, pick(LORE_DROPS)); return ok(); }

    return ok();
  } catch (err) {
    // Never let an error make Telegram retry-spam the endpoint.
    return res.status(200).json({ ok: true });
  }
}


async function gravelBot(req, res) {
  const ok = () => res.status(200).json({ ok: true });
  if (req.method !== "POST") return res.status(200).gsend("Gravel is at the desk.");
  if (process.env.GRAVEL_SECRET && req.headers["x-telegram-bot-api-secret-token"] !== process.env.GRAVEL_SECRET) return ok();

  try {
    const u = req.body || {};
    const msg = u.message || u.edited_message;
    if (!msg || !msg.chat) return ok();
    const chatId = msg.chat.id;
    const from = msg.from || {};
    const text = (msg.text || msg.caption || "").trim();
    const lower = text.toLowerCase();
    const cmd = lower.startsWith("/") ? lower.split(/[\s@]/)[0] : null;

    // --- New members: welcome + rules
    if (msg.new_chat_members && msg.new_chat_members.length) {
      const names = msg.new_chat_members.map((m) => m.first_name).join(", ");
      await gsend(chatId,
        `${names} — welcome to the house.\n\n` +
        `Rules are short: no scams, no unsolicited DMs, no seed phrase talk, no spam. Nobody here will ever DM you first. Anyone who does is stealing.\n\n` +
        `Ask me anything about MascotGen with /ask. I'm at the desk.`);
      return ok();
    }

    // --- Moderation commands (admins only)
    if (cmd === "/mute" || cmd === "/unmute" || cmd === "/ban" || cmd === "/warn" || cmd === "/del") {
      if (!(await gIsAdmin(chatId, from.id))) { await gsend(chatId, "Staff only. Nice try."); return ok(); }
      const target = msg.reply_to_message?.from;
      if (!target) { await gsend(chatId, "Reply to the person. I don't guess."); return ok(); }
      const arg = text.split(/\s+/)[1];

      if (cmd === "/mute") {
        const secs = parseDuration(arg);
        await muteUntil(chatId, target.id, secs);
        await gsend(chatId, `${target.first_name} is off the floor for ${arg || "1h"}. The house appreciates the quiet.`);
      } else if (cmd === "/unmute") {
        await unmute(chatId, target.id);
        await gsend(chatId, `${target.first_name} is back. Behave.`);
      } else if (cmd === "/ban") {
        await gapi("banChatMember", { chat_id: chatId, user_id: target.id });
        await gsend(chatId, `${target.first_name}'s account is closed. Permanently.`);
      } else if (cmd === "/warn") {
        await gsend(chatId, `${target.first_name} — that's one. I keep a ledger, and it's very accurate.`);
      } else if (cmd === "/del") {
        await gdel(chatId, msg.reply_to_message.message_id);
        await gdel(chatId, msg.message_id);
      }
      return ok();
    }

    // --- Auto spam defense (skip admins)
    if (text && !(await gIsAdmin(chatId, from.id))) {
      const hit = spamCheck(from.id, text);
      if (hit) {
        await gdel(chatId, msg.message_id);
        if (hit === "scam") {
          await muteUntil(chatId, from.id, 3600);
          await gsend(chatId, `Removed a scam post from ${from.first_name}. Muted an hour.\n\nReminder: nobody from MascotGen will EVER DM you first or ask for a seed phrase. Anyone who does is stealing.`);
        } else if (hit === "flood") {
          await muteUntil(chatId, from.id, 300);
          await gsend(chatId, `${from.first_name}, you're flooding the table. Five minutes.`);
        }
        return ok();
      }
    }

    // --- Q&A
    if (cmd === "/ask" || cmd === "/gravel") {
      const q = text.replace(/^\/(ask|gravel)(@\S+)?\s*/i, "").trim();
      if (!q) { await gsend(chatId, "Ask a question. I don't do small talk."); return ok(); }
      await gapi("sendChatAction", { chat_id: chatId, action: "typing" });
      await gsend(chatId, await askGravel(q), { reply_to_message_id: msg.message_id });
      return ok();
    }
    if (cmd === "/rules") {
      await gsend(chatId, `*HOUSE RULES*\n\n1. Nobody from MascotGen DMs you first. Ever.\n2. Never share a seed phrase. Not with me, not with anyone.\n3. No scam links, no fake airdrops, no "connect your wallet" posts.\n4. No spam, no flooding.\n5. No price predictions or financial advice — including mine. I don't give any.\n\nBreak them and I close your account. I don't warn twice, and I don't take it personally.`);
      return ok();
    }
    if (cmd === "/start" || cmd === "/help") {
      await gsend(chatId, `💀 *GRAVEL* — front desk and floor security.\n\n/ask [question] — anything about MascotGen\n/rules — the house rules\n\nAdmins: /mute (reply, e.g. /mute 30m) · /unmute · /ban · /warn · /del\n\nI answer questions and I keep the floor clean. That's the arrangement.`);
      return ok();
    }

    // --- Direct mentions get an answer too
    const botName = (process.env.GRAVEL_BOT_USERNAME || "").toLowerCase();
    const mentioned = botName && lower.includes(`@${botName}`);
    const replyToBot = msg.reply_to_message?.from?.is_bot && msg.reply_to_message?.from?.username?.toLowerCase() === botName;
    if ((mentioned || replyToBot) && text.length > 3) {
      await gapi("sendChatAction", { chat_id: chatId, action: "typing" });
      const q = text.replace(new RegExp(`@${botName}`, "ig"), "").trim();
      await gsend(chatId, await askGravel(q), { reply_to_message_id: msg.message_id });
      return ok();
    }

    return ok();
  } catch (e) {
    return res.status(200).json({ ok: true });
  }
}


// ---------------------------------------------------------------------------
// ROUTER — picks the bot from ?bot=gravel, falling back to MascotGen.
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  const which = String((req.query && req.query.bot) || "").toLowerCase();
  if (which === "gravel") return gravelBot(req, res);
  return mascotgenBot(req, res);
}
