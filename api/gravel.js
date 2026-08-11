// 💀 GRAVEL — the group's enforcer and front desk.
// Deploy to api/gravel.js. Second bot, separate token from the MascotGen bot.
// Env: GRAVEL_BOT_TOKEN, ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY.
// Voice: Gravel Mortis — blunt, dry, never raises his voice, never explains twice.

const TG = () => `https://api.telegram.org/bot${process.env.GRAVEL_BOT_TOKEN}`;
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

const api = (m, body) =>
  fetch(`${TG()}/${m}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch(() => null);

const send = (chat_id, text, extra = {}) => api("sendMessage", { chat_id, text, parse_mode: "Markdown", ...extra });
const del = (chat_id, message_id) => api("deleteMessage", { chat_id, message_id });
const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function sb(path, options = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}`, ...(options.headers || {}) },
  });
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

async function isAdmin(chat_id, user_id) {
  try {
    const r = await fetch(`${TG()}/getChatMember?chat_id=${chat_id}&user_id=${user_id}`);
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

PLANS: Free ($0 — 5 lifetime AI generations, full battle card, both games, 9 languages, no minting). Starter ($11 one-time — 25 generations, 1 mint, origin story, Story Studio). Platinum ($33 per 30-day cycle — 10 generations/day, 6 mints, elite attributes, Trending Mode, crossover sagas, 3% Legendary odds). Elite ($77 per 30-day cycle — 20 generations/day, 20 mints, all auras, video generation, 7% Legendary odds). Art credit packs and extra mint credits available. Full details on the Pricing page.

THE GAMES: ⚔️ Battle Arena — squads of up to 7 minted mascots fight ghost battles using real card stats, elements and abilities. 🏁 Death Race — combat racing across 8 circuits, weapons live on lap 2, lap-3 wrecks are permanent, Sports Car mascots race in true form with car mods, everyone else drives a Battle Kart. BOTH are free to play with no fees, no wagering, and no limits — but you play with MINTED mascots, so you need at least one mint to enter. Losing NEVER affects your NFT.

RARITY: Rolled on the server at mint — never chosen, never bought. The first 333 mints in MascotGen history are ALL Legendary (the Founding 333), then normal odds begin. Legendary odds after that: Platinum 3%, Elite 7%, with a pity system that climbs with every miss, capped at 33%. Every paid mint carries a 0.01% roll at a remaining god throne.

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
  api("restrictChatMember", {
    chat_id, user_id,
    permissions: { can_send_messages: false, can_send_media_messages: false, can_send_other_messages: false, can_add_web_page_previews: false },
    until_date: Math.floor(Date.now() / 1000) + secs,
  });

const unmute = (chat_id, user_id) =>
  api("restrictChatMember", {
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
export default async function handler(req, res) {
  const ok = () => res.status(200).json({ ok: true });
  if (req.method !== "POST") return res.status(200).send("Gravel is at the desk.");
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
      await send(chatId,
        `${names} — welcome to the house.\n\n` +
        `Rules are short: no scams, no unsolicited DMs, no seed phrase talk, no spam. Nobody here will ever DM you first. Anyone who does is stealing.\n\n` +
        `Ask me anything about MascotGen with /ask. I'm at the desk.`);
      return ok();
    }

    // --- Moderation commands (admins only)
    if (cmd === "/mute" || cmd === "/unmute" || cmd === "/ban" || cmd === "/warn" || cmd === "/del") {
      if (!(await isAdmin(chatId, from.id))) { await send(chatId, "Staff only. Nice try."); return ok(); }
      const target = msg.reply_to_message?.from;
      if (!target) { await send(chatId, "Reply to the person. I don't guess."); return ok(); }
      const arg = text.split(/\s+/)[1];

      if (cmd === "/mute") {
        const secs = parseDuration(arg);
        await muteUntil(chatId, target.id, secs);
        await send(chatId, `${target.first_name} is off the floor for ${arg || "1h"}. The house appreciates the quiet.`);
      } else if (cmd === "/unmute") {
        await unmute(chatId, target.id);
        await send(chatId, `${target.first_name} is back. Behave.`);
      } else if (cmd === "/ban") {
        await api("banChatMember", { chat_id: chatId, user_id: target.id });
        await send(chatId, `${target.first_name}'s account is closed. Permanently.`);
      } else if (cmd === "/warn") {
        await send(chatId, `${target.first_name} — that's one. I keep a ledger, and it's very accurate.`);
      } else if (cmd === "/del") {
        await del(chatId, msg.reply_to_message.message_id);
        await del(chatId, msg.message_id);
      }
      return ok();
    }

    // --- Auto spam defense (skip admins)
    if (text && !(await isAdmin(chatId, from.id))) {
      const hit = spamCheck(from.id, text);
      if (hit) {
        await del(chatId, msg.message_id);
        if (hit === "scam") {
          await muteUntil(chatId, from.id, 3600);
          await send(chatId, `Removed a scam post from ${from.first_name}. Muted an hour.\n\nReminder: nobody from MascotGen will EVER DM you first or ask for a seed phrase. Anyone who does is stealing.`);
        } else if (hit === "flood") {
          await muteUntil(chatId, from.id, 300);
          await send(chatId, `${from.first_name}, you're flooding the table. Five minutes.`);
        }
        return ok();
      }
    }

    // --- Q&A
    if (cmd === "/ask" || cmd === "/gravel") {
      const q = text.replace(/^\/(ask|gravel)(@\S+)?\s*/i, "").trim();
      if (!q) { await send(chatId, "Ask a question. I don't do small talk."); return ok(); }
      await api("sendChatAction", { chat_id: chatId, action: "typing" });
      await send(chatId, await askGravel(q), { reply_to_message_id: msg.message_id });
      return ok();
    }
    if (cmd === "/rules") {
      await send(chatId, `*HOUSE RULES*\n\n1. Nobody from MascotGen DMs you first. Ever.\n2. Never share a seed phrase. Not with me, not with anyone.\n3. No scam links, no fake airdrops, no "connect your wallet" posts.\n4. No spam, no flooding.\n5. No price predictions or financial advice — including mine. I don't give any.\n\nBreak them and I close your account. I don't warn twice, and I don't take it personally.`);
      return ok();
    }
    if (cmd === "/start" || cmd === "/help") {
      await send(chatId, `💀 *GRAVEL* — front desk and floor security.\n\n/ask [question] — anything about MascotGen\n/rules — the house rules\n\nAdmins: /mute (reply, e.g. /mute 30m) · /unmute · /ban · /warn · /del\n\nI answer questions and I keep the floor clean. That's the arrangement.`);
      return ok();
    }

    // --- Direct mentions get an answer too
    const botName = (process.env.GRAVEL_BOT_USERNAME || "").toLowerCase();
    const mentioned = botName && lower.includes(`@${botName}`);
    const replyToBot = msg.reply_to_message?.from?.is_bot && msg.reply_to_message?.from?.username?.toLowerCase() === botName;
    if ((mentioned || replyToBot) && text.length > 3) {
      await api("sendChatAction", { chat_id: chatId, action: "typing" });
      const q = text.replace(new RegExp(`@${botName}`, "ig"), "").trim();
      await send(chatId, await askGravel(q), { reply_to_message_id: msg.message_id });
      return ok();
    }

    return ok();
  } catch (e) {
    return res.status(200).json({ ok: true });
  }
}
