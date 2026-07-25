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
// The free public RPC (clusterApiUrl) blocks browser apps with 403s, so we use
// a dedicated RPC provider instead. Paste your Helius RPC URL below —
// free at helius.dev, and you can restrict the key to your domain in their dashboard.
const NETWORK = "mainnet-beta";
const HELIUS_RPC = "PASTE_YOUR_HELIUS_RPC_URL_HERE";
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
