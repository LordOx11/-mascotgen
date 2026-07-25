import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    // Some Solana/NFT libraries (specifically the Irys uploader used for
    // permanent art storage) rely on Node.js built-ins like "stream" and
    // "buffer" that don't exist in the browser. This plugin fills those in
    // so the same code that works in Node also works when bundled for the browser.
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  define: {
    "process.env": {},
  },
});
