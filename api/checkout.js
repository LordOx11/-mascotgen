// Creates a Stripe Checkout session for a chosen plan.
// Set STRIPE_SECRET_KEY, STRIPE_PRICE_STARTER, STRIPE_PRICE_PLATINUM in Vercel env vars.
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { plan, email } = req.body || {};
  const priceMap = {
    starter: { price: process.env.STRIPE_PRICE_STARTER, mode: "subscription" }, // $11/mo — 11 generations, renews
    pass: { price: process.env.STRIPE_PRICE_PASS, mode: "payment" }, // $11 one-time — 11 generations for 30 days, no renewal
    platinum_pass: { price: process.env.STRIPE_PRICE_PLATINUM_PASS, mode: "payment" }, // $44 one-time — everything unlocked for 30 days, no renewal
    platinum: { price: process.env.STRIPE_PRICE_PLATINUM, mode: "subscription" }, // $33/mo — unlimited + NFT mint discount
    art_credits_10: { price: process.env.STRIPE_PRICE_ART_CREDITS_10, mode: "payment", credits: 10 }, // $5 one-time — 10 art generations
    art_credits_10_platinum: { price: process.env.STRIPE_PRICE_ART_CREDITS_10_PLATINUM, mode: "payment", credits: 10 }, // $3 one-time — Platinum discount price
  };
  const selected = priceMap[plan];
  if (!selected || !selected.price) return res.status(400).json({ error: "Unknown plan" });
  if (!email) return res.status(400).json({ error: "Email is required to track credits/subscription" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: selected.mode,
      customer_email: email,
      line_items: [{ price: selected.price, quantity: 1 }],
      success_url: `${process.env.SITE_URL}/?checkout=success`,
      cancel_url: `${process.env.SITE_URL}/?checkout=cancelled`,
      metadata: selected.credits
        ? { type: "credits", amount: String(selected.credits) }
        : { type: "plan", plan },
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
