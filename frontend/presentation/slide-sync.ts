import type { SlideChangeEvent, SlideSyncAdapter } from "./types";

export class BrowserEventSlideSync implements SlideSyncAdapter {
  publish(data: SlideChangeEvent): void {
    window.dispatchEvent(
      new CustomEvent<SlideChangeEvent>("presentation:slide-change", {
        detail: data,
      }),
    );
  }
}
