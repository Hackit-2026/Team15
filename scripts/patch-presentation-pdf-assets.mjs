import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const bundlePath = resolve(import.meta.dirname, "../flask_app/static/dist/presentation.js");
let source = await readFile(bundlePath, "utf8");
const resourceOptions = [
  'cMapUrl:"/static/pdfjs/cmaps/"',
  "cMapPacked:!0",
  'standardFontDataUrl:"/static/pdfjs/standard_fonts/"',
  'wasmUrl:"/static/pdfjs/wasm/"',
  "useSystemFonts:!0",
].join(",");

if (source.includes('cMapUrl:"/static/pdfjs/cmaps/"')) {
  console.log("presentation.jsにはPDF.jsリソース設定が反映済みです");
  process.exit(0);
}

const replacements = [
  {
    pattern: /this\.loadingTask=([\w$]+)\(\{data:e\}\)/g,
    replacement: (_match, getDocumentName) =>
      `this.loadingTask=${getDocumentName}({data:e,${resourceOptions}})`,
  },
  {
    pattern: /this\.loadingTask=([\w$]+)\(\{url:t\}\)/g,
    replacement: (_match, getDocumentName) =>
      `this.loadingTask=${getDocumentName}({url:t,${resourceOptions}})`,
  },
];

for (const { pattern, replacement } of replacements) {
  let count = 0;
  source = source.replace(pattern, (...args) => {
    count += 1;
    return replacement(args[0], args[1]);
  });
  if (count !== 1) {
    throw new Error(`presentation.jsのPDF読み込み箇所を一意に特定できませんでした: ${count}`);
  }
}

await writeFile(bundlePath, source);
console.log("presentation.jsへPDF.jsリソース設定を反映しました");
