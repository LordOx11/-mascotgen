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
//   starter   → 25 generations, lifetime
//   platinum  → 10 per day
//   elite     → 20 per day
//   dev       → unlimited
//
// WEIGHTING: a 12-16 panel fight scene costs roughly 3x a normal generation in
// output tokens, so it counts as 3. Detected from the prompt itself rather than
// a client-supplied flag, so it can't be spoofed without changing the request.
//
// Usage is tracked per-email per-day in gen_usage; lifetime totals are simply
// the sum of that email's rows, so no schema change is needed.
//
// Env vars: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, DEV_EMAILS

const PLAN_LIMITS = {
  free: { kind: "lifetime", limit: 5 },
  starter: { kind: "lifetime", limit: 25 },
  platinum: { kind: "daily", limit: 10 },
  elite: { kind: "daily", limit: 20 },
  platinum_pass: { kind: "daily", limit: 20 }, // legacy all-access
  pass: { kind: "daily", limit: 20 },
};

const FIGHT_WEIGHT = 3;

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
// Fails OPEN on database errors so a Supabase hiccup never bricks the studio.
async function checkAndCount(email, plan, weight) {
  const rule = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const key = email.toLowerCase();
  const day = new Date().toISOString().slice(0, 10);
  try {
    const query =
      rule.kind === "lifetime"
        ? `gen_usage?email=eq.${encodeURIComponent(key)}&select=day,count`
        : `gen_usage?email=eq.${encodeURIComponent(key)}&day=eq.${day}&select=day,count`;
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${query}`, { headers: sbHeaders });
    const rows = await res.json();
    const list = Array.isArray(rows) ? rows : [];

    // Lifetime = every row this email has ever written. Daily = today's row.
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
    const plan = await getPlan(email);
    const weight = weightOf(prompt);
    const usage = await checkAndCount(email, plan, weight);

    if (!usage.ok) {
      if (usage.kind === "lifetime") {
        return res.status(402).json({
          error:
            plan === "free"
              ? `🔒 You've used all ${usage.limit} of your free generations. Upgrade on the Pricing page to keep creating — plans include the story engine, art, and minting.`
              : `🔒 Your Starter plan's ${usage.limit} generations are used up. Upgrade to Platinum or Elite for a daily allowance.`,
          needsPlan: true,
          used: usage.used,
          limit: usage.limit,
        });
      }
      return res.status(402).json({
        error:
          weight > 1
            ? `You've hit today's limit of ${usage.limit} generations. A full fight scene counts as ${FIGHT_WEIGHT} — try a shorter chapter, or come back tomorrow.`
            : `You've used all ${usage.limit} generations for today. Your allowance resets at midnight UTC.`,
        used: usage.used,
        limit: usage.limit,
      });
    }
  }

  // Output budget: long saga chapters need far more room than short
  // generations — a low cap truncates the JSON mid-panel. You only pay for
  // tokens actually generated, so a high cap costs nothing on short responses.
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
