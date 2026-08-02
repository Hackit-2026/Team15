import type { PDFDocumentProxy } from "pdfjs-dist";
import { validatePdfFile } from "./file-validation";
import { enterFullscreen, exitFullscreen, toggleFullscreen } from "./fullscreen";
import { bindPresentationKeyboard } from "./keyboard";
import { clampPage } from "./navigation";
import { PdfDocumentLoader } from "./pdf-document";
import { SlideRenderer } from "./slide-renderer";
import { BrowserEventSlideSync } from "./slide-sync";
import type { PresentationState, SlideChangeEvent, SlideSyncAdapter } from "./types";

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`必要な要素が見つかりません: ${id}`);
  }
  return element as T;
}

class PdfPresentationController {
  private state: PresentationState = {
    currentPage: 1,
    totalPages: 0,
    isLoading: false,
    isPresenting: false,
    error: null,
  };
  private readonly loader = new PdfDocumentLoader();
  private readonly renderer: SlideRenderer;
  private readonly sync: SlideSyncAdapter = new BrowserEventSlideSync();
  private document: PDFDocumentProxy | null = null;
  private loadVersion = 0;
  private resizeFrame = 0;
  private touchStartX: number | null = null;
  private removeKeyboardListener: () => void;

  private readonly fileInput = getElement<HTMLInputElement>("pdfFileInput");
  private readonly dropzone = getElement<HTMLLabelElement>("pdfDropzone");
  private readonly selectedFileName = getElement<HTMLElement>("selectedFileName");
  private readonly uploadStatus = getElement<HTMLElement>("pdfUploadStatus");
  private readonly errorMessage = getElement<HTMLElement>("presentationError");
  private readonly shell = getElement<HTMLElement>("presentationShell");
  private readonly stage = getElement<HTMLElement>("presentationStage");
  private readonly viewport = getElement<HTMLElement>("slideViewport");
  private readonly canvas = getElement<HTMLCanvasElement>("slideCanvas");
  private readonly currentPage = getElement<HTMLElement>("currentPage");
  private readonly totalPages = getElement<HTMLElement>("totalPages");
  private readonly previousButton = getElement<HTMLButtonElement>("previousSlide");
  private readonly nextButton = getElement<HTMLButtonElement>("nextSlide");
  private readonly startButton = getElement<HTMLButtonElement>("startPresentation");
  private readonly fullscreenButton = getElement<HTMLButtonElement>("toggleFullscreen");
  private readonly endButton = getElement<HTMLButtonElement>("endPresentation");

  constructor(private readonly presentationId: string) {
    this.renderer = new SlideRenderer(this.canvas, this.viewport);
    this.removeKeyboardListener = bindPresentationKeyboard(
      {
        next: () => this.goToNextPage(),
        previous: () => this.goToPreviousPage(),
        first: () => this.goToPage(1),
        last: () => this.goToPage(this.state.totalPages),
        toggleFullscreen: () => void this.toggleFullscreen(),
        exitPresentation: () => void this.endPresentation(),
      },
      () => this.document !== null && !this.state.isLoading,
    );
    this.bindEvents();
    this.updateUi();
  }

  private bindEvents(): void {
    this.fileInput.addEventListener("change", () => {
      const file = this.fileInput.files?.[0];
      if (file) {
        void this.loadPdf(file);
      }
    });

    for (const eventName of ["dragenter", "dragover"]) {
      this.dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        this.dropzone.classList.add("is-dragging");
      });
    }
    for (const eventName of ["dragleave", "drop"]) {
      this.dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        this.dropzone.classList.remove("is-dragging");
      });
    }
    this.dropzone.addEventListener("drop", (event) => {
      const file = event.dataTransfer?.files[0];
      if (file) {
        void this.loadPdf(file);
      }
    });

    this.previousButton.addEventListener("click", () => this.goToPreviousPage());
    this.nextButton.addEventListener("click", () => this.goToNextPage());
    this.startButton.addEventListener("click", () => void this.startPresentation());
    this.fullscreenButton.addEventListener("click", () => void this.toggleFullscreen());
    this.endButton.addEventListener("click", () => void this.endPresentation());

    this.stage.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("button, input, label")) {
        return;
      }
      const bounds = this.stage.getBoundingClientRect();
      if (event.clientX < bounds.left + bounds.width / 2) {
        this.goToPreviousPage();
      } else {
        this.goToNextPage();
      }
    });

    this.stage.addEventListener("touchstart", (event) => {
      this.touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });
    this.stage.addEventListener("touchend", (event) => {
      const endX = event.changedTouches[0]?.clientX;
      if (this.touchStartX === null || endX === undefined) {
        return;
      }
      const distance = endX - this.touchStartX;
      this.touchStartX = null;
      if (Math.abs(distance) < 50) {
        return;
      }
      if (distance < 0) {
        this.goToNextPage();
      } else {
        this.goToPreviousPage();
      }
    }, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = window.requestAnimationFrame(() => {
        if (this.document) {
          void this.renderCurrentPage();
        }
      });
    });
    resizeObserver.observe(this.viewport);

    document.addEventListener("fullscreenchange", () => {
      this.state.isPresenting = document.fullscreenElement === this.stage;
      this.updateUi();
      if (this.document) {
        void this.renderCurrentPage();
      }
    });

    window.addEventListener("beforeunload", () => {
      resizeObserver.disconnect();
      this.removeKeyboardListener();
      this.renderer.cancel();
      void this.loader.destroy();
    }, { once: true });
  }

  private async loadPdf(file: File): Promise<void> {
    const validationError = validatePdfFile(file);
    if (validationError) {
      this.setError(validationError);
      return;
    }

    const version = ++this.loadVersion;
    this.state.isLoading = true;
    this.state.error = null;
    this.selectedFileName.textContent = file.name;
    this.uploadStatus.textContent = "PDFを読み込んでいます...";
    this.updateUi();

    try {
      const document = await this.loader.load(file);
      if (version !== this.loadVersion) {
        return;
      }
      this.document = document;
      this.renderer.setDocument(document);
      this.state.currentPage = 1;
      this.state.totalPages = document.numPages;
      this.state.isLoading = false;
      this.shell.hidden = false;
      this.uploadStatus.textContent = `${document.numPages}ページを読み込みました`;
      this.updateUi();
      await this.renderCurrentPage();
      this.notifySlideChange();
    } catch (error) {
      if (version !== this.loadVersion) {
        return;
      }
      const message = error instanceof Error && error.name === "PasswordException"
        ? "暗号化されたPDFには対応していません"
        : "PDFを読み込めませんでした。ファイルが壊れていないか確認してください";
      this.state.isLoading = false;
      this.setError(message);
    }
  }

  private goToNextPage(): void {
    this.goToPage(this.state.currentPage + 1);
  }

  private goToPreviousPage(): void {
    this.goToPage(this.state.currentPage - 1);
  }

  private goToPage(pageNumber: number): void {
    if (!this.document || this.state.totalPages === 0) {
      return;
    }
    const nextPage = clampPage(pageNumber, this.state.totalPages);
    if (nextPage === this.state.currentPage) {
      return;
    }
    this.state.currentPage = nextPage;
    this.state.error = null;
    this.updateUi();
    void this.renderCurrentPage();
    this.notifySlideChange();
  }

  private async renderCurrentPage(): Promise<void> {
    try {
      await this.renderer.render(this.state.currentPage);
    } catch {
      this.setError("スライドの描画に失敗しました");
    }
  }

  private async startPresentation(): Promise<void> {
    if (!this.document) {
      return;
    }
    this.state.isPresenting = true;
    this.stage.classList.add("is-presenting");
    this.updateUi();
    await enterFullscreen(this.stage);
    await this.renderCurrentPage();
  }

  private async endPresentation(): Promise<void> {
    this.state.isPresenting = false;
    this.stage.classList.remove("is-presenting");
    await exitFullscreen();
    this.updateUi();
  }

  private async toggleFullscreen(): Promise<void> {
    if (!this.document) {
      return;
    }
    this.state.isPresenting = await toggleFullscreen(this.stage);
    this.stage.classList.toggle("is-presenting", this.state.isPresenting);
    this.updateUi();
  }

  private notifySlideChange(): void {
    const event: SlideChangeEvent = {
      presentationId: this.presentationId,
      currentPage: this.state.currentPage,
      totalPages: this.state.totalPages,
      timestamp: new Date().toISOString(),
    };
    try {
      void this.sync.publish(event);
    } catch {
      // 同期失敗でローカルのプレゼンテーションを止めない。
    }
  }

  private setError(message: string): void {
    this.state.error = message;
    this.errorMessage.textContent = message;
    this.updateUi();
  }

  private updateUi(): void {
    this.currentPage.textContent = String(this.state.currentPage);
    this.totalPages.textContent = String(this.state.totalPages);
    this.previousButton.disabled = this.state.isLoading || this.state.currentPage <= 1;
    this.nextButton.disabled = this.state.isLoading || this.state.currentPage >= this.state.totalPages;
    this.startButton.disabled = this.state.isLoading || this.document === null;
    this.fullscreenButton.disabled = this.state.isLoading || this.document === null;
    this.endButton.hidden = !this.state.isPresenting;
    this.fileInput.disabled = this.state.isLoading;
    this.dropzone.classList.toggle("is-loading", this.state.isLoading);
    this.errorMessage.textContent = this.state.error ?? "";
  }
}

async function bootstrapPresentation(): Promise<void> {
  try {
    const response = await fetch("/api/me");
    const data = await response.json() as { user?: { isTutor?: boolean } | null };
    if (!response.ok || !data.user?.isTutor) {
      window.location.href = "/tutor/login";
      return;
    }

    const roomId = document.body.dataset.roomId ?? "local";
    new PdfPresentationController(`room-${roomId}`);
  } catch {
    window.location.href = "/tutor/login";
  }
}

void bootstrapPresentation();
