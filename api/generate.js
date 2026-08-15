// This runs on Vercel's servers, NOT in the browser — your API key stays hidden here.
//
// 🚧 SPEND PROTECTION — this endpoint is the gate to your Anthropic credits.
//
// Two shapes of limit, matched to how each plan is PAID:
//   • One-time plans get a LIFETIME bucket. Free ($0) and Starter ($11) are
//     paid once, so an ongoing daily allowance would bleed money forever.
//   • Subscriptions get a DAILY cap — recurring cost against recurring revenue.
//
//   free      →  5 generations, lifetime
//   starter   → 15 generations, lifetime
//   platinum  →  5 per day
//   elite     → 10 per day
//   dev       → unlimited (wallet-signature gated, see below)
//
// WEIGHTING: a 12-16 panel fight scene costs roughly 3x a normal generation in
// output tokens, so it counts as 3. Detected from the prompt itself rather than
// a client-supplied flag, so it can't be spoofed without changing the request.
//
// Usage is tracked per-email per-day in gen_usage; lifetime totals are simply
// the sum of that email's rows, so no schema change is needed.
//
// HARDENING (v2):
//   1. ATOMIC COUNTING. The old read-then-write let N parallel requests all
//      read the same `used` and all pass — the cap was bypassable by clicking
//      fast. consume_generation() now checks and increments under a row lock.
//      Falls back to the legacy path only if the SQL isn't installed yet.
//   2. DEV GATE. Dev bypass was email-only, and an email is guessable — anyone
//      who knew it had unlimited Anthropic spend on your card. Now it also
//      requires an ed25519 wallet signature from a DEV_WALLETS address.
//   3. PROMPT CAP + TIMEOUT. Unbounded prompts and unbounded upstream calls
//      both turn one bad request into a stuck function and a large bill.
//   4. REFUND ON FAILURE. If Anthropic errors, the generation is given back.
//
// Env vars: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY,
//           DEV_EMAILS, DEV_WALLETS

import crypto from "node:crypto";

export const maxDuration = 60;

const PLAN_LIMITS = {
  free: { kind: "lifetime", limit: 5 },
  starter: { kind: "lifetime", limit: 15 },
  platinum: { kind: "daily", limit: 5 },
  elite: { kind: "daily", limit: 10 },
  platinum_pass: { kind: "daily", limit: 10 }, // legacy all-access
  pass: { kind: "daily", limit: 10 },
};

const FIGHT_WEIGHT = 3;
const MAX_PROMPT = 24000; // saga prompts carry the bible + recent canon

function isDevEmail(email) {
  const list = (process.env.DEV_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes((email || "").toLowerCase());
}

// 🔐 Same wallet-signature scheme as battle.js / generate-art.js: the client
// signs `mascotgen-auth:{wallet}:{bucket}` once per 10 minutes. An email is
// guessable; an ed25519 signature is not.
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(str) {
  let n = 0n;
  for (const c of String(str)) {
    const i = B58.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const c of String(str)) { if (c === "1") bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}
function verifyWalletAuth(wallet, auth) {
  try {
    if (!wallet || !auth || !auth.signature || typeof auth.bucket !== "number") return false;
    const now = Math.floor(Date.now() / (10 * 60 * 1000));
    if (auth.bucket !== now && auth.bucket !== now - 1) return false;
    const pub = b58decode(wallet);
    if (!pub || pub.length !== 32) return false;
    const sig = Buffer.from(String(auth.signature), "base64");
    if (sig.length !== 64) return false;
    const msg = Buffer.from(`mascotgen-auth:${wallet}:${auth.bucket}`);
    const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pub)]);
    return crypto.verify(null, msg, crypto.createPublicKey({ key: der, format: "der", type: "spki" }), sig);
  } catch (e) {
    return false;
  }
}
function isDevWallet(wallet) {
  const list = (process.env.DEV_WALLETS || "").split(",").map((w) => w.trim()).filter(Boolean);
  return list.includes((wallet || "").trim());
}

const sbHeaders = {
  "Content-Type": "application/json",
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
};

async function sbRpc(fn, body) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: sbHeaders,
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`rpc ${fn}: ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

// Returns the plan key for this email, or "free" when there's no active plan.
async function getPlan(email) {
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=plan,status`,
      { headers: sbHeaders }
    );
    const rows = await res.json();
    const sub = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (sub && sub.status === "active" && PLAN_LIMITS[sub.plan]) return sub.plan;
    return "free";
  } catch (e) {
    return "free";
  }
}

// A 12-16 panel battle arc costs ~3x a normal generation.
function weightOf(prompt) {
  const p = String(prompt || "");
  if (p.includes("12 to 16 panels") || p.includes("BATTLE ARC")) return FIGHT_WEIGHT;
  return 1;
}

// Checks the relevant bucket and, if there's room, records the spend.
// Prefers the ATOMIC SQL path; falls back to the old read-then-write only when
// consume_generation() isn't installed. Fails OPEN on database errors so a
// Supabase hiccup never bricks the studio.
async function checkAndCount(email, plan, weight) {
  const rule = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const key = email.toLowerCase();
  const day = new Date().toISOString().slice(0, 10);

  try {
    const r = await sbRpc("consume_generation", {
      p_email: key, p_day: day, p_weight: weight,
      p_limit: rule.limit, p_lifetime: rule.kind === "lifetime",
    });
    if (r && typeof r.ok === "boolean") {
      return { ok: r.ok, used: r.used, limit: rule.limit, kind: rule.kind, atomic: true };
    }
  } catch (e) {
    // Function not installed yet — legacy path below.
  }

  try {
    const query =
      rule.kind === "lifetime"
        ? `gen_usage?email=eq.${encodeURIComponent(key)}&select=day,count`
        : `gen_usage?email=eq.${encodeURIComponent(key)}&day=eq.${day}&select=day,count`;
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${query}`, { headers: sbHeaders });
    const rows = await res.json();
    const list = Array.isArray(rows) ? rows : [];

    const used = list.reduce((sum, r) => sum + (r.count || 0), 0);
    const todayRow = list.find((r) => r.day === day);
    const usedToday = todayRow ? todayRow.count || 0 : 0;

    if (used + weight > rule.limit) {
      return { ok: false, used, limit: rule.limit, kind: rule.kind };
    }

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/gen_usage`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ email: key, day, count: usedToday + weight }),
    });
    return { ok: true, used: used + weight, limit: rule.limit, kind: rule.kind };
  } catch (e) {
    return { ok: true, used: 0, limit: rule.limit, kind: rule.kind };
  }
}

// ✍️ STORY CREDITS — from the $9.99 Creator Pack, spent ONLY once the plan
// allowance is gone. Atomic in SQL under a row lock so two parallel chapters can't both
// claim the last credit. Mirrors how art credits overflow the art pool.
async function consumeStoryCredit(email, weight) {
  try {
    const r = await sbRpc("consume_gen_credit", { p_email: email.toLowerCase(), p_amount: weight });
    return !!(r && r.ok);
  } catch (e) {
    return false;   // function not installed yet — behave as if none exist
  }
}
async function refundStoryCredit(email, weight) {
  try {
    await sbRpc("refund_gen_credit", { p_email: email.toLowerCase(), p_amount: weight });
  } catch (e) {}
}

// Give the generation back when the upstream call fails — nobody should lose
// an allowance to our error.
async function refundGeneration(email, weight) {
  try {
    await sbRpc("refund_generation", {
      p_email: email.toLowerCase(),
      p_day: new Date().toISOString().slice(0, 10),
      p_weight: weight,
    });
  } catch (e) {
    console.warn("generation refund failed:", e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { prompt, useSearch, email, wallet, auth } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }
  if (!email) {
    return res.status(401).json({ error: "Set your email at the top of the Studio first — it's how we track your plan." });
  }

  // Dev bypass requires the email AND a verified signature from a dev wallet.
  const dev = isDevEmail(email) && isDevWallet(wallet) && verifyWalletAuth(wallet, auth);

  // ---- The bouncer ---------------------------------------------------------
  let charged = 0;
  let chargedCredit = false;   // ✍️ true when a purchased story credit paid
  if (!dev) {
    const plan = await getPlan(email);
    const weight = weightOf(prompt);
    let usage = await checkAndCount(email, plan, weight);

    // Out of allowance? Try purchased story credits before turning them away.
    // The person hitting this is MID-CHAPTER; a hard stop here loses the sale
    // and interrupts the exact thing they were enjoying.
    let usedStoryCredit = false;
    if (!usage.ok && (await consumeStoryCredit(email, weight))) {
      usedStoryCredit = true;
      usage = { ...usage, ok: true, viaCredit: true };
    }

    if (!usage.ok) {
      if (usage.kind === "lifetime") {
        return res.status(402).json({
          error:
            plan === "free"
              ? `🔒 You've used all ${usage.limit} of your free generations. Upgrade on the Pricing page to keep creating — or grab the Creator Pack ($9.99 — 15 story + 10 art generations) if you just want to finish this chapter.`
              : `🔒 Your Starter plan's ${usage.limit} generations are used up. Grab the Creator Pack ($9.99 — 15 story + 10 art generations) to keep this chapter going, or upgrade to Platinum or Elite for a daily allowance.`,
          needsPlan: true,
          used: usage.used,
          limit: usage.limit,
        });
      }
      return res.status(402).json({
        error:
          weight > 1
            ? `You've hit today's limit of ${usage.limit} generations. A full fight scene counts as ${FIGHT_WEIGHT} — try a shorter chapter, come back tomorrow, or grab the Creator Pack ($9.99).`
            : `You've used all ${usage.limit} generations for today. Your allowance resets at midnight UTC — or grab the Creator Pack ($9.99) to keep going now.`,
        used: usage.used,
        limit: usage.limit,
      });
    }
    charged = weight;
    chargedCredit = usedStoryCredit;
  }

  // Output budget: long saga chapters need far more room than short
  // generations — a low cap truncates the JSON mid-panel. You only pay for
  // tokens actually generated, so a high cap costs nothing on short responses.
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: String(prompt).slice(0, MAX_PROMPT) }],
  };
  if (useSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }];
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await response.json();
    // Upstream refused — hand the allowance back rather than charging for air.
    if (!response.ok && charged) {
      if (chargedCredit) await refundStoryCredit(email, charged);
      else await refundGeneration(email, charged);
    }
    return res.status(response.status).json(data);
  } catch (err) {
    if (charged) {
      if (chargedCredit) await refundStoryCredit(email, charged);
      else await refundGeneration(email, charged);
    }
    const aborted = err && (err.name === "AbortError" || /abort/i.test(String(err.message)));
    return res.status(aborted ? 504 : 500).json({
      error: aborted
        ? "The story engine took too long to answer — no generation was used. Try again."
        : err.message || "Server error",
    });
  } finally {
    clearTimeout(timer);
  }
}
