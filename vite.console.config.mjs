import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: path.resolve(__dirname, "public/console-ui"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        admin: path.resolve(__dirname, "src/console-app/admin.jsx"),
        buyer: path.resolve(__dirname, "src/console-app/buyer.jsx")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
