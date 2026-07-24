// Stripe calls this endpoint when subscriptions are created/updated/cancelled.
// It records the subscriber's email + plan + status in Supabase.
// Env vars needed: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY
//
// Supabase table to create (SQL editor):
//   create table subscribers (
//     email text primary key,
//     plan text not null,
//     status text not null,
//     stripe_customer text,
//     updated_at timestamptz default now()
//   );

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: { bodyParser: false }, // Stripe needs the raw body to verify signatures
};

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function upsertSubscriber({ email, plan, status, customer }) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/subscribers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      email: email.toLowerCase(),
      plan,
      status,
      stripe_customer: customer,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Supabase upsert failed: ${await res.text()}`);
}

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
      await upsertSubscriber({
        email: session.customer_details?.email || session.customer_email,
        plan: session.metadata?.plan || "starter",
        status: "active",
        customer: session.customer,
      });
    }

    if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const customer = await stripe.customers.retrieve(sub.customer);
      const active = sub.status === "active" || sub.status === "trialing";
      await upsertSubscriber({
        email: customer.email,
        plan: sub.items?.data?.[0]?.price?.id === process.env.STRIPE_PRICE_PLATINUM ? "platinum" : "starter",
        status: active ? "active" : "inactive",
        customer: sub.customer,
      });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
