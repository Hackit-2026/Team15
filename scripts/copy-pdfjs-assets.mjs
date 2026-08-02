import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const pdfjsRoot = resolve(projectRoot, "node_modules/pdfjs-dist");
const outputRoot = resolve(projectRoot, "flask_app/static/pdfjs");
const directories = ["cmaps", "standard_fonts", "wasm"];

await mkdir(outputRoot, { recursive: true });
for (const directory of directories) {
  await cp(resolve(pdfjsRoot, directory), resolve(outputRoot, directory), {
    recursive: true,
    force: true,
  });
}

console.log("PDF.jsのCMap・フォント・WASMデータを配置しました");
