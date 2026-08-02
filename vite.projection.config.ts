import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "/static/dist/",
  build: {
    emptyOutDir: false,
    outDir: resolve(projectRoot, "flask_app/static/dist"),
    rollupOptions: {
      input: resolve(projectRoot, "frontend/presentation/projection-renderer.ts"),
      output: {
        entryFileNames: "projection-renderer.js",
        assetFileNames: "projection-[hash][extname]",
      },
    },
  },
});
