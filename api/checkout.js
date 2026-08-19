// Creates a Stripe Checkout session for the CURRENT plan lineup, and hosts the
// billing portal so subscribers can cancel themselves ("cancel anytime" is a
// promise in our Terms — it needs a real button behind it).
//
// PLAN LINEUP (repriced before launch — see PRICING-CHANGE.md):
//   Starter  $19.99 one-time  — 1 mint, 15 lifetime generations
//   Platinum $49.99 recurring — 3 mints / 30-day cycle, 5 generations/day
//   Elite    $99.99 recurring — 7 mints / 30-day cycle, 10 generations/day
//
// MINTS ARE 1 / 3 / 7 — $20.00 / $16.66 / $14.28 per mint, so climbing a tier
// actually pays. The old 1/5/10 priced Platinum and Elite identically at
// $10/mint, leaving Elite nothing to argue with except features.
//
// WHY THESE NUMBERS: each sits just under a psychological wall ($20 / $50 /
// $100) instead of at an odd figure, and the ladder now climbs 1x / 2.5x / 5x
// instead of 1x / 3x / 7x — which makes Platinum the obvious middle rather
// than an awkward one. Raising prices AFTER launch is close to impossible
// without angering the people who backed you first; fixing them now is free.
//
// EXTRA-MINT PACK — ONE pack: +5 mints, $29.99, requires an ACTIVE ELITE plan.
// Elite only, deliberately: the subscription runs ~$14/mint, so a pack at ~$6
// stays a genuine perk for the top tier rather than a cheaper way around it.
//
// 🎁 THE CREATOR PACK — ONE add-on, $9.99: 10 art generations + 15 story
// generations, bundled. Requires an ACTIVE PLAN (Starter and above), because
// a free account with no plan can't mint anyway and shouldn't be able to buy
// its way into unlimited generations. Both credit types NEVER expire.
//
// Env vars needed in Vercel:
//   STRIPE_SECRET_KEY, SITE_URL,
//   STRIPE_PRICE_STARTER          ($19.99 one-time),
//   STRIPE_PRICE_PLATINUM         ($49.99 recurring),
//   STRIPE_PRICE_ELITE            ($99.99 RECURRING — must be a subscription
//                                  price; the 30-day mint refill in
//                                  open-pack.js assumes recurring billing),
//   STRIPE_PRICE_CREATOR          ($9.99 one-time — 10 art + 15 story credits,
//                                  requires any active plan),
//   STRIPE_PRICE_MINTS5           ($29.99 one-time — +5 mints, Elite only)
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
  // 🔐 SECURITY — FIXED 19 Aug 2026. This used to take a bare email string and
  // hand back a LIVE Stripe billing portal session URL. Anyone who knew or
  // guessed a customer's email — and emails leak constantly — got that person's
  // invoices, billing address, payment-method last4, and the ability to cancel
  // or change their subscription. It was also a clean subscriber-enumeration
  // oracle: 404 meant "not a customer", 200 meant "customer".
  //
  // A wallet signature does NOT fix this. `subscribers` has no wallet column, so
  // there is nothing tying an email to a wallet — any attacker could sign with
  // their own wallet and still pass. The only thing that closes it is PROOF OF
  // CONTROL OF THE EMAIL, and this app has no mailer.
  //
  // So we hand the job to Stripe, which already solves it: the hosted customer
  // portal login page takes the email, emails a link to that address, and only
  // the real inbox owner can follow it. Create it in the Stripe Dashboard
  // (Settings → Billing → Customer portal → enable the login link) and put the
  // URL in STRIPE_PORTAL_LOGIN_URL.
  //
  // FAILS CLOSED. With the env var unset, nobody gets a portal link — including
  // legitimate customers, who are routed to support instead. That is the correct
  // trade while pre-launch: a manual cancellation is an inconvenience, an
  // exposed billing account is a breach.
  if (action === "portal") {
    const loginUrl = (process.env.STRIPE_PORTAL_LOGIN_URL || "").trim();
    if (!loginUrl) {
      console.warn("portal requested but STRIPE_PORTAL_LOGIN_URL is not set — refusing to mint a session URL for an unverified email");
      return res.status(503).json({
        error: "Self-serve billing isn't switched on yet. Email support@mascotgen.studio and we'll sort your subscription out the same day.",
      });
    }
    // Deliberately identical response whether or not that email is a customer —
    // no enumeration oracle. Stripe decides whether an email gets a link.
    return res.status(200).json({ url: loginUrl, viaEmail: true });
  }

  const priceMap = {
    starter: { price: process.env.STRIPE_PRICE_STARTER, mode: "payment" },        // $19.99 one-time — 1 mint, no refill
    platinum: { price: process.env.STRIPE_PRICE_PLATINUM, mode: "subscription" }, // $49.99 — 3 mints per 30-day cycle
    elite: { price: process.env.STRIPE_PRICE_ELITE, mode: "subscription" },       // $99.99 — 7 mints per 30-day cycle
    // 🎁 THE CREATOR PACK — $9.99 for 10 art + 15 story generations, one
    // purchase. Bundling beats two separate packs: it's a single decision
    // instead of two, the person who runs out of art usually needs story soon
    // after, and one add-on keeps the Pricing page from turning into a menu.
    // Requires an active plan — a free account can't mint, so selling it
    // unlimited generations helps nobody. Neither credit type expires.
    creator: {
      price: process.env.STRIPE_PRICE_CREATOR,
      mode: "payment",
      artCredits: 10,
      storyCredits: 15,
      requiresAnyPlan: true,
    },
    // 💎 THE EXTRA-MINT PACK — +5 mints, $29.99, ELITE ONLY. Credits NEVER
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
    // 🎁 The Creator Pack needs SOME active plan — Starter or above.
    if (selected.requiresAnyPlan) {
      const sub = await getSubscriber(email);
      const active = sub && sub.status === "active" && ["starter", "platinum", "elite"].includes(sub.plan);
      if (!active) {
        return res.status(403).json({
          error: "The Creator Pack is for subscribers — grab any plan first (Starter is a one-time $19.99) and it unlocks.",
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: selected.mode,
      customer_email: email,
      line_items: [{ price: selected.price, quantity: 1 }],
      success_url: `${process.env.SITE_URL}/?checkout=success`,
      cancel_url: `${process.env.SITE_URL}/?checkout=cancelled`,
      metadata: (selected.artCredits && selected.storyCredits)
        // 🎁 Creator Pack: BOTH balances in one purchase, so the webhook adds
        // art and story credits from a single completed session.
        ? {
            type: "creator_pack",
            art: String(selected.artCredits),
            story: String(selected.storyCredits),
            email: email.toLowerCase(),
          }
        : selected.artCredits
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
