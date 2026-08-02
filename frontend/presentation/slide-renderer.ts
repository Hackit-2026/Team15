import type {
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist";

const CACHE_RADIUS = 2;
const MAX_CACHED_PAGES = CACHE_RADIUS * 2 + 1;

export class SlideRenderer {
  private document: PDFDocumentProxy | null = null;
  private renderTask: RenderTask | null = null;
  private pageCache = new Map<number, PDFPageProxy>();
  private renderVersion = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly viewportElement: HTMLElement,
  ) {}

  setDocument(document: PDFDocumentProxy): void {
    this.cancel();
    this.pageCache.clear();
    this.document = document;
  }

  async render(pageNumber: number): Promise<void> {
    if (!this.document) {
      return;
    }

    const version = ++this.renderVersion;
    this.renderTask?.cancel();

    const page = await this.getPage(pageNumber);
    if (version !== this.renderVersion) {
      return;
    }

    const baseViewport = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(1, this.viewportElement.clientWidth);
    const availableHeight = Math.max(1, this.viewportElement.clientHeight);
    const scale = Math.min(
      availableWidth / baseViewport.width,
      availableHeight / baseViewport.height,
    );
    const viewport = page.getViewport({ scale });
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    const context = this.canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Canvasを初期化できませんでした");
    }

    this.canvas.width = Math.floor(viewport.width * outputScale);
    this.canvas.height = Math.floor(viewport.height * outputScale);
    this.canvas.style.width = `${Math.floor(viewport.width)}px`;
    this.canvas.style.height = `${Math.floor(viewport.height)}px`;

    this.renderTask = page.render({
      canvas: this.canvas,
      canvasContext: context,
      viewport,
      transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
    });

    try {
      await this.renderTask.promise;
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "RenderingCancelledException") {
        throw error;
      }
    } finally {
      if (version === this.renderVersion) {
        this.renderTask = null;
      }
    }

    void this.preloadAround(pageNumber);
  }

  cancel(): void {
    this.renderVersion += 1;
    this.renderTask?.cancel();
    this.renderTask = null;
  }

  private async getPage(pageNumber: number): Promise<PDFPageProxy> {
    const cached = this.pageCache.get(pageNumber);
    if (cached) {
      this.pageCache.delete(pageNumber);
      this.pageCache.set(pageNumber, cached);
      return cached;
    }
    if (!this.document) {
      throw new Error("PDFが読み込まれていません");
    }
    const page = await this.document.getPage(pageNumber);
    this.pageCache.set(pageNumber, page);
    this.trimCache();
    return page;
  }

  private async preloadAround(currentPage: number): Promise<void> {
    if (!this.document) {
      return;
    }
    const pageNumbers: number[] = [];
    for (let offset = 1; offset <= CACHE_RADIUS; offset += 1) {
      if (currentPage + offset <= this.document.numPages) {
        pageNumbers.push(currentPage + offset);
      }
      if (currentPage - offset >= 1) {
        pageNumbers.push(currentPage - offset);
      }
    }
    await Promise.all(pageNumbers.map((page) => this.getPage(page).catch(() => undefined)));
  }

  private trimCache(): void {
    while (this.pageCache.size > MAX_CACHED_PAGES) {
      const firstKey = this.pageCache.keys().next().value as number | undefined;
      if (firstKey === undefined) {
        return;
      }
      this.pageCache.get(firstKey)?.cleanup();
      this.pageCache.delete(firstKey);
    }
  }
}
