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
} from "@metaplex-foundation/mpl-token-metadata";
import {
  generateSigner,
  percentAmount,
  createGenericFile,
  publicKey,
} from "@metaplex-foundation/umi";
import { computeStats, statsToAttributes } from "./stats.js";

// Irys items live here reliably; arweave.net sometimes never resolves them.
const toGateway = (u) => (u || "").replace("https://arweave.net/", "https://gateway.irys.xyz/");

// Trust nothing: after uploading, fetch the URI back and confirm it actually
// serves before baking it into an NFT. Retries a few times (fresh uploads can
// take a moment to propagate).
async function verifyUri(u) {
  for (let i = 0; i < 4; i++) {
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
        // Irys's current main upload endpoint. (node1.irys.xyz appears to be
        // retired — connection refused — while gateway/uploader respond fine.)
        address: "https://uploader.irys.xyz",
      })
    );
}

/**
 * Mints a character as an NFT.
 * @param {object} params
 * @param {object} params.entry - a saved collection entry (has .result, .traits, .artUrl)
 * @param {object} params.pendingMint - the LOCKED pending_mints row for this card,
 *   returned by /api/open-pack. Must contain { id, tier }. The tier was assigned
 *   server-side at pack-open and CANNOT be changed here — mint.js only reads it.
 * @param {object} params.wallet - the wallet-adapter-react wallet object (from useWallet())
 * @param {string} params.rpcEndpoint - the Solana RPC URL currently connected (from useConnection())
 * @param {(status: string) => void} [params.onProgress] - optional callback for UI status updates
 * @returns {Promise<{mintAddress: string, explorerUrl: string, tier: string}>}
 */
export async function mintCharacterNFT({ entry, pendingMint, wallet, rpcEndpoint, onProgress }) {
  if (!wallet || !wallet.connected) {
    throw new Error("Connect your wallet first.");
  }
  if (!entry.artUrl) {
    throw new Error("Generate art for this character before minting.");
  }
  if (!pendingMint || !pendingMint.id || !pendingMint.tier) {
    // No locked tier = no legitimate pack behind this mint. Refuse.
    throw new Error("Open a pack before minting — this card has no assigned tier.");
  }
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);

  // 2. Fetch the current art (still a temporary fal.ai link at this point)
  // and re-upload it so it becomes permanent.
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

  // 3. Build NFT metadata — name, description, and traits as standard attributes.
  const r = entry.result;
  const traits = entry.traits || {};
  const stats = computeStats(traits, pendingMint.tier);
  const traitAttributes = [
    { trait_type: "Archetype", value: (traits.archetypes || []).join(" + ") || "Unknown" },
    { trait_type: "Vibe", value: (traits.vibes || []).join(" + ") || "Unknown" },
    { trait_type: "World", value: (traits.worlds || []).join(" + ") || "Unknown" },
    { trait_type: "Color", value: (traits.colors || []).join(" + ") || "Unknown" },
    { trait_type: "Accessories", value: (traits.accessories || []).join(", ") || "None" },
    { trait_type: "Aura", value: traits.aura && traits.aura !== "None" ? traits.aura : "None" },
    { trait_type: "Art Style", value: traits.artStyle || "Unknown" },
    // Rarity IS the rolled tier now — no more AI-invented rarity.
    { trait_type: "Rarity", value: pendingMint.tier },
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

  // 4. Mint the NFT itself, straight to the connected wallet.
  progress("Minting — approve the transaction in your wallet...");
  const mintSigner = generateSigner(umi);
  await createNft(umi, {
    mint: mintSigner,
    name: r.characterName,
    symbol: "MGEN",
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(0),
  }).sendAndConfirm(umi);
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
 * 🔧 Repairs an already-minted NFT whose images vanished (the arweave.net
 * gateway problem). Recovers the original metadata from the Irys gateway when
 * possible (falls back to re-uploading the app's saved art), rewrites every
 * link to gateway.irys.xyz, uploads the repaired metadata, and points the NFT
 * at it via updateV1. Requires the connected wallet to be the update authority.
 * One wallet approval per NFT.
 */
export async function repairNftUri({ mintAddress, entry, wallet, rpcEndpoint, onProgress }) {
  const progress = (msg) => onProgress && onProgress(msg);
  const umi = makeUmi(wallet, rpcEndpoint);
  progress("Reading NFT...");
  const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
  const oldUri = asset.metadata.uri || "";
  const id = oldUri.split("/").pop();

  // Resume support: if this NFT already points at the gateway AND everything
  // it references actually serves, it's been repaired — skip it entirely.
  // No upload, no wallet approval, no fees.
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

  // Try to recover the ORIGINAL metadata from the Irys gateway.
  let meta = null;
  if (id) {
    try {
      const r = await fetch(`https://gateway.irys.xyz/${id}`);
      if (r.ok) meta = await r.json();
    } catch (e) {}
  }
  if (!meta) {
    // Metadata unrecoverable — rebuild it from the app's saved character.
    meta = {
      name: entry.result.characterName,
      symbol: "MGEN",
      description: `${entry.result.tagline || ""} ${entry.result.bio || ""}`.trim(),
      attributes: [],
      properties: { files: [], category: "image" },
    };
  }

  // Sort out a WORKING image link.
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
      symbol: asset.metadata.symbol,
      uri: newUri,
      sellerFeeBasisPoints: asset.metadata.sellerFeeBasisPoints,
      creators: asset.metadata.creators,
    },
  }).sendAndConfirm(umi);

  return { newUri, imageUri };
}
