import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

type PresentationMetadata = {
  currentPage: number;
  fileUrl: string;
  originalFilename: string;
  totalPages: number;
};

const MAX_RENDER_PIXELS = 12_000_000;
const PDF_RESOURCE_OPTIONS = {
  cMapUrl: "/static/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/static/pdfjs/standard_fonts/",
  wasmUrl: "/static/pdfjs/wasm/",
  useSystemFonts: true,
} as const;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

class ProjectionRenderer {
  private document: PDFDocumentProxy | null = null;
  private loadingTask: PDFDocumentLoadingTask | null = null;
  private renderTask: RenderTask | null = null;
  private currentPage = 1;
  private loadedFilename = "";
  private loadInProgress = false;
  private renderVersion = 0;
  private resizeFrame = 0;
  private sharePanelOpen: boolean;
  private readonly channel: BroadcastChannel;
  private readonly resizeObserver: ResizeObserver;
  private readonly layoutObserver: MutationObserver;

  constructor(
    private readonly roomId: string,
    private readonly stage: HTMLElement,
    private readonly sharePanel: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.sharePanelOpen = stage.classList.contains("has-share-panel");
    this.channel = new BroadcastChannel(`team15-presentation:${roomId}`);
    this.channel.addEventListener("message", (event) => {
      const message = event.data as {
        type?: string;
        currentPage?: number;
        fileName?: string;
      } | null;
      if (message?.type !== "slide-frame") {
        return;
      }

      const nextPage = Math.max(1, Number(message.currentPage) || 1);
      const pageChanged = nextPage !== this.currentPage;
      this.currentPage = nextPage;
      const fileName = typeof message.fileName === "string" ? message.fileName : "";
      if (fileName && this.loadedFilename && fileName !== this.loadedFilename) {
        void this.loadPdf(true);
        return;
      }
      if (pageChanged || (!this.stage.classList.contains("has-hires-slide") && !this.renderTask)) {
        this.scheduleRender();
      }
    });

    this.resizeObserver = new ResizeObserver(() => this.scheduleRender());
    this.resizeObserver.observe(stage);
    this.layoutObserver = new MutationObserver(() => {
      const nextSharePanelOpen = this.stage.classList.contains("has-share-panel");
      if (nextSharePanelOpen === this.sharePanelOpen) {
        return;
      }
      this.sharePanelOpen = nextSharePanelOpen;
      this.scheduleRender();
      window.setTimeout(() => this.scheduleRender(), 380);
    });
    this.layoutObserver.observe(stage, { attributes: true, attributeFilter: ["class"] });

    window.addEventListener("beforeunload", () => this.destroy(), { once: true });
    void this.loadPdf();
  }

  private async loadPdf(force = false): Promise<void> {
    if (this.loadInProgress) {
      return;
    }
    this.loadInProgress = true;

    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
          const metadataResponse = await fetch(
            `/api/room/${encodeURIComponent(this.roomId)}/presentation`,
            { cache: "no-store" },
          );
          if (!metadataResponse.ok) {
            throw new Error("PDF metadata is not ready");
          }
          const metadata = await metadataResponse.json() as PresentationMetadata;
          if (!force && this.document && metadata.originalFilename === this.loadedFilename) {
            this.currentPage = Math.max(1, Number(metadata.currentPage) || this.currentPage);
            this.scheduleRender();
            return;
          }

          const fileResponse = await fetch(metadata.fileUrl, { cache: "no-store" });
          if (!fileResponse.ok) {
            throw new Error("PDF file is not ready");
          }
          const bytes = new Uint8Array(await fileResponse.arrayBuffer());
          await this.releaseDocument();
          this.loadingTask = getDocument({ data: bytes, ...PDF_RESOURCE_OPTIONS });
          this.document = await this.loadingTask.promise;
          this.loadedFilename = metadata.originalFilename;
          this.currentPage = Math.min(
            this.document.numPages,
            Math.max(1, Number(metadata.currentPage) || this.currentPage),
          );
          this.scheduleRender();
          return;
        } catch {
          if (attempt === 11) {
            this.useFallbackImage();
            return;
          }
          await delay(750);
        }
      }
    } finally {
      this.loadInProgress = false;
    }
  }

  private scheduleRender(): void {
    window.cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = window.requestAnimationFrame(() => {
      void this.renderCurrentPage();
    });
  }

  private async renderCurrentPage(): Promise<void> {
    if (!this.document) {
      return;
    }

    const version = ++this.renderVersion;
    this.renderTask?.cancel();
    try {
      const pageNumber = Math.min(this.document.numPages, Math.max(1, this.currentPage));
      const page = await this.document.getPage(pageNumber);
      if (version !== this.renderVersion) {
        return;
      }

      const panelWidth = this.stage.classList.contains("has-share-panel")
        ? this.sharePanel.getBoundingClientRect().width
        : 0;
      const availableWidth = Math.max(1, this.stage.clientWidth - panelWidth);
      const availableHeight = Math.max(1, this.stage.clientHeight);
      const baseViewport = page.getViewport({ scale: 1 });
      const cssScale = Math.min(
        availableWidth / baseViewport.width,
        availableHeight / baseViewport.height,
      );
      const viewport = page.getViewport({ scale: cssScale });

      let outputScale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
      const requestedPixels = viewport.width * viewport.height * outputScale * outputScale;
      if (requestedPixels > MAX_RENDER_PIXELS) {
        outputScale *= Math.sqrt(MAX_RENDER_PIXELS / requestedPixels);
      }

      const nextCanvas = document.createElement("canvas");
      nextCanvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      nextCanvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      const nextContext = nextCanvas.getContext("2d", { alpha: false });
      if (!nextContext) {
        throw new Error("Projection canvas is unavailable");
      }

      this.renderTask = page.render({
        canvas: nextCanvas,
        canvasContext: nextContext,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      });
      await this.renderTask.promise;
      if (version !== this.renderVersion) {
        return;
      }

      this.canvas.width = nextCanvas.width;
      this.canvas.height = nextCanvas.height;
      const displayContext = this.canvas.getContext("2d", { alpha: false });
      if (!displayContext) {
        throw new Error("Projection canvas is unavailable");
      }
      displayContext.drawImage(nextCanvas, 0, 0);
      this.canvas.style.width = `${Math.floor(viewport.width)}px`;
      this.canvas.style.height = `${Math.floor(viewport.height)}px`;
      this.canvas.style.left = `${Math.floor((availableWidth - viewport.width) / 2)}px`;
      this.canvas.style.top = `${Math.floor((availableHeight - viewport.height) / 2)}px`;
      this.canvas.hidden = false;
      this.stage.classList.add("has-hires-slide");
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "RenderingCancelledException") {
        this.useFallbackImage();
      }
    } finally {
      if (version === this.renderVersion) {
        this.renderTask = null;
      }
    }
  }

  private useFallbackImage(): void {
    this.canvas.hidden = true;
    this.stage.classList.remove("has-hires-slide");
  }

  private async releaseDocument(): Promise<void> {
    this.renderVersion += 1;
    this.renderTask?.cancel();
    this.renderTask = null;
    if (this.loadingTask) {
      await this.loadingTask.destroy();
    } else if (this.document) {
      await this.document.destroy();
    }
    this.loadingTask = null;
    this.document = null;
  }

  private destroy(): void {
    this.resizeObserver.disconnect();
    this.layoutObserver.disconnect();
    window.cancelAnimationFrame(this.resizeFrame);
    this.channel.close();
    void this.releaseDocument();
  }
}

const params = new URLSearchParams(window.location.search);
const roomId = params.get("roomId");
const stage = document.getElementById("projectionStage");
const sharePanel = document.getElementById("projectionSharePanel");
const canvas = document.getElementById("projectionCanvas");

if (
  roomId
  && stage instanceof HTMLElement
  && sharePanel instanceof HTMLElement
  && canvas instanceof HTMLCanvasElement
  && "BroadcastChannel" in window
) {
  new ProjectionRenderer(roomId, stage, sharePanel, canvas);
}
