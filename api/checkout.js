// Creates a Stripe Checkout session for the CURRENT plan lineup, and hosts the
// billing portal so subscribers can cancel themselves ("cancel anytime" is a
// promise in our Terms — it needs a real button behind it).
//
// PLAN LINEUP:
//   Starter  $11 one-time  — 1 mint, 15 lifetime generations
//   Platinum $33 recurring — 5 mints / 30-day cycle, 5 generations/day
//   Elite    $77 recurring — 10 mints / 30-day cycle, 10 generations/day
//
// EXTRA-MINT PACK — ONE pack: +5 mints, $19.99, requires an ACTIVE ELITE
// plan. Elite only, deliberately: at $77 for 10 mints the subscription runs
// ~$7.70/mint, so an open-to-all pack at ~$4/mint would undercut the tier
// it's meant to extend. As an Elite-only perk it adds value instead of
// replacing it.
//
// Env vars needed in Vercel:
//   STRIPE_SECRET_KEY, SITE_URL,
//   STRIPE_PRICE_STARTER          ($11 one-time),
//   STRIPE_PRICE_PLATINUM         ($33 recurring),
//   STRIPE_PRICE_ELITE            ($77 RECURRING — must be a subscription
//                                  price; the 30-day mint refill in
//                                  open-pack.js assumes recurring billing),
//   STRIPE_PRICE_ART10            ($2.99 one-time — 10 art credits),
//   STRIPE_PRICE_MINTS5           ($19.99 one-time — +5 mints, Elite only)
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
    platinum: { price: process.env.STRIPE_PRICE_PLATINUM, mode: "subscription" }, // $33 — 5 mints per 30-day cycle
    elite: { price: process.env.STRIPE_PRICE_ELITE, mode: "subscription" },       // $77 — 10 mints per 30-day cycle
    // Art pack: 10 image generations, $2.99, NEVER expires, any tier — this is
    // the card-on-file rung for people who want the art without the NFT.
    art10: { price: process.env.STRIPE_PRICE_ART10, mode: "payment", artCredits: 10 },
    // 💎 THE EXTRA-MINT PACK — +5 mints, $19.99, ELITE ONLY. Credits NEVER
    // expire (webhook.js writes credits_expire_at as NULL).
    mints5: { price: process.env.STRIPE_PRICE_MINTS5, mode: "payment", credits: 5, requiresPlan: "elite" },
  };

  const selected = priceMap[plan];
  if (!selected || !selected.price) return res.status(400).json({ error: "Unknown plan" });

  try {
    // Mint packs are an Elite perk — verify the buyer actually holds the tier.
    if (selected.requiresPlan) {
      const sub = await getSubscriber(email);
      const active = sub && sub.status === "active";
      if (!active || sub.plan !== selected.requiresPlan) {
        return res.status(403).json({
          error: "Extra-mint packs are an Elite perk — they require an active Elite plan.",
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
