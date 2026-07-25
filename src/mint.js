// mint.js — turns a saved MascotGen character into a real Solana NFT.
//
// What this does, in order:
//   1. Fetches the character's generated art (currently a temporary fal.ai link)
//   2. Uploads that image to Arweave via Irys — this is what makes it PERMANENT
//   3. Builds metadata (name, description, traits) and uploads that too
//   4. Mints an NFT pointing at that permanent metadata, straight to the
//      connected wallet — the wallet signs and pays the (small) network fee
//
// IMPORTANT — read before using on real money:
//   - Solana/Metaplex package APIs move fast. Verify these imports still match
//     the current @metaplex-foundation docs before relying on this in production.
//   - TEST ON DEVNET FIRST. Switch NETWORK to "devnet" in main.jsx, get free
//     devnet SOL from a faucet (e.g. faucet.solana.com), and mint a few test
//     NFTs there before ever touching mainnet-beta with real money.
//   - This mints a REGULAR NFT (not yet compressed). Regular mints cost a bit
//     more SOL than compressed ones (~0.01-0.02 SOL vs fractions of a cent).
//     Compression (Step 5) is a separate upgrade — see the note at the bottom.

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  mplTokenMetadata,
  createNft,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  generateSigner,
  percentAmount,
  createGenericFile,
} from "@metaplex-foundation/umi";

/**
 * Mints a character as an NFT.
 * @param {object} params
 * @param {object} params.entry - a saved collection entry (has .result, .traits, .artUrl)
 * @param {object} params.wallet - the wallet-adapter-react wallet object (from useWallet())
 * @param {string} params.rpcEndpoint - the Solana RPC URL currently connected (from useConnection())
 * @param {(status: string) => void} [params.onProgress] - optional callback for UI status updates
 * @returns {Promise<{mintAddress: string, explorerUrl: string}>}
 */
export async function mintCharacterNFT({ entry, wallet, rpcEndpoint, onProgress }) {
  if (!wallet || !wallet.connected) {
    throw new Error("Connect your wallet first.");
  }
  if (!entry.artUrl) {
    throw new Error("Generate art for this character before minting.");
  }

  const progress = (msg) => onProgress && onProgress(msg);

  // 1. Set up Umi — Metaplex's toolkit — using the connected wallet as the signer
  // and Irys as the storage layer that writes permanently to Arweave.
  const umi = createUmi(rpcEndpoint)
    .use(walletAdapterIdentity(wallet))
    .use(mplTokenMetadata())
    .use(irysUploader());

  // 2. Fetch the current art (still a temporary fal.ai link at this point)
  // and re-upload it to Arweave so it becomes permanent.
  progress("Fetching artwork...");
  const imageResponse = await fetch(entry.artUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageFile = createGenericFile(new Uint8Array(imageBuffer), "character.png", {
    contentType: "image/png",
  });

  progress("Uploading art to permanent storage (Arweave)...");
  const [permanentImageUri] = await umi.uploader.upload([imageFile]);

  // 3. Build NFT metadata — name, description, and traits as standard attributes.
  const r = entry.result;
  const traits = entry.traits || {};
  const attributes = [
    { trait_type: "Archetype", value: (traits.archetypes || []).join(" + ") || "Unknown" },
    { trait_type: "Vibe", value: (traits.vibes || []).join(" + ") || "Unknown" },
    { trait_type: "World", value: (traits.worlds || []).join(" + ") || "Unknown" },
    { trait_type: "Color", value: (traits.colors || []).join(" + ") || "Unknown" },
    { trait_type: "Accessories", value: (traits.accessories || []).join(", ") || "None" },
    { trait_type: "Aura", value: traits.aura && traits.aura !== "None" ? traits.aura : "None" },
    { trait_type: "Art Style", value: traits.artStyle || "Unknown" },
    { trait_type: "Rarity", value: r.rarity || "Common" },
  ];

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
  const metadataUri = await umi.uploader.uploadJson(metadata);

  // 4. Mint the NFT itself, straight to the connected wallet.
  // This is the step that pops up Phantom asking the user to approve + pay the fee.
  progress("Minting — approve the transaction in your wallet...");
  const mintSigner = generateSigner(umi);

  await createNft(umi, {
    mint: mintSigner,
    name: r.characterName,
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(0), // 0% royalty by default — adjust if you want secondary-sale royalties
  }).sendAndConfirm(umi);

  const mintAddress = mintSigner.publicKey.toString();
  const cluster = rpcEndpoint.includes("devnet") ? "?cluster=devnet" : "";

  progress("Minted!");
  return {
    mintAddress,
    explorerUrl: `https://explorer.solana.com/address/${mintAddress}${cluster}`,
  };
}

// ---------------------------------------------------------------------------
// NOTE ON STEP 5 (Compressed NFTs / cheaper mints):
// Compressed NFTs use a different program (Bubblegum) and require a one-time
// "Merkle tree" to be created by YOU (the platform owner) before any
// individual character can be minted into it — it's not a per-user setting,
// it's platform infrastructure you set up once. That's a separate, smaller
// follow-up build once regular minting above is proven working. Ping me when
// you're ready for it — it involves creating and funding a tree via
// @metaplex-foundation/mpl-bubblegum, then swapping createNft() above for
// mintV1() into that tree.
// ---------------------------------------------------------------------------
