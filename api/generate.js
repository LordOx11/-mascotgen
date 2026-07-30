// This runs on Vercel's servers, NOT in the browser — your API key stays hidden here.
//
// 🚧 SPEND PROTECTION: this endpoint is the gate to your Anthropic credits, so
// every call is authenticated and metered:
//   - email required (the Studio always sends it)
//   - dev emails: unlimited
//   - active subscribers: 200 generations/day (a sanity ceiling, not a quota
//     users will ever feel — it exists to stop bugs and abusers)
//   - free users: 5 generations/day
// Usage is tracked per-email per-day in the gen_usage table.
// Env vars: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, DEV_EMAILS

const FREE_DAILY = 5;
const PAID_DAILY = 200;

function isDevEmail(email) {
  const list = (process.env.DEV_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes((email || "").toLowerCase());
}

const sbHeaders = {
  "Content-Type": "application/json",
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
};

async function isActiveSubscriber(email) {
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=plan,status`,
      { headers: sbHeaders }
    );
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] && rows[0].status === "active";
  } catch (e) {
    return false;
  }
}

// Counts and increments today's usage. Fails OPEN on database hiccups so a
// Supabase outage never takes the whole studio down.
async function checkAndCountUsage(email, limit) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const key = email.toLowerCase();
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/gen_usage?email=eq.${encodeURIComponent(key)}&day=eq.${day}&select=count`,
      { headers: sbHeaders }
    );
    const rows = await res.json();
    const used = Array.isArray(rows) && rows[0] ? rows[0].count : 0;
    if (used >= limit) return { ok: false, used };
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/gen_usage`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ email: key, day, count: used + 1 }),
    });
    return { ok: true, used: used + 1 };
  } catch (e) {
    return { ok: true, used: 0 };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { prompt, useSearch, email } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }
  if (!email) {
    return res.status(401).json({ error: "Set your email at the top of the Studio first — it's how we track your plan." });
  }

  // ---- The bouncer ---------------------------------------------------------
  if (!isDevEmail(email)) {
    const paid = await isActiveSubscriber(email);
    const limit = paid ? PAID_DAILY : FREE_DAILY;
    const usage = await checkAndCountUsage(email, limit);
    if (!usage.ok) {
      return res.status(402).json({
        error: paid
          ? `Daily generation ceiling reached (${PAID_DAILY}/day) — this limit exists to catch runaway loops. If you hit it legitimately, contact support.`
          : `🔒 Free plan limit reached (${FREE_DAILY} generations/day). Upgrade on the Pricing page for full access — subscriptions include the story engine, art and mints.`,
        needsPlan: !paid,
      });
    }
  }

  // Output budget: long saga chapters (12-16 cinematic fight panels) need far
  // more room than short generations — a low cap truncates the JSON mid-panel.
  // You only pay for tokens actually generated, so a high cap costs nothing
  // on short responses.
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  };
  if (useSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }];
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
