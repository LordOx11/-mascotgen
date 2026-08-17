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
    try {
      progress("Verifying collection membership...");
      await verifyCollectionV1(umi, {
        metadata: findMetadataPda(umi, { mint: mintSigner.publicKey }),
        collectionMint: publicKey(COLLECTION_ADDRESS),
        authority: umi.identity,
      }).sendAndConfirm(umi);
    } catch (e) {
      console.warn("collection verify failed (repairable later):", e);
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
 * 🖼 SET THE COLLECTION'S ARTWORK & DETAILS — collection authority only.
 *
 * The collection NFT was minted with no image (metadata `image: null`), which
 * is what makes a collection show up blank on Magic Eden and Tensor. This
 * uploads the real artwork to permanent storage, rebuilds the metadata JSON
 * with description + links, and points the collection NFT at it.
 *
 * The image is read from the SITE (public/collection.png) so the bundle stays
 * small, then pushed to Irys so the final record is permanent either way.
 * Safe to re-run — it just publishes a fresh metadata URI each time.
 */
export async function updateCollectionArt({ wallet, rpcEndpoint, onProgress }) {
  if (!COLLECTION_ADDRESS) throw new Error("COLLECTION_ADDRESS is not set in mint.js yet.");
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);

  progress("Reading collection artwork...");
  const res = await fetch("/collection.png");
  if (!res.ok) throw new Error("collection.png not found — upload it to the repo's public/ folder first.");
  const bytes = new Uint8Array(await res.arrayBuffer());

  progress("Uploading artwork to permanent storage...");
  const file = createGenericFile(bytes, "mascotgen-collection.png", { contentType: "image/png" });
  const rawImage = await irysUpload(umi, [file], bytes.byteLength, progress);
  const image = toGateway(rawImage);
  if (!(await verifyUri(image))) throw new Error("Artwork upload could not be verified — try again.");

  progress("Uploading collection details...");
  const meta = {
    name: "MascotGen — The Pentaverse",
    symbol: "MGEN",
    description:
      "Original AI-born mascots of the Pentaverse — five universes, twelve thrones, and the war that drowned the five. " +
      "Every card carries real battle stats and a story that outlives its chart: mascots fight in the Arena, race the " +
      "Grand Circuit, die and return from Purgatory, and earn a permanent saga written chapter by chapter — all of it " +
      "travelling with the NFT forever. The first 333 mints are the Founding 333, each carrying a named mark no other " +
      "card will ever have. Created at mascotgen.studio.",
    image,
    external_url: "https://mascotgen.studio",
    properties: { category: "image", files: [{ uri: image, type: "image/png" }] },
  };
  const uri = toGateway(await irysUploadJson(umi, meta, progress));
  if (!(await verifyUri(uri))) throw new Error("Collection metadata upload could not be verified — try again.");

  progress("Updating the collection on-chain — approve in your wallet...");
  // Read the collection's current on-chain data first so the update preserves
  // everything except the URI (same pattern as setRoyalty).
  const cur = await fetchDigitalAsset(umi, publicKey(COLLECTION_ADDRESS));
  await updateV1(umi, {
    mint: publicKey(COLLECTION_ADDRESS),
    authority: umi.identity,
    data: {
      name: cur.metadata.name || "MascotGen — The Pentaverse",
      symbol: cur.metadata.symbol || "MGEN",
      uri,
      sellerFeeBasisPoints: cur.metadata.sellerFeeBasisPoints ?? ROYALTY_PERCENT * 100,
      creators: cur.metadata.creators,
    },
  }).sendAndConfirm(umi);
  return { uri, image };
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
