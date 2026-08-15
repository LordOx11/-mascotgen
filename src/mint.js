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
export const COLLECTION_ADDRESS = null; // e.g. "9xAbC..."

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
export async function mintCharacterNFT({ entry, pendingMint, wallet, rpcEndpoint, onProgress }) {
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
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageFile = createGenericFile(new Uint8Array(imageBuffer), "character.png", {
    contentType: "image/png",
  });
  progress("Uploading art to permanent storage...");
  const [rawImageUri] = await umi.uploader.upload([imageFile]);
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
  const metadataUri = toGateway(await umi.uploader.uploadJson(metadata));
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
    await fetch("/api/wallet-mascots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close-pending", pendingId: pendingMint.id, mintAddress }),
    });
  } catch (e) {
    console.warn("close-pending failed (non-fatal):", e);
  }
  progress("Minted!");
  return {
    mintAddress,
    explorerUrl: `https://explorer.solana.com/address/${mintAddress}${cluster}`,
    tier: pendingMint.tier,
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
  const uri = toGateway(await umi.uploader.uploadJson(meta));
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
  }
  progress("Verifying membership — approve in your wallet...");
  await verifyCollectionV1(umi, {
    metadata: findMetadataPda(umi, { mint: publicKey(mintAddress) }),
    collectionMint: publicKey(COLLECTION_ADDRESS),
    authority: umi.identity,
  }).sendAndConfirm(umi);
  return { verified: true };
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
    const buf = await (await fetch(src)).arrayBuffer();
    const file = createGenericFile(new Uint8Array(buf), "character.png", { contentType: "image/png" });
    const [up] = await umi.uploader.upload([file]);
    imageUri = toGateway(up);
  }

  const repaired = {
    ...meta,
    image: imageUri,
    properties: { ...(meta.properties || {}), files: [{ uri: imageUri, type: "image/png" }], category: "image" },
  };
  progress("Uploading repaired metadata...");
  const newUri = toGateway(await umi.uploader.uploadJson(repaired));
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
