// Portable canon — story chapters that travel WITH the NFT.
// POST action:"get": fetch all chapters for a list of mint addresses.
// POST action:"add": append a chapter to a mint's canon.
// POST action:"update-chapter": replace a chapter's panels (matched by title).
// POST action:"delete-chapter": permanently remove a chapter (matched by title).
// Option C rules: original-creator chapters (is_original) are permanent; current
// owners add their own chapters on top.
//
// 🔐 SECURITY — FIXED 19 Aug 2026. This file previously had NO AUTHENTICATION OF
// ANY KIND. The only check was `req.method !== "POST"`. That meant anyone with
// curl could:
//   · delete-chapter    — permanently destroy ANY chapter on ANY mint. The
//                         comment below is explicit that these edits are the
//                         ones Sync Wallet can never resurrect.
//   · update-chapter    — rewrite anyone's panels
//   · add               — forge a chapter, and set `author_wallet` and
//                         `is_original` to whatever they liked, claiming
//                         permanent original authorship of someone else's NFT
//   · get               — bulk-read 200 mints per call, which supplies the
//                         enumeration list needed to wipe the rest
// All of it executed with the SERVICE KEY. The old comment said ownership was
// "asserted by the client's connected wallet for now (pre-launch)" — in fact it
// was not asserted at all; the wallet was simply a string in the body.
//
// Now every WRITE requires the same ed25519 wallet signature battle.js uses, and
// author_wallet is taken from the VERIFIED signer, never from the request body.
// `get` stays open: chapters are published reading material and are meant to be
// public.
import crypto from "node:crypto";

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(str) {
  let n = 0n;
  for (const c of String(str)) {
    const i = B58_ALPHABET.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const c of String(str)) { if (c === "1") bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}

const AUTH_WINDOW_MS = 10 * 60 * 1000;
function verifyWalletAuth(wallet, auth) {
  try {
    if (!wallet || !auth || !auth.signature || typeof auth.bucket !== "number") return false;
    const nowBucket = Math.floor(Date.now() / AUTH_WINDOW_MS);
    if (auth.bucket !== nowBucket && auth.bucket !== nowBucket - 1) return false;
    const pub = b58decode(wallet);
    if (!pub || pub.length !== 32) return false;
    const sig = Buffer.from(String(auth.signature), "base64");
    if (sig.length !== 64) return false;
    const msg = Buffer.from(`mascotgen-auth:${wallet}:${auth.bucket}`);
    const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pub)]);
    const key = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
    return crypto.verify(null, msg, key, sig);
  } catch (e) {
    return false;
  }
}

// NOTE: deliberately NO WALLET_AUTH_OPTIONAL escape hatch here. battle.js has
// one for rollout; this file is new to auth and there is no legacy client to
// support, so it fails closed with no way to switch it off by env var.
function signer(req) {
  const { wallet, auth } = req.body || {};
  return verifyWalletAuth(wallet, auth) ? String(wallet).trim() : null;
}

// Same allowlist that guards the god queue and Verse News. Fails CLOSED.
function isOwnerWallet(wallet) {
  const list = (process.env.DEV_WALLETS || "").split(",").map((w) => w.trim()).filter(Boolean);
  if (!list.length) return false;
  return list.includes(String(wallet || "").trim());
}

const sbHeaders = {
  "Content-Type": "application/json",
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
};

const AUTH_ERR = "This action requires a wallet signature. Refresh the page and approve the signature prompt when it appears.";

// A signature proves WHO is writing. This proves WHAT they may write to.
// Returns null when allowed, or an {status, error} to send back.
// Applied to add, update-chapter AND delete-chapter: without it on the edit
// paths, someone who authored a chapter and then SOLD the NFT could still
// rewrite or delete it forever on a mascot they no longer own.
async function requireMintOwner(mintAddress, who) {
  const r = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/mints?mint_address=eq.${encodeURIComponent(mintAddress)}&select=owner_wallet`,
    { headers: sbHeaders }
  );
  const rows = r.ok ? await r.json().catch(() => []) : [];
  const owner = Array.isArray(rows) && rows[0] ? rows[0].owner_wallet : null;
  if (!owner) {
    return { status: 403, error: "This mascot has no recorded owner yet — hit Sync Wallet first, then write." };
  }
  if (owner !== who && !isOwnerWallet(who)) {
    return { status: 403, error: "You don't own this mascot." };
  }
  return null;
}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { action } = req.body || {};
  try {
    if (action === "get") {
      const { mints } = req.body;
      if (!Array.isArray(mints) || mints.length === 0) {
        return res.status(400).json({ error: "Send { action:'get', mints: [addresses] }" });
      }
      // Base58 charset enforced. A mint string containing a double quote used to
      // break out of its quoted item inside the in.(…) list.
      const list = mints
        .slice(0, 200)
        .filter((m) => typeof m === "string" && m.length > 20 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(m));
      // An empty list would build `in.()`, which PostgREST rejects — and the
      // client swallows the 500, so the whole batch silently loads no canon.
      if (!list.length) return res.status(200).json({ entries: [] });
      const filter = `(${list.map((m) => `"${m}"`).join(",")})`;
      const r = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/canon_entries?mint_address=in.${encodeURIComponent(filter)}&select=*&order=created_at.asc`,
        { headers: sbHeaders }
      );
      if (!r.ok) throw new Error(await r.text());
      const rows = await r.json();
      return res.status(200).json({ entries: rows });
    }
    if (action === "add") {
      const who = signer(req);
      if (!who) return res.status(401).json({ error: AUTH_ERR });
      const { mintAddress, title, panels, isOriginal } = req.body;
      if (!mintAddress || !Array.isArray(panels) || panels.length === 0) {
        return res.status(400).json({ error: "Need mintAddress and panels[]" });
      }
      // 🔐 OWNERSHIP. A signature only proves WHO is writing, never WHAT they
      // may write to. Without this check any wallet could sign for itself (free,
      // instant) and plant a chapter on someone else's mint — and because
      // delete-chapter is scoped to author_wallet, the victim could not remove
      // it. Worse, planting a row with the victim's own chapter title makes
      // their deleted chapter RESURRECT on the next Sync Wallet, which is the
      // exact thing the permanent-edit actions exist to prevent.
      // Same check battle.js already does on chapter-publish. Fails closed on a
      // missing owner_wallet.
      const denied = await requireMintOwner(mintAddress, who);
      if (denied) return res.status(denied.status).json({ error: denied.error });
      // is_original marks a chapter PERMANENT. It used to be a client boolean,
      // so anyone could plant an undeletable chapter on anyone's NFT. It is now
      // only honoured for the studio allowlist; everyone else writes normal
      // chapters they can still edit and remove.
      const original = !!isOriginal && isOwnerWallet(who);
      const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/canon_entries`, {
        method: "POST",
        headers: { ...sbHeaders, Prefer: "return=representation" },
        body: JSON.stringify([
          {
            mint_address: mintAddress,
            // The VERIFIED signer, never req.body.authorWallet.
            author_wallet: who,
            title: title || null,
            panels,
            is_original: original,
          },
        ]),
      });
      if (!r.ok) throw new Error(await r.text());
      const rows = await r.json();
      return res.status(200).json({ entry: rows[0] });
    }
    // ---- Permanent edits: the Studio's delete button calls these so a
    // removed panel/chapter can never be resurrected by Sync Wallet. ---------
    if (action === "update-chapter") {
      const who = signer(req);
      if (!who) return res.status(401).json({ error: AUTH_ERR });
      const { mintAddress, title, panels } = req.body;
      if (!mintAddress || !title || !Array.isArray(panels)) {
        return res.status(400).json({ error: "Need mintAddress, title and panels[]" });
      }
      const deniedU = await requireMintOwner(mintAddress, who);
      if (deniedU) return res.status(deniedU.status).json({ error: deniedU.error });
      // Scoped to rows this wallet actually wrote. The studio can edit anything;
      // everyone else only their own. Postgrest ANDs the filters, so a row
      // belonging to someone else simply is not matched and `updated` comes
      // back 0 — no error, no information about what exists.
      const ownFilter = isOwnerWallet(who) ? "" : `&author_wallet=eq.${encodeURIComponent(who)}`;
      const r = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/canon_entries?mint_address=eq.${encodeURIComponent(mintAddress)}&title=eq.${encodeURIComponent(title)}${ownFilter}`,
        {
          method: "PATCH",
          headers: { ...sbHeaders, Prefer: "return=representation" },
          body: JSON.stringify({ panels }),
        }
      );
      if (!r.ok) throw new Error(await r.text());
      const rows = await r.json();
      return res.status(200).json({ updated: rows.length });
    }
    if (action === "delete-chapter") {
      const who = signer(req);
      if (!who) return res.status(401).json({ error: AUTH_ERR });
      const { mintAddress, title } = req.body;
      if (!mintAddress || !title) {
        return res.status(400).json({ error: "Need mintAddress and title" });
      }
      const deniedD = await requireMintOwner(mintAddress, who);
      if (deniedD) return res.status(deniedD.status).json({ error: deniedD.error });
      // Non-studio callers can only delete their OWN chapters, and never an
      // is_original one — those are permanent by design, which is the whole
      // point of the flag.
      const guard = isOwnerWallet(who)
        ? ""
        : `&author_wallet=eq.${encodeURIComponent(who)}&is_original=is.false`;
      const r = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/canon_entries?mint_address=eq.${encodeURIComponent(mintAddress)}&title=eq.${encodeURIComponent(title)}${guard}`,
        { method: "DELETE", headers: { ...sbHeaders, Prefer: "return=representation" } }
      );
      if (!r.ok) throw new Error(await r.text());
      const rows = await r.json();
      return res.status(200).json({ deleted: rows.length });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
