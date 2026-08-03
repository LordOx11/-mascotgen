// Creates a Stripe Checkout session for the CURRENT plan lineup, and hosts the
// billing portal so subscribers can cancel themselves ("cancel anytime" is a
// promise in our Terms — it needs a real button behind it).
//
// Env vars needed in Vercel:
//   STRIPE_SECRET_KEY, SITE_URL,
//   STRIPE_PRICE_STARTER           ($11 one-time),
//   STRIPE_PRICE_PLATINUM          ($33 recurring),
//   STRIPE_PRICE_ELITE             ($77 RECURRING — must be a subscription
//                                   price; the 30-day mint refill in
//                                   open-pack.js assumes recurring billing),
//   STRIPE_PRICE_CREDITS5_PLATINUM ($10 one-time — 5 mint credits),
//   STRIPE_PRICE_CREDITS5_ELITE    ($7.50 one-time — 5 mint credits)
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" });

async function getSubscriber(email) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=plan,status`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { plan, email, action } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required to track your plan and credits" });

  // ---- action: "portal" — self-serve manage & cancel -----------------------
  // Folded in here rather than as its own file to stay under Vercel's
  // serverless function limit.
  if (action === "portal") {
    try {
      const customers = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
      const customer = customers.data[0];
      if (!customer) {
        return res.status(404).json({ error: "No billing account found for that email." });
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: customer.id,
        return_url: `${process.env.SITE_URL}/?portal=done`,
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const priceMap = {
    starter: { price: process.env.STRIPE_PRICE_STARTER, mode: "payment" },        // $11 one-time — 1 mint, no refill
    platinum: { price: process.env.STRIPE_PRICE_PLATINUM, mode: "subscription" }, // $33 — 6 mints per 30-day cycle
    elite: { price: process.env.STRIPE_PRICE_ELITE, mode: "subscription" },       // $77 — 20 mints per 30-day cycle
    // Art pack: 10 image generations, $2.99, NEVER expires, any tier — this is
    // the card-on-file rung for people who want the art without the NFT.
    art10: { price: process.env.STRIPE_PRICE_ART10, mode: "payment", artCredits: 10 },
    // Mint-credit packs of 5. Credits EXPIRE at the end of the purchase month.
    credits5_platinum: { price: process.env.STRIPE_PRICE_CREDITS5_PLATINUM, mode: "payment", credits: 5, requiresPlan: "platinum" }, // $10
    credits5_elite: { price: process.env.STRIPE_PRICE_CREDITS5_ELITE, mode: "payment", credits: 5, requiresPlan: "elite" },          // $7.50
  };

  const selected = priceMap[plan];
  if (!selected || !selected.price) return res.status(400).json({ error: "Unknown plan" });

  try {
    // Credit packs are tier-priced — verify the buyer actually holds that tier.
    if (selected.requiresPlan) {
      const sub = await getSubscriber(email);
      const active = sub && sub.status === "active";
      if (!active || sub.plan !== selected.requiresPlan) {
        return res.status(403).json({
          error: `Mint credits at this price require an active ${selected.requiresPlan} plan.`,
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: selected.mode,
      customer_email: email,
      line_items: [{ price: selected.price, quantity: 1 }],
      success_url: `${process.env.SITE_URL}/?checkout=success`,
      cancel_url: `${process.env.SITE_URL}/?checkout=cancelled`,
      metadata: selected.artCredits
        ? { type: "art_credits", amount: String(selected.artCredits), email: email.toLowerCase() }
        : selected.credits
        ? { type: "mint_credits", amount: String(selected.credits), email: email.toLowerCase(), plan }
        : { type: "plan", plan, email: email.toLowerCase() },
      // Subscriptions carry the plan on the subscription itself, so renewal
      // invoices can be attributed without re-reading the checkout session.
      ...(selected.mode === "subscription"
        ? { subscription_data: { metadata: { type: "plan", plan, email: email.toLowerCase() } } }
        : {}),
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
