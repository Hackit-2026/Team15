import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

const PDF_RESOURCE_OPTIONS = {
  cMapUrl: "/static/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/static/pdfjs/standard_fonts/",
  wasmUrl: "/static/pdfjs/wasm/",
  useSystemFonts: true,
} as const;

export class PdfDocumentLoader {
  private loadingTask: PDFDocumentLoadingTask | null = null;
  private document: PDFDocumentProxy | null = null;

  async load(file: File): Promise<PDFDocumentProxy> {
    await this.destroy();
    const data = new Uint8Array(await file.arrayBuffer());
    this.loadingTask = getDocument({ data, ...PDF_RESOURCE_OPTIONS });
    this.document = await this.loadingTask.promise;
    return this.document;
  }

  async destroy(): Promise<void> {
    if (this.loadingTask) {
      await this.loadingTask.destroy();
    } else if (this.document) {
      await this.document.destroy();
    }
    this.loadingTask = null;
    this.document = null;
  }
}
