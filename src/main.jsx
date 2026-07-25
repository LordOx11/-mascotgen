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
const NETWORK = "mainnet-beta";
const ENDPOINT = clusterApiUrl(NETWORK);

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
