// Stripe calls this endpoint on checkout + subscription events.
// Records plan/status/mint-credits in Supabase. Mint credits EXPIRE at the end
// of the calendar month they were purchased in.
//
// BOTH Platinum ($33) and Elite ($77) are recurring subscriptions — every
// handler below derives the plan from metadata instead of assuming platinum,
// so renewals and cancellations attribute to the right plan.
// Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" });

export const config = {
  api: { bodyParser: false }, // Stripe needs the raw body to verify signatures
};

const RECURRING_PLANS = ["platinum", "elite"];

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const sbHeaders = {
  "Content-Type": "application/json",
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
};

async function getSubscriber(email) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`,
    { headers: sbHeaders }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function upsert(fields) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/subscribers`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase upsert failed: ${await res.text()}`);
}

// End of the CURRENT calendar month (UTC) — when purchased credits expire.
function endOfMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

const thirtyDays = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let event;
  try {
    const body = await rawBody(req);
    event = stripe.webhooks.constructEvent(body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = (session.customer_details?.email || session.customer_email || "").toLowerCase();
      if (!email) return res.status(200).json({ received: true });

      if (session.metadata?.type === "mint_credits") {
        // Credits stack within the month, but ALWAYS expire at month's end.
        const existing = await getSubscriber(email);
        const stillValid =
          existing?.credits_expire_at && new Date(existing.credits_expire_at) > new Date();
        const base = stillValid ? existing.mint_credits || 0 : 0; // expired credits don't carry
        await upsert({
          email,
          plan: existing?.plan || "free",
          status: existing?.status || "none",
          stripe_customer: session.customer || existing?.stripe_customer,
          mint_credits: base + parseInt(session.metadata.amount || "0", 10),
          credits_expire_at: endOfMonth(),
        });
      } else {
        // Plan purchase: starter ($11 once), platinum ($33 rec.), elite ($77 rec.).
        const plan = session.metadata?.plan || "starter";
        const existing = await getSubscriber(email);
        await upsert({
          email,
          plan,
          status: "active",
          stripe_customer: session.customer || existing?.stripe_customer,
          // Fresh purchase starts a fresh mint allowance. Recurring plans get
          // their 30-day refill window stamped immediately.
          mints_used: 0,
          mints_reset_at: RECURRING_PLANS.includes(plan) ? thirtyDays() : null,
        });
      }
    }

    // Subscription renewals: reset the cycle's mint counter for WHICHEVER
    // recurring plan renewed. The plan travels on the subscription's metadata
    // (set by checkout.js); existing-subscriber plan is the fallback.
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      if (invoice.billing_reason === "subscription_cycle") {
        const customer = await stripe.customers.retrieve(invoice.customer);
        if (customer.email) {
          const email = customer.email.toLowerCase();
          let plan = null;
          try {
            if (invoice.subscription) {
              const sub = await stripe.subscriptions.retrieve(invoice.subscription);
              plan = sub.metadata?.plan || null;
            }
          } catch (e) {}
          if (!RECURRING_PLANS.includes(plan)) {
            const existing = await getSubscriber(email);
            plan = RECURRING_PLANS.includes(existing?.plan) ? existing.plan : "platinum";
          }
          await upsert({
            email,
            plan,
            status: "active",
            stripe_customer: invoice.customer,
            mints_used: 0,
            mints_reset_at: thirtyDays(),
          });
        }
      }
    }

    // Cancellation / status change — applies to ANY recurring plan. One-time
    // plans (starter) are never touched here.
    if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const customer = await stripe.customers.retrieve(sub.customer);
      const active = sub.status === "active" || sub.status === "trialing";
      if (customer.email) {
        const email = customer.email.toLowerCase();
        const existing = await getSubscriber(email);
        const subPlan = RECURRING_PLANS.includes(sub.metadata?.plan)
          ? sub.metadata.plan
          : RECURRING_PLANS.includes(existing?.plan)
          ? existing.plan
          : null;
        if (subPlan) {
          await upsert({
            email,
            plan: active ? subPlan : "free",
            status: active ? "active" : "inactive",
            stripe_customer: sub.customer,
          });
        }
        // subPlan null = this event is about something we don't track (or a
        // one-time buyer with no subscription) — leave their record alone.
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
