import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "@solana/wallet-adapter-react-ui/styles.css";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// Solana network + RPC endpoint the wallet connects to.
// "mainnet-beta" is real funds/real tokens. Switch to "devnet" while testing
// so you're not risking real SOL, then flip back before launch.
// Solana network + RPC endpoint the wallet connects to.
// The RPC URL is read from a Vite env var (VITE_HELIUS_RPC) set in Vercel, so
// it survives file re-uploads and isn't hardcoded. Falls back to the public
// RPC only if the env var is missing (which will 403 — so make sure it's set).
const NETWORK = "mainnet-beta";
const HELIUS_RPC = import.meta.env.VITE_HELIUS_RPC || "";
const ENDPOINT = HELIUS_RPC.startsWith("https") ? HELIUS_RPC : clusterApiUrl(NETWORK);

function Root() {
  // Wallets shown in the connect modal. Add more adapters here later if needed.
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
