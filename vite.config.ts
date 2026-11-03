import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [react()],
  build: {
    target: "chrome99",
    cssTarget: "chrome99",
    sourcemap: false,
    rolldownOptions: {
      output: { format: "iife", entryFileNames: "assets/z-motion.js" },
    },
  },
  server: { host: "127.0.0.1" },
});
