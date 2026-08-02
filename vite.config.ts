import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: resolve(projectRoot, "flask_app/static/dist"),
    rollupOptions: {
      input: resolve(projectRoot, "frontend/presentation/presentation.ts"),
      output: {
        entryFileNames: "presentation.js",
        assetFileNames: "presentation-[hash][extname]",
      },
    },
  },
});
