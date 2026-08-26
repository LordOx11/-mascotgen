// mint.js — turns a saved MascotGen character into a real Solana NFT.
//
// What this does, in order:
//   1. Fetches the character's generated art (currently a temporary fal.ai link)
//   2. Uploads that image to Arweave via Irys — this is what makes it PERMANENT
//   3. Builds metadata (name, description, traits) and uploads that too
//   4. Mints an NFT pointing at that permanent metadata, straight to the
//      connected wallet — the wallet signs and pays the (small) network fee
//
// GATEWAY NOTE (the "my pictures disappeared" fix): Irys uploads return
// https://arweave.net/<id> URIs, but items are reliably served from
// https://gateway.irys.xyz/<id> — arweave.net can 404 on them. Every URI we
// bake into an NFT is therefore rewritten to the Irys gateway.
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  mplTokenMetadata,
  createNft,
  fetchDigitalAsset,
  updateV1,
  verifyCollectionV1,
  findMetadataPda,
  collectionToggle,
  burnV1,
  delegateCollectionV1,
  revokeCollectionV1,
  TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata";
import { some } from "@metaplex-foundation/umi";
import {
  generateSigner,
  percentAmount,
  createGenericFile,
  publicKey,
} from "@metaplex-foundation/umi";
import { computeStats, statsToAttributes, AGE_CARDS } from "./stats.js";

// ---- CREATOR ROYALTY -------------------------------------------------------
const ROYALTY_PERCENT = 5;

// ---- THE COLLECTION --------------------------------------------------------
export const COLLECTION_ADDRESS = "8W6DwZ4gLgxBhegqrGKA4Aq1WDmRYx2qB9gepTgHqw9r"; // 🏛 MascotGen — The Pentaverse

const toGateway = (u) => (u || "").replace("https://arweave.net/", "https://gateway.irys.xyz/");

/**
 * Strips the NUL padding Token Metadata writes into on-chain strings.
 *
 * The Rust program puffs `name` to 32 chars, `symbol` to 10 and `uri` to 200 by
 * appending U+0000, so accounts have a fixed length for memcmp filters. Those
 * NULs come back when you read the account — and `.trim()` does NOT remove
 * them, because U+0000 is a C0 control character, not whitespace. So a value
 * that LOOKS identical to a string you compare it against can still fail ===,
 * producing an error message where both sides read the same. Anything that
 * compares an on-chain string to a known value must go through this first.
 */
const NUL = String.fromCharCode(0); // built, not typed — a literal NUL in source is invisible and easy to lose in an edit
const unpad = (s) => String(s == null ? "" : s).split(NUL).join("").trim();

async function verifyUri(u) {
  try {
    const r = await fetch("/api/battle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify-uri", urls: [u] }),
    });
    if (r.ok) {
      const data = await r.json();
      return !!data.ok;
    }
  } catch (e) {}
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (r.ok) return true;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

// ---- IRYS UPLOAD HARDENING -------------------------------------------------
// Putting art on Arweave via Irys is really two steps: FUNDING (a tiny SOL
// transfer that buys storage credit, only needed once a file is big enough to
// cost anything) and the UPLOAD itself. Funding is the fragile one. Irys's
// bundler asks a Solana RPC node whether the funding transaction confirmed,
// and a node that hasn't caught up yet answers "Confirmed tx not found" — a
// 400 — even though the SOL already left the wallet and the credit is sitting
// there waiting. Untreated, a public minter sees a frightening failure on a
// step that actually succeeded, and pays a second time on the next attempt.
//
// Character art from fal is 1–2MB, so EVERY public mint walks this path. The
// helpers below make it boring:
//   • Read the Irys balance first — credit stranded by an earlier failure gets
//     spent instead of bought twice.
//   • Fund with ~50% headroom so price drift never forces a second funding.
//   • Treat a funding error as UNCONFIRMED, not failed: wait, re-read the
//     balance, and continue if the money actually landed.
//   • Retry the upload itself on transient bundler/network errors.
//   • Never retry a wallet rejection or a genuinely empty wallet — those are
//     real answers, surfaced immediately.
//
// The art is uploaded at FULL RESOLUTION on purpose. It is the permanent image
// of a 1-of-1 NFT; shrinking it to dodge a funding fee would be trading the
// thing being sold for a few thousand lamports.
//
// Safety property preserved throughout: both uploads are verified before any
// SOL is spent minting the NFT, so the worst outcome is still "try again".
const IRYS_FUND_ATTEMPTS = 3;
const IRYS_UPLOAD_ATTEMPTS = 3;
const IRYS_CONFIRM_POLLS = 8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errText = (e) => String((e && (e.message || e.toString())) || e || "");

// The wallet said no, or there is genuinely nothing in it. Never retry these.
const isHardStop = (e) => {
  const m = errText(e);
  return /user rejected|user denied|rejected the request|request rejected|declined|cancell?ed|insufficient (lamports|funds|balance)|attempt to debit an account/i.test(m);
};

// Almost certainly a propagation/availability hiccup rather than a real "no".
const isTransient = (e) => {
  const m = errText(e);
  return /confirmed tx not found|tx not found|not found on chain|block ?height exceeded|timed? ?out|timeout|econnreset|etimedout|network ?error|failed to fetch|fetch failed|rate ?limit|too many requests|429|50[234]|bad gateway|service unavailable|temporar/i.test(m);
};

function storageError(e) {
  return new Error(
    "Permanent storage wouldn't accept the upload after several tries. Nothing was minted and NO SOL was spent on the NFT — any storage credit already paid for is still yours and will be used automatically on the next attempt. Wait a minute and try again. (Details: " +
      errText(e).slice(0, 220) +
      ")"
  );
}

async function irysBalance(umi) {
  try {
    return await umi.uploader.getBalance();
  } catch (e) {
    return null;
  }
}

/**
 * Makes sure the Irys node holds enough credit for `bytes` before we try to
 * upload them. Returns quietly when the upload is free, when existing credit
 * already covers it, or when the installed uploader plugin doesn't expose the
 * funding API (older versions self-fund inside upload(), which still works —
 * it's just the unhardened path).
 */
async function ensureIrysFunds(umi, bytes, progress) {
  const up = umi.uploader;
  const say = (m) => progress && progress(m);
  if (
    typeof up.getUploadPriceFromBytes !== "function" ||
    typeof up.getBalance !== "function" ||
    typeof up.fund !== "function"
  ) {
    return; // plugin without the funding API — let upload() handle it
  }

  let price = null;
  try {
    price = await up.getUploadPriceFromBytes(Number(bytes) || 0);
  } catch (e) {
    return; // can't price it — fall through and let upload() self-fund
  }
  if (!price || price.basisPoints === undefined || price.basisPoints === null) return;

  const needed = BigInt(price.basisPoints);
  if (needed <= 0n) return; // under Irys's free threshold — no funding at all

  const covered = async () => {
    const b = await irysBalance(umi);
    return !!b && BigInt(b.basisPoints) >= needed;
  };
  // Credit left over from a previous run (including one that "failed" only
  // because its funding tx couldn't be confirmed) pays for this upload.
  if (await covered()) return;

  for (let attempt = 1; attempt <= IRYS_FUND_ATTEMPTS; attempt++) {
    // Fund the FULL price plus ~50% headroom rather than the exact shortfall:
    // the uploader subtracts the existing balance itself, and overshooting by
    // a fraction of a cent just leaves reusable credit, while undershooting
    // costs another round trip.
    const target = (needed * 3n) / 2n + 10000n;
    try {
      say(attempt === 1 ? "Reserving permanent storage..." : `Reserving permanent storage (attempt ${attempt})...`);
      await up.fund({ ...price, basisPoints: target }, false);
      if (await covered()) return;
    } catch (e) {
      if (isHardStop(e)) throw e;
      if (!isTransient(e) && attempt >= IRYS_FUND_ATTEMPTS) throw storageError(e);
    }
    // Either fund() threw an unconfirmed-looking error or the balance hasn't
    // updated yet. Both look identical from here, and both are usually just
    // the network catching up — so wait it out before spending again.
    say("Waiting for the storage payment to confirm...");
    for (let i = 0; i < IRYS_CONFIRM_POLLS; i++) {
      await sleep(2500);
      if (await covered()) return;
    }
  }
  throw storageError("storage credit never confirmed");
}

/** Uploads files with funding pre-checked and transient failures retried. */
async function irysUpload(umi, files, bytes, progress) {
  const say = (m) => progress && progress(m);
  let lastErr = null;
  for (let attempt = 1; attempt <= IRYS_UPLOAD_ATTEMPTS; attempt++) {
    try {
      await ensureIrysFunds(umi, bytes, progress);
      const [uri] = await umi.uploader.upload(files);
      if (uri) return uri;
      lastErr = new Error("uploader returned no URI");
    } catch (e) {
      if (isHardStop(e)) throw e;
      lastErr = e;
    }
    if (attempt < IRYS_UPLOAD_ATTEMPTS) {
      say(`Storage was busy — retrying (${attempt} of ${IRYS_UPLOAD_ATTEMPTS - 1})...`);
      await sleep(2000 * attempt);
    }
  }
  throw storageError(lastErr);
}

/** Same hardening, for the metadata JSON. */
async function irysUploadJson(umi, json, progress) {
  const say = (m) => progress && progress(m);
  let bytes = 0;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(json)).length;
  } catch (e) {}
  let lastErr = null;
  for (let attempt = 1; attempt <= IRYS_UPLOAD_ATTEMPTS; attempt++) {
    try {
      await ensureIrysFunds(umi, bytes, progress);
      const uri = await umi.uploader.uploadJson(json);
      if (uri) return uri;
      lastErr = new Error("uploader returned no URI");
    } catch (e) {
      if (isHardStop(e)) throw e;
      lastErr = e;
    }
    if (attempt < IRYS_UPLOAD_ATTEMPTS) {
      say(`Storage was busy — retrying (${attempt} of ${IRYS_UPLOAD_ATTEMPTS - 1})...`);
      await sleep(2000 * attempt);
    }
  }
  throw storageError(lastErr);
}

function makeUmi(wallet, rpcEndpoint) {
  return createUmi(rpcEndpoint)
    .use(walletAdapterIdentity(wallet))
    .use(mplTokenMetadata())
    .use(
      irysUploader({
        address: "https://uploader.irys.xyz",
      })
    );
}

/**
 * Mints a character as an NFT.
 * pendingMint must contain { id, tier } and may carry { markedBy, markNumber }
 * — the ✋ God-Mark rolled server-side at pack-open. The mark is baked into
 * the NFT's permanent attributes here and can never be added afterward.
 */
export async function mintCharacterNFT({ entry, pendingMint, wallet, rpcEndpoint, onProgress, auth }) {
  if (!wallet || !wallet.connected) {
    throw new Error("Connect your wallet first.");
  }
  if (!entry.artUrl) {
    throw new Error("Generate art for this character before minting.");
  }
  if (!pendingMint || !pendingMint.id || !pendingMint.tier) {
    throw new Error("Open a pack before minting — this card has no assigned tier.");
  }
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);

  progress("Fetching artwork...");
  const imageResponse = await fetch(entry.artUrl);
  if (!imageResponse.ok) {
    throw new Error("Couldn't load this character's artwork — nothing was minted. Regenerate the art and try again.");
  }
  const imageBuffer = await imageResponse.arrayBuffer();
  if (!imageBuffer || imageBuffer.byteLength === 0) {
    throw new Error("This character's artwork came back empty — nothing was minted. Regenerate the art and try again.");
  }
  // Full resolution, deliberately: this becomes the NFT's permanent image.
  const imageFile = createGenericFile(new Uint8Array(imageBuffer), "character.png", {
    contentType: "image/png",
  });
  progress("Uploading art to permanent storage...");
  const rawImageUri = await irysUpload(umi, [imageFile], imageBuffer.byteLength, progress);
  const permanentImageUri = toGateway(rawImageUri);
  progress("Verifying permanent storage...");
  if (!(await verifyUri(permanentImageUri))) {
    throw new Error("Storage upload could not be verified — mint aborted BEFORE any SOL was spent on the NFT. Wait a minute and try again.");
  }

  const r = entry.result;
  const traits = entry.traits || {};
  // ✋ THE MARK: passing markedBy means a God-Marked card's +77 HP and its
  // Borrowed Power are computed here and written into the PERMANENT on-chain
  // attributes (statsToAttributes emits "God-Marked: Throne N" + the power).
  // ⏳ AGE CARDS ride the same path as the God-Mark: computed here, baked into
  // the permanent attributes, never attachable afterward.
  const stats = computeStats(traits, pendingMint.tier, pendingMint.markedBy || null, pendingMint.ageCard || null);
  const traitAttributes = [
    { trait_type: "Archetype", value: (traits.archetypes || []).join(" + ") || "Unknown" },
    { trait_type: "Vibe", value: (traits.vibes || []).join(" + ") || "Unknown" },
    { trait_type: "World", value: (traits.worlds || []).join(" + ") || "Unknown" },
    { trait_type: "Color", value: (traits.colors || []).join(" + ") || "Unknown" },
    { trait_type: "Accessories", value: (traits.accessories || []).join(", ") || "None" },
    { trait_type: "Aura", value: traits.aura && traits.aura !== "None" ? traits.aura : "None" },
    { trait_type: "Art Style", value: traits.artStyle || "Unknown" },
    { trait_type: "Rarity", value: pendingMint.tier },
    ...(pendingMint.markNumber ? [{ trait_type: "God-Mark Number", value: `${pendingMint.markNumber} of 777` }] : []),
    ...(pendingMint.ageCard && AGE_CARDS[pendingMint.ageCard]
      ? [{ trait_type: "Age Number", value: `${pendingMint.ageNumber} of ${AGE_CARDS[pendingMint.ageCard].supply}` }]
      : []),
  ];
  const attributes = [...traitAttributes, ...statsToAttributes(stats)];
  const metadata = {
    name: r.characterName,
    symbol: "MGEN",
    description: `${r.tagline} ${r.bio}`,
    image: permanentImageUri,
    attributes,
    properties: {
      files: [{ uri: permanentImageUri, type: "image/png" }],
      category: "image",
    },
  };
  progress("Uploading metadata to permanent storage...");
  const metadataUri = toGateway(await irysUploadJson(umi, metadata, progress));
  if (!(await verifyUri(metadataUri))) {
    throw new Error("Metadata upload could not be verified — mint aborted BEFORE any SOL was spent on the NFT. Wait a minute and try again.");
  }

  progress("Minting — approve the transaction in your wallet...");
  const mintSigner = generateSigner(umi);
  await createNft(umi, {
    mint: mintSigner,
    name: r.characterName,
    symbol: "MGEN",
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(ROYALTY_PERCENT),
    ...(COLLECTION_ADDRESS ? { collection: some({ key: publicKey(COLLECTION_ADDRESS), verified: false }) } : {}),
  }).sendAndConfirm(umi);
  if (COLLECTION_ADDRESS) {
    // 🤝 SERVER STAMP FIRST — no second wallet prompt for the buyer.
    // The server holds a verify-only delegate (see approveVerifyDelegate above)
    // and stamps the card into the collection the moment it exists. The buyer
    // signs exactly once. Cheap retry: fal-style transient errors shouldn't
    // leave a card unverified when one more POST would have fixed it.
    // ⏳ WAIT BEFORE THE FIRST ATTEMPT, THEN BACK OFF.
    // The NFT's metadata account is brand new; the server's RPC often hasn't
    // seen it yet and the verify fails with "Incorrect account owner" — which
    // is propagation lag, not a permissions problem. Two fast tries weren't
    // enough. Now: 3s head start, then 4 attempts backing off 3s/5s/8s
    // (~19s worst case) before giving up to the fallback prompt.
    let stamped = false;
    progress("Adding to the MascotGen collection...");
    await new Promise((r) => setTimeout(r, 3000));
    const backoff = [3000, 5000, 8000];
    for (let attempt = 0; attempt < 4 && !stamped; attempt++) {
      try {
        const vr = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify-mint", mintAddress: mintSigner.publicKey.toString() }),
        });
        const vd = await vr.json().catch(() => null);
        stamped = !!(vd && vd.ok);
      } catch (e) {}
      if (!stamped && attempt < backoff.length) {
        progress(`Adding to the MascotGen collection... (${attempt + 2}/4)`);
        await new Promise((r) => setTimeout(r, backoff[attempt]));
      }
    }
    if (!stamped) {
      // FALLBACK — the old two-signature path, kept for when the server
      // delegate isn't configured yet (or is briefly down). Only in this
      // rare case does the buyer see a second prompt, and it explains itself.
      try {
        progress("✍️ ONE MORE SIGNATURE — approve in your wallet to add this card to the MascotGen collection. Your NFT is already minted and safe; skipping this just means it won't show as part of the collection until it's repaired.");
        await verifyCollectionV1(umi, {
          metadata: findMetadataPda(umi, { mint: mintSigner.publicKey }),
          collectionMint: publicKey(COLLECTION_ADDRESS),
          authority: umi.identity,
        }).sendAndConfirm(umi);
      } catch (e) {
        // Non-fatal BY DESIGN: the NFT exists and belongs to the buyer either
        // way. VERIFY EVERYONE (Ledger) sweeps anything left unverified.
        console.warn("collection verify failed (repairable later):", e);
        progress("Card minted. Collection stamp was skipped — it can be added later, your NFT is safe.");
      }
    }
  }
  const mintAddress = mintSigner.publicKey.toString();
  const cluster = rpcEndpoint.includes("devnet") ? "?cluster=devnet" : "";
  try {
    progress("Recording mint...");
    await fetch("/api/battle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `auth` is the 10-minute wallet signature minted by App.jsx before the
      // transaction — the server now refuses to spend a pack roll without it.
      body: JSON.stringify({ action: "close-pending", pendingId: pendingMint.id, mintAddress, auth }),
    });
  } catch (e) {
    console.warn("close-pending failed (non-fatal):", e);
  }
  progress("Minted!");
  return {
    mintAddress,
    explorerUrl: `https://explorer.solana.com/address/${mintAddress}${cluster}`,
    tier: pendingMint.tier,
    // The PERMANENT image URL, handed back so callers can store it instead of
    // the temporary fal link. Nothing consumes this yet — it's here for the
    // image_url cleanup, and costs nothing to return in the meantime.
    imageUri: permanentImageUri,
    metadataUri,
  };
}

/**
 * 🏛 ONE-TIME: creates the MascotGen collection NFT. Run once from the dev
 * wallet, then paste the printed address into COLLECTION_ADDRESS above and
 * redeploy. Costs a normal mint fee.
 */
export async function createMascotGenCollection({ wallet, rpcEndpoint, onProgress }) {
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);
  progress("Uploading collection metadata...");
  const meta = {
    name: "MascotGen — The Pentaverse",
    symbol: "MGEN",
    description:
      "Original AI-born mascots of the Pentaverse — five universes, twelve thrones, and the war that drowned the five. Every card carries real battle stats and a story that outlives its chart. mascotgen.studio",
    image: null,
    properties: { category: "image", files: [] },
  };
  const uri = toGateway(await irysUploadJson(umi, meta, progress));
  if (!(await verifyUri(uri))) throw new Error("Collection metadata upload could not be verified — try again.");
  progress("Minting the collection NFT — approve in your wallet...");
  const mintSigner = generateSigner(umi);
  await createNft(umi, {
    mint: mintSigner,
    name: "MascotGen — The Pentaverse",
    symbol: "MGEN",
    uri,
    sellerFeeBasisPoints: percentAmount(ROYALTY_PERCENT),
    isCollection: true,
  }).sendAndConfirm(umi);
  return { collectionAddress: mintSigner.publicKey.toString() };
}

/**
 * 🔎 READS A MASCOT FROM THE CHAIN ITSELF — for NFTs the database has never
 * heard of. This happens when the record step failed silently at mint time
 * and the NFT then traveled to another wallet: the chain is the only copy of
 * the truth left, and the chain is enough — name, art, and every attribute
 * live in the permanent metadata.
 */
export async function readMascotFromChain({ mintAddress, wallet, rpcEndpoint }) {
  const umi = makeUmi(wallet, rpcEndpoint);
  const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
  if ((asset.metadata.symbol || "").trim() !== "MGEN") return null; // not ours
  let json = null;
  try {
    const r = await fetch(toGateway(asset.metadata.uri), { cache: "no-store" });
    if (r.ok) json = await r.json();
  } catch (e) {}
  if (!json) return null;
  return { name: asset.metadata.name, json };
}

/**
 * 🔗 READS THE PERMANENT IMAGE URL out of an NFT's own on-chain metadata.
 *
 * This is the antidote to the image time bomb. Every mascot's NFT already
 * points at permanent Arweave storage — that was never in doubt. What rotted
 * was the DATABASE copy: `mints.image_url` was written with the temporary
 * fal.ai link the art was generated at, and fal deletes files eventually. The
 * NFTs would survive that; the Market, the gallery and every share card would
 * go blank, because those read the database, not the chain.
 *
 * The chain is therefore the source of truth here, and it costs nothing to
 * consult: this is a read, not a transaction. No approval, no SOL, no risk.
 * Returns null rather than guessing if the metadata can't be read or doesn't
 * contain a permanent URL — a card left alone is always better than a card
 * pointed somewhere wrong.
 */
export async function readPermanentImage({ mintAddress, wallet, rpcEndpoint }) {
  const umi = makeUmi(wallet, rpcEndpoint);
  const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
  const metaUri = toGateway(asset.metadata.uri || "");
  if (!metaUri) return null;
  let json = null;
  try {
    const r = await fetch(metaUri, { cache: "no-store" });
    if (r.ok) json = await r.json();
  } catch (e) {}
  if (!json || !json.image) return null;
  const image = toGateway(String(json.image));
  // Only hand back genuinely permanent storage. If an old NFT's metadata
  // itself still names a fal link, swapping one temporary URL for another
  // would just move the time bomb — leave it for repairNftUri instead.
  return image.startsWith("https://gateway.irys.xyz/") ? image : null;
}

/**
 * 🖼 SET THE COLLECTION'S ARTWORK & DETAILS — now SPLIT INTO TWO STEPS.
 *
 * The collection NFT was minted with no image (metadata `image: null`), which
 * is what makes a collection show up blank on Magic Eden and Tensor. Fixing it
 * means uploading real artwork to permanent storage and pointing the collection
 * NFT at the result.
 *
 * 🔴 WHY THIS IS TWO FUNCTIONS AND NOT ONE.
 * Those are two unrelated jobs with two DIFFERENT authority requirements, and
 * once collection authority moved to the Ledger (see transferCollectionAuthority
 * below) no single wallet could do both:
 *
 *   Step A — upload to Irys. Needs SOL and a signMessage() signature. Does NOT
 *     need collection authority. ANY funded hot wallet can do it.
 *   Step B — write the URI on-chain via updateV1. Needs collection authority
 *     (the Ledger). Does NOT touch Irys at all.
 *
 * The Ledger CANNOT do step A. Irys authenticates uploads by having the wallet
 * sign a raw off-chain data item, and the Ledger Solana app rejects arbitrary
 * off-chain messages — it fails with UNKNOWN_ERROR (0x6a81), "invalid off-chain
 * message header," before the upload even starts. Enabling Blind signing does
 * NOT fix this; that was tested. See LedgerHQ/ledger-live#11239,
 * anza-xyz/wallet-adapter#800, Irys-xyz/arbundles#55.
 *
 * The hot wallet cannot do step B — it no longer holds authority, and gets
 * 0x9e "Invalid authority type."
 *
 * So: run A from the hot wallet, copy the URI it returns, switch wallets, and
 * run B from the Ledger with that URI pasted in. The URI is the handoff token
 * between the two — nothing has to persist across the wallet switch, which is
 * the same reason 🔥 BURN and 🔐 TRANSFER TO LEDGER use typed confirmation
 * instead of stored state.
 *
 * ⚠️ Any FUTURE feature that uploads to Irys inherits this limitation.
 * repairNftUri() and createMascotGenCollection() also upload, so if either ever
 * needs to run under collection authority it will hit the same wall and needs
 * the same split. Individual mascot minting is unaffected — that is always
 * signed by the minter's own hot wallet, never the Ledger.
 */

/** The collection's metadata JSON. One definition, used by step A and by the
 *  sanity check in step B, so the two can never drift apart. */
const COLLECTION_NAME = "MascotGen — The Pentaverse";
const COLLECTION_SYMBOL = "MGEN";
const COLLECTION_DESCRIPTION =
  "Original AI-born mascots of the Pentaverse — five universes, twelve thrones, and the war that drowned the five. " +
  "Every card carries real battle stats and a story that outlives its chart: mascots fight in the Arena, race the " +
  "Grand Circuit, die and return from Purgatory, and earn a permanent saga written chapter by chapter — all of it " +
  "travelling with the NFT forever. The first 333 mints are the Founding 333, each carrying a named mark no other " +
  "card will ever have. Created at mascotgen.studio.";

/**
 * 🖼 STEP A of 2 — UPLOAD ONLY. No authority needed, nothing written on-chain.
 *
 * Reads public/collection.png off the site, pushes it to Irys, builds the
 * metadata JSON around it and pushes that too. Returns the permanent metadata
 * URI for step B. Run this from the HOT WALLET.
 *
 * Costs a little SOL for storage. Changes nothing that anyone can see — an
 * uploaded-but-unreferenced URI is inert, so a mistake here is throwaway, not
 * permanent. That asymmetry is deliberate: all the risk lives in step B.
 */
export async function uploadCollectionArt({ wallet, rpcEndpoint, onProgress }) {
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);

  progress("Reading collection artwork...");
  const res = await fetch("/collection.png");
  if (!res.ok) throw new Error("collection.png not found — upload it to the repo's public/ folder first.");
  const bytes = new Uint8Array(await res.arrayBuffer());

  // 🛡 res.ok IS NOT ENOUGH. This is a single-page app: Vercel's SPA fallback
  // answers an unmatched path with index.html and status 200, not a 404. So if
  // public/collection.png is ever missing or misnamed, the check above passes,
  // and we would pay real SOL to store index.html on Arweave forever, labelled
  // image/png, and then point the collection at it — a permanently broken
  // thumbnail on every marketplace. verifyUri() wouldn't catch it either; it
  // only proves the URL serves, not that it serves an image.
  //
  // The first eight bytes of a PNG are fixed by the spec (89 50 4E 47 0D 0A 1A
  // 0A), so checking them costs nothing and makes the failure impossible.
  const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 8 || PNG_MAGIC.some((b, i) => bytes[i] !== b)) {
    throw new Error(
      "/collection.png didn't come back as a PNG — the site served something else (usually the app's own page, " +
      "which means the file is missing from public/). Nothing was uploaded and no SOL was spent."
    );
  }

  progress("Uploading artwork to permanent storage...");
  const file = createGenericFile(bytes, "mascotgen-collection.png", { contentType: "image/png" });
  const rawImage = await irysUpload(umi, [file], bytes.byteLength, progress);
  const image = toGateway(rawImage);
  if (!(await verifyUri(image))) throw new Error("Artwork upload could not be verified — try again.");

  progress("Uploading collection details...");
  const meta = {
    name: COLLECTION_NAME,
    symbol: COLLECTION_SYMBOL,
    description: COLLECTION_DESCRIPTION,
    image,
    external_url: "https://mascotgen.studio",
    properties: { category: "image", files: [{ uri: image, type: "image/png" }] },
  };
  const uri = toGateway(await irysUploadJson(umi, meta, progress));
  if (!(await verifyUri(uri))) throw new Error("Collection metadata upload could not be verified — try again.");

  return { uri, image };
}

/**
 * 🖼 STEP B of 2 — WRITE THE URI ON-CHAIN. Collection authority only (Ledger).
 *
 * Takes the URI step A returned and points the collection NFT at it. One plain
 * Solana transaction, one approval, no Irys — which is exactly why the Ledger
 * can sign it.
 *
 * 🛡 EVERY CHECK BELOW EXISTS BECAUSE THIS WRITES PERMANENTLY AND THE URI IS
 * TYPED BY HAND. A pasted-wrong URI would repoint the entire collection at
 * someone else's metadata on every marketplace, so the value is validated
 * before the wallet is ever asked to sign — a failed check costs nothing, a bad
 * signature costs a recovery. In order:
 *   1. Non-empty, https, normalised to the Irys gateway.
 *   2. Fetches the JSON and confirms it PARSES and has an image.
 *   3. Confirms json.name matches the collection's on-chain name — this is the
 *      check that catches the realistic mistake, pasting an individual mascot's
 *      metadata URI, since that JSON is well-formed but named after the mascot.
 *   4. Confirms the connected wallet actually holds collection authority, so a
 *      wrong-wallet run fails with a sentence instead of a raw 0x9e.
 *   5. Returns early if the collection already points at this exact URI.
 */
export async function setCollectionArtUri({ uri, wallet, rpcEndpoint, onProgress }) {
  if (!COLLECTION_ADDRESS) throw new Error("COLLECTION_ADDRESS is not set in mint.js yet.");
  const progress = (msg) => onProgress && onProgress(msg);

  const clean = toGateway(String(uri || "").trim());
  if (!clean) throw new Error("Paste the metadata URI from step 1 first.");
  if (!clean.startsWith("https://")) throw new Error("That doesn't look like a URI — it must start with https://");

  progress("Checking the URI before touching the chain...");
  let json = null;
  try {
    const r = await fetch(clean, { cache: "no-store" });
    if (r.ok) json = await r.json();
  } catch (e) {}
  if (!json) throw new Error("Could not read that URI, or it isn't valid JSON. Re-run step 1 and copy the URI it gives you.");
  if (!json.image) throw new Error("That JSON has no image field — it isn't collection metadata. Re-run step 1.");

  const umi = makeUmi(wallet, rpcEndpoint);
  const cur = await fetchDigitalAsset(umi, publicKey(COLLECTION_ADDRESS));
  // unpad(), not trim() — see the helper's comment. Comparing a raw on-chain
  // name against a plain string is how you get an error that reads
  // `"MascotGen — The Pentaverse" but the collection is "MascotGen — The
  // Pentaverse"`: identical on screen, unequal in memory, because of trailing
  // NULs that trim() leaves behind.
  const onChainName = unpad(cur.metadata.name) || COLLECTION_NAME;
  if (unpad(json.name) !== onChainName) {
    throw new Error(
      `That URI is named "${unpad(json.name) || "(nothing)"}" but the collection is "${onChainName}". ` +
      `This looks like an individual mascot's metadata, not the collection's — nothing was written.`
    );
  }

  const holder = cur.metadata.updateAuthority.toString();
  const signer = umi.identity.publicKey.toString();
  if (holder !== signer) {
    throw new Error(
      `This wallet (${signer.slice(0, 4)}…${signer.slice(-4)}) doesn't hold collection authority — ` +
      `${holder.slice(0, 4)}…${holder.slice(-4)} does. Connect that wallet and run step 2 again.`
    );
  }

  if (unpad(cur.metadata.uri) === clean) return { alreadyDone: true, uri: clean, image: toGateway(String(json.image)) };

  progress("Updating the collection on-chain — approve on your Ledger...");
  // Preserve everything except the URI (same pattern as setRoyalty).
  await updateV1(umi, {
    mint: publicKey(COLLECTION_ADDRESS),
    authority: umi.identity,
    data: {
      name: onChainName,
      symbol: unpad(cur.metadata.symbol) || COLLECTION_SYMBOL,
      uri: clean,
      sellerFeeBasisPoints: cur.metadata.sellerFeeBasisPoints ?? ROYALTY_PERCENT * 100,
      creators: cur.metadata.creators,
    },
  }).sendAndConfirm(umi);

  return { uri: clean, image: toGateway(String(json.image)) };
}

/**
 * 🖼 BOTH STEPS IN ONE — only works if ONE wallet holds collection authority
 * AND can sign for Irys, i.e. a hot wallet. Kept because that is still the
 * correct path for any future collection whose authority hasn't been moved to
 * hardware, and because it keeps the original call site working unchanged.
 * For THE PENTAVERSE specifically, authority is on the Ledger — use
 * uploadCollectionArt() then setCollectionArtUri() instead.
 */
export async function updateCollectionArt({ wallet, rpcEndpoint, onProgress }) {
  if (!COLLECTION_ADDRESS) throw new Error("COLLECTION_ADDRESS is not set in mint.js yet.");
  const { uri } = await uploadCollectionArt({ wallet, rpcEndpoint, onProgress });
  return await setCollectionArtUri({ uri, wallet, rpcEndpoint, onProgress });
}

/**
 * 🔐 TRANSFER COLLECTION UPDATE AUTHORITY — moves control of the collection
 * NFT's metadata to the Ledger, permanently.
 *
 * Scope check, because "update authority" sounds bigger than it is: this only
 * affects the COLLECTION NFT itself — who can call updateCollectionArt() and
 * verifyIntoCollection()/joinCollection()'s verify step. It touches nothing
 * about any individual mascot (minters keep update authority over their own
 * mints forever, per the gotcha below) and moves no funds, no NFTs, no SOL.
 *
 * The destination is NOT a parameter. It's the fixed Ledger address below —
 * same pattern as DEV_REPAIR_WALLET — so there is no field for a typo to ruin.
 * The signature comes from whichever wallet CURRENTLY holds authority; the
 * Ledger itself doesn't need to be connected to receive it.
 *
 * AFTER this runs: 🖼 COLLECTION ART and ✅ VERIFY EVERYONE both require the
 * Ledger's signature. The hot wallet can no longer do either — that's the
 * entire point, not a bug to route around.
 */
const LEDGER_UPDATE_AUTHORITY = "9skiWG6D4iMaSpaYh5BGfjE5waR4mzbDZE2V61TjjYYq"; // Nano S Plus, account 1
export { LEDGER_UPDATE_AUTHORITY };

export async function transferCollectionAuthority({ wallet, rpcEndpoint, onProgress }) {
  if (!COLLECTION_ADDRESS) throw new Error("COLLECTION_ADDRESS is not set in mint.js yet.");
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);

  const cur = await fetchDigitalAsset(umi, publicKey(COLLECTION_ADDRESS));
  if (cur.metadata.updateAuthority.toString() === LEDGER_UPDATE_AUTHORITY) {
    return { alreadyDone: true };
  }

  progress("Transferring collection authority to the Ledger — approve in your wallet...");
  await updateV1(umi, {
    mint: publicKey(COLLECTION_ADDRESS),
    authority: umi.identity,
    newUpdateAuthority: publicKey(LEDGER_UPDATE_AUTHORITY),
  }).sendAndConfirm(umi);

  return { transferred: true };
}

/**
 * 🤝 AUTO-VERIFY DELEGATE — the fix for the two-signature mint.
 *
 * THE PROBLEM: minting fires two transactions. Buyers approve the first (the
 * NFT), see a second unexpected prompt (the collection stamp), and cancel it —
 * leaving a real NFT that marketplaces flag as "not in a listed collection".
 * At launch volume that is a trust disaster, and VERIFY EVERYONE from the
 * Ledger doesn't scale past a handful of mints a week.
 *
 * THE FIX: the collection authority (Ledger) grants a DELEGATE key the right
 * to verify items into this collection — and nothing else. The delegate's
 * secret lives in a Vercel env var; api/battle.js action "verify-mint" uses it
 * to stamp each card server-side the moment it mints. Buyer signs ONCE.
 *
 * SAFETY: a collection-authority delegate can only verify/unverify membership
 * of THIS collection. It cannot move NFTs, cannot touch SOL, cannot change
 * metadata, cannot mint. If the key ever leaks, the blast radius is "someone
 * could verify our own cards for us", and the Ledger can revoke it any time
 * with the revoke function below.
 *
 * SETUP (one time):
 *   1. Create a fresh wallet (this is the delegate). Fund it with ~0.01 SOL
 *      for transaction fees. Export its private key.
 *   2. In Vercel: add env DELEGATE_SECRET_KEY (the exported key) and RPC_URL.
 *   3. Connect the LEDGER in the Studio and run 🤝 AUTO-VERIFY ON, pasting
 *      the delegate's PUBLIC address.
 */
export async function approveVerifyDelegate({ delegateAddress, wallet, rpcEndpoint, onProgress }) {
  if (!COLLECTION_ADDRESS) throw new Error("COLLECTION_ADDRESS is not set in mint.js yet.");
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);
  const delegate = publicKey(String(delegateAddress).trim());
  // Guard: the signer must actually hold collection authority, so a wrong
  // wallet fails with a clear message instead of a raw program error.
  const cur = await fetchDigitalAsset(umi, publicKey(COLLECTION_ADDRESS));
  if (cur.metadata.updateAuthority.toString() !== umi.identity.publicKey.toString()) {
    throw new Error(`This wallet doesn't hold collection authority — connect ${cur.metadata.updateAuthority.toString().slice(0, 6)}… and retry.`);
  }
  progress("Granting verify-only delegate — approve in your wallet...");
  // MODERN delegate (delegateCollectionV1 → MetadataDelegateRecord), NOT the
  // legacy approveCollectionAuthority. The first version of this used the
  // legacy record and every server verify failed on-chain with "Update
  // Authority given does not match" — verifyCollectionV1 expects the modern
  // record. Both sides must speak the same generation.
  await delegateCollectionV1(umi, {
    mint: publicKey(COLLECTION_ADDRESS),
    authority: umi.identity,
    delegate,
    tokenStandard: TokenStandard.NonFungible,
  }).sendAndConfirm(umi);
  return { approved: true, delegate: delegate.toString() };
}

/** 🤝 Revoke the delegate. Collection authority (Ledger) only. */
export async function revokeVerifyDelegate({ delegateAddress, wallet, rpcEndpoint, onProgress }) {
  if (!COLLECTION_ADDRESS) throw new Error("COLLECTION_ADDRESS is not set in mint.js yet.");
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);
  const delegate = publicKey(String(delegateAddress).trim());
  progress("Revoking the delegate — approve in your wallet...");
  await revokeCollectionV1(umi, {
    mint: publicKey(COLLECTION_ADDRESS),
    authority: umi.identity,
    delegate,
    tokenStandard: TokenStandard.NonFungible,
  }).sendAndConfirm(umi);
  return { revoked: true };
}

/**
 * ✅ VERIFY ONLY — for mascots minted by OTHER PEOPLE.
 *
 * Setting an NFT's collection field needs that NFT's update authority (its
 * minter). Verifying membership needs the COLLECTION's authority (the studio).
 * No single wallet has both for someone else's card, which is why a public
 * mint lands with the collection set but unverified — and unverified members
 * don't show as part of the collection anywhere.
 *
 * This is the studio's half: it verifies any card already pointing at the
 * collection. Skips anything not pointing at us, and anything already done.
 */
export async function verifyIntoCollection({ mintAddress, wallet, rpcEndpoint, onProgress }) {
  if (!COLLECTION_ADDRESS) throw new Error("COLLECTION_ADDRESS is not set in mint.js yet.");
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);
  const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
  const c = asset.metadata.collection;
  const pointsAtUs = c && c.__option === "Some" && c.value.key.toString() === COLLECTION_ADDRESS;
  if (!pointsAtUs) return { notOurs: true };
  if (c.value.verified) return { skipped: true };
  progress("Verifying — approve in your wallet...");
  await verifyCollectionV1(umi, {
    metadata: findMetadataPda(umi, { mint: publicKey(mintAddress) }),
    collectionMint: publicKey(COLLECTION_ADDRESS),
    authority: umi.identity,
  }).sendAndConfirm(umi);
  return { verified: true };
}

/**
 * ✅ Joins an ALREADY-MINTED mascot to the collection and verifies it.
 */
export async function joinCollection({ mintAddress, wallet, rpcEndpoint, onProgress }) {
  if (!COLLECTION_ADDRESS) throw new Error("COLLECTION_ADDRESS is not set in mint.js yet.");
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);
  const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
  const current = asset.metadata.collection;
  const isSet =
    current && current.__option === "Some" && current.value.key.toString() === COLLECTION_ADDRESS;
  if (isSet && current.value.verified) return { skipped: true };
  if (!isSet) {
    progress("Setting collection — approve in your wallet...");
    await updateV1(umi, {
      mint: publicKey(mintAddress),
      authority: umi.identity,
      collection: collectionToggle("Set", [{ key: publicKey(COLLECTION_ADDRESS), verified: false }]),
    }).sendAndConfirm(umi);
    // ⏳ WAIT FOR THE CHAIN TO CATCH UP. The verify below simulates against
    // whatever RPC node answers first, and a node that hasn't seen the set
    // yet rejects with "Collection Not Found on Metadata" (0x50) — which is
    // exactly how 23 of 49 first-pass joins failed. Poll until the set is
    // actually visible before attempting the verify.
    progress("Waiting for the network to catch up...");
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const again = await fetchDigitalAsset(umi, publicKey(mintAddress));
        const c2 = again.metadata.collection;
        if (c2 && c2.__option === "Some" && c2.value.key.toString() === COLLECTION_ADDRESS) break;
      } catch (e) {}
    }
  }
  // Verify with retries — same race can hit the verify tx itself.
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      progress(attempt ? `Verifying membership (retry ${attempt}) — approve in your wallet...` : "Verifying membership — approve in your wallet...");
      await verifyCollectionV1(umi, {
        metadata: findMetadataPda(umi, { mint: publicKey(mintAddress) }),
        collectionMint: publicKey(COLLECTION_ADDRESS),
        authority: umi.identity,
      }).sendAndConfirm(umi);
      return { verified: true };
    } catch (e) {
      lastErr = e;
      // Only the stale-state error is worth retrying; anything else is real.
      if (!/Collection Not Found|0x50/i.test(String((e && e.message) || e))) throw e;
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  throw lastErr;
}

/**
 * 🔥 BURNS an NFT — permanently, on-chain, forever.
 *
 * This is the only irreversible action in MascotGen. There is no undo, no
 * support ticket, no "we restored it from a backup": the asset stops existing
 * on Solana and nobody — not us, not the user, not Solana — can bring it back.
 *
 * WHY IT EXISTS: in the Pentaverse, death normally costs a thousand years in
 * Purgatory and one minute of realm-time. It is reversible by design. A burn
 * is the one death that ISN'T, which is precisely what makes it worth
 * something as a story beat — a permanent, publicly verifiable ending in a
 * world where endings are usually rented.
 *
 * The wallet must hold the asset; Solana enforces that, not us.
 */
/**
 * ✏️ FIX A MINTED MASCOT'S TEXT — rewrites the NFT's on-chain description.
 *
 * "Minting freezes text forever" was never quite true: the metadata URI is a
 * pointer, and whoever holds the MINT's update authority (the wallet that
 * minted it — NOT the collection authority, NOT the Ledger) can repoint it.
 * What this exists for: the AI occasionally drifted pronouns despite the
 * gender picker (Seraphis Vael was the case that forced this), and some of
 * those cards were minted before ✏️ Fix Text existed.
 *
 * What it changes and what it deliberately does NOT:
 *   CHANGED  — description (rebuilt as `tagline + bio` from the entry's
 *              CURRENT, already-corrected text — same formula the mint used).
 *   KEPT     — image, attributes (stats, God-Mark, Age, rarity), name, symbol,
 *              everything else, copied field-for-field from the existing JSON.
 *              Stats and marks were computed at mint time and must never be
 *              rebuilt here from today's data; the old JSON is the only true source.
 *
 * Authority: signed by whichever wallet minted the mascot. That wallet is
 * always a hot wallet (the Ledger never mints), so it can sign BOTH the Irys
 * upload and the updateV1 — no two-wallet split needed, unlike collection art.
 * The guard below turns a wrong-wallet attempt into a sentence instead of an
 * on-chain 0x9e.
 */
export async function repairMintedText({ mintAddress, entry, wallet, rpcEndpoint, onProgress }) {
  const progress = (msg) => onProgress && onProgress(msg);
  const r = entry && entry.result;
  if (!r || !r.tagline || !r.bio) throw new Error("This character has no saved tagline/bio to write. Fix the text in the editor and save it first.");

  const umi = makeUmi(wallet, rpcEndpoint);
  progress("Reading the NFT...");
  const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));

  const holder = asset.metadata.updateAuthority.toString();
  const signer = umi.identity.publicKey.toString();
  if (holder !== signer) {
    throw new Error(
      `This wallet (${signer.slice(0, 4)}…${signer.slice(-4)}) didn't mint this mascot — ` +
      `${holder.slice(0, 4)}…${holder.slice(-4)} did, and only the minting wallet can fix its text. Nothing was changed.`
    );
  }

  progress("Reading the current metadata...");
  const oldUri = toGateway(unpad(asset.metadata.uri));
  let oldJson = null;
  try {
    const res = await fetch(oldUri, { cache: "no-store" });
    if (res.ok) oldJson = await res.json();
  } catch (e) {}
  if (!oldJson || !oldJson.image) {
    throw new Error("Couldn't read this NFT's existing metadata — the fix needs it to preserve the stats and image. Try again in a minute.");
  }

  const newDescription = `${r.tagline} ${r.bio}`.trim();
  if (unpad(oldJson.description || "") === newDescription) {
    return { alreadyDone: true, uri: oldUri };
  }

  progress("Uploading the corrected text to permanent storage...");
  // Copy the WHOLE old JSON and change only the description. Attributes carry
  // the mint-time stats, God-Mark and Age card — rebuilding any of that here
  // would silently rewrite history.
  const newJson = { ...oldJson, description: newDescription };
  const uri = toGateway(await irysUploadJson(umi, newJson, progress));
  if (!(await verifyUri(uri))) throw new Error("The corrected metadata upload could not be verified — try again. Nothing was changed on-chain.");

  progress("Updating the NFT on-chain — approve in your wallet...");
  await updateV1(umi, {
    mint: publicKey(mintAddress),
    authority: umi.identity,
    data: {
      name: unpad(asset.metadata.name),
      symbol: unpad(asset.metadata.symbol) || "MGEN",
      uri,
      sellerFeeBasisPoints: asset.metadata.sellerFeeBasisPoints,
      creators: asset.metadata.creators,
    },
  }).sendAndConfirm(umi);

  return { uri, oldUri };
}

export async function burnMascotNFT({ mintAddress, wallet, rpcEndpoint, onProgress }) {
  const progress = (msg) => onProgress && onProgress(msg);
  if (!mintAddress) throw new Error("No mint address to burn.");
  const umi = makeUmi(wallet, rpcEndpoint);

  progress("Reading the asset on-chain...");
  const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));

  progress("🔥 Burning — approve in your wallet. This cannot be undone.");
  await burnV1(umi, {
    mint: publicKey(mintAddress),
    authority: umi.identity,
    tokenOwner: umi.identity.publicKey,
    // A verified collection member must name its collection when burning, so
    // the collection's size counter stays correct.
    collectionMetadata: asset.metadata.collection?.__option === "Some"
      ? findMetadataPda(umi, { mint: asset.metadata.collection.value.key })
      : undefined,
    tokenStandard: 0, // NonFungible
  }).sendAndConfirm(umi);

  progress("Gone. Permanently.");
  return { burned: true, mintAddress };
}

/**
 * 💰 Sets the creator royalty on an ALREADY-MINTED NFT.
 */
export async function setRoyalty({ mintAddress, wallet, rpcEndpoint, onProgress }) {
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);
  const target = ROYALTY_PERCENT * 100; // basis points
  progress("Reading NFT...");
  const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
  if (asset.metadata.sellerFeeBasisPoints === target) {
    return { skipped: true, basisPoints: target };
  }
  progress(`Setting ${ROYALTY_PERCENT}% royalty — approve in your wallet...`);
  await updateV1(umi, {
    mint: publicKey(mintAddress),
    authority: umi.identity,
    data: {
      name: asset.metadata.name,
      symbol: asset.metadata.symbol || "MGEN",
      uri: asset.metadata.uri,
      sellerFeeBasisPoints: target,
      creators: asset.metadata.creators,
    },
  }).sendAndConfirm(umi);
  return { basisPoints: target };
}

/**
 * 🔧 Repairs an already-minted NFT whose images vanished.
 */
export async function repairNftUri({ mintAddress, entry, wallet, rpcEndpoint, onProgress }) {
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);
  progress("Reading NFT...");
  const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
  const oldUri = asset.metadata.uri || "";
  const id = oldUri.split("/").pop();

  if (oldUri.startsWith("https://gateway.irys.xyz/")) {
    try {
      const m = await fetch(oldUri, { cache: "no-store" });
      if (m.ok) {
        const j = await m.json();
        if (j && j.image) {
          const ir = await fetch(j.image, { method: "HEAD" });
          if (ir.ok) {
            progress("Already repaired — skipped, no approval needed.");
            return { newUri: oldUri, imageUri: j.image, skipped: true };
          }
        }
      }
    } catch (e) {}
  }

  let meta = null;
  if (id) {
    try {
      const r = await fetch(`https://gateway.irys.xyz/${id}`);
      if (r.ok) meta = await r.json();
    } catch (e) {}
  }
  if (!meta) {
    meta = {
      name: entry.result.characterName,
      symbol: "MGEN",
      description: `${entry.result.tagline || ""} ${entry.result.bio || ""}`.trim(),
      attributes: [],
      properties: { files: [], category: "image" },
    };
  }

  let imageUri = meta.image ? toGateway(meta.image) : null;
  if (imageUri) {
    try {
      const ir = await fetch(imageUri, { method: "HEAD" });
      if (!ir.ok) imageUri = null;
    } catch (e) {
      imageUri = null;
    }
  }
  if (!imageUri) {
    const src = entry.mintedArtUrl || entry.artUrl;
    if (!src) throw new Error(`No recoverable image for ${entry.result.characterName}`);
    progress("Re-uploading art to permanent storage...");
    const srcRes = await fetch(src);
    if (!srcRes.ok) throw new Error(`Couldn't load the artwork for ${entry.result.characterName} — NFT left untouched.`);
    const buf = await srcRes.arrayBuffer();
    const file = createGenericFile(new Uint8Array(buf), "character.png", { contentType: "image/png" });
    imageUri = toGateway(await irysUpload(umi, [file], buf.byteLength, progress));
  }

  const repaired = {
    ...meta,
    image: imageUri,
    properties: { ...(meta.properties || {}), files: [{ uri: imageUri, type: "image/png" }], category: "image" },
  };
  progress("Uploading repaired metadata...");
  const newUri = toGateway(await irysUploadJson(umi, repaired, progress));
  progress("Verifying the repair actually serves...");
  if (!(await verifyUri(newUri)) || !(await verifyUri(imageUri))) {
    throw new Error(`Repaired upload for ${entry.result.characterName} could not be verified — NFT left untouched. Try again in a few minutes.`);
  }

  progress("Updating the NFT on-chain — approve in your wallet...");
  await updateV1(umi, {
    mint: publicKey(mintAddress),
    authority: umi.identity,
    data: {
      name: asset.metadata.name,
      symbol: asset.metadata.symbol || "MGEN",
      uri: newUri,
      sellerFeeBasisPoints: asset.metadata.sellerFeeBasisPoints,
      creators: asset.metadata.creators,
    },
  }).sendAndConfirm(umi);

  return { newUri, imageUri };
}
