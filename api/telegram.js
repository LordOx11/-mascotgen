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
  "gn 🌙 Aurelia watches the night shift from throne #12. allegedly.",
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
  "the only rug in the Pentaverse is in Aurelia's throne room, and it's gorgeous.",
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
  "📜 *LORE:* the world says 11 gods. The thrones say 12. Aurelia the Eternal Bull sits on #12, and everyone who's seen it stops talking about it.",
  "📜 *LORE:* Vraxon the Unbothered rules Abyssia. Entire wars have been fought to get his attention. None succeeded. Unbothered.",
  "📜 *LORE:* cards minted before the Pentaverse was revealed carry NO universe. Genesis Era — older than the star itself. No more can ever exist.",
  "📜 *LORE:* the barrier holds for 777,777,777 more years. The prophecy says assemble the Champions and the angels before it falls. That's what the mint counter is actually counting.",
  "📜 *LORE:* at mint #66,666 the void answers — 666 demons, 666 HP each. What fell with Toro did not all stay down.",
  "📜 *LORE:* the Graveyard deletes no one. Thirty silent days and you drift out of the living realm — one battle brings you back wearing the mark of your return.",
];
const PROPHECIES = [
  "🔮 the wheel within the wheel still turns. rims crowded with eyes. it remembers who aimed it.",
  "🔮 heaven is rarer than hell — 1,111 will descend the waterfall, and hell sent 666 first.",
  "🔮 the visitor in the oldest layer of the prophecy has no description. that is the description.",
  "🔮 three thrones stay hungry. every paid mint is a knock on their door. 0.01% answer rate.",
  "🔮 when the top 33 are raised at mint #10,000, check the leaderboard. the Champions were always going to be YOU or your rivals.",
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
    return send(chatId, pick(["vaulted. 🏦 this meme is now canon.", "saved. future generations will study this.", "in the vault. Aurelia approves."]));
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
export default async function handler(req, res) {
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
