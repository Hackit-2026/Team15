import {
  DEFAULT_EFFECT_SETTINGS,
  type EffectSettings,
  type ReactionCreatedEvent,
  type SlideDestroyedEvent,
} from "./effect-types";

const MAX_ACTIVE_EMOJIS = 20;
const SHATTER_DURATION_MS = 1800;

export class PresentationEffects {
  private settings: EffectSettings = { ...DEFAULT_EFFECT_SETTINGS };
  private page = 1;
  private uniqueReactionCount = 0;
  private readonly seenEvents = new Set<string>();
  private shatterTimer: number | null = null;

  constructor(
    private readonly viewport: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly emojiLayer: HTMLElement,
    private readonly destructionLayer: HTMLElement,
    private readonly crackLayer: HTMLElement,
    private readonly reactionMeter: HTMLElement,
  ) {}

  updateSettings(settings: EffectSettings): void {
    this.settings = { ...settings };
    this.updateMeter();
    this.updateCracks();
  }

  setPage(page: number): void {
    this.page = page;
    this.uniqueReactionCount = 0;
    this.seenEvents.clear();
    this.clearVisuals();
    this.updateMeter();
  }

  handleReaction(event: ReactionCreatedEvent): void {
    if (event.page !== this.page || this.seenEvents.has(event.eventId)) {
      return;
    }
    this.seenEvents.add(event.eventId);
    this.uniqueReactionCount = Math.max(0, event.uniqueReactionCount);
    if (this.settings.emojiEffectEnabled) {
      this.spawnEmoji();
    }
    this.updateMeter();
    this.updateCracks();
  }

  handleDestroyed(event: SlideDestroyedEvent): void {
    if (event.page !== this.page || !this.settings.destructionEnabled) {
      return;
    }
    this.uniqueReactionCount = Math.max(this.uniqueReactionCount, event.uniqueReactionCount);
    this.updateMeter();
    this.playDestruction();
  }

  previewReaction(): void {
    this.uniqueReactionCount = Math.min(
      this.settings.destructionThreshold,
      this.uniqueReactionCount + 1,
    );
    if (this.settings.emojiEffectEnabled) {
      this.spawnEmoji();
    }
    this.updateMeter();
    this.updateCracks();
    if (
      this.settings.destructionEnabled
      && this.uniqueReactionCount >= this.settings.destructionThreshold
    ) {
      this.playDestruction();
    }
  }

  previewDestruction(): void {
    this.playDestruction();
  }

  destroy(): void {
    this.clearVisuals();
  }

  private spawnEmoji(): void {
    while (this.emojiLayer.childElementCount >= MAX_ACTIVE_EMOJIS) {
      this.emojiLayer.firstElementChild?.remove();
    }
    const emoji = document.createElement("span");
    emoji.className = "reaction-emoji";
    emoji.textContent = "🤔";
    emoji.style.setProperty("--emoji-x", `${8 + Math.random() * 84}%`);
    emoji.style.setProperty("--emoji-drift", `${-55 + Math.random() * 110}px`);
    emoji.style.setProperty("--emoji-scale", `${0.85 + Math.random() * 0.45}`);
    emoji.addEventListener("animationend", () => emoji.remove(), { once: true });
    this.emojiLayer.append(emoji);
  }

  private updateMeter(): void {
    this.reactionMeter.textContent = this.settings.destructionEnabled
      ? `🤔 ${this.uniqueReactionCount} / ${this.settings.destructionThreshold}人`
      : `🤔 ${this.uniqueReactionCount}人`;
    this.reactionMeter.classList.toggle(
      "is-threshold-reached",
      this.settings.destructionEnabled
        && this.uniqueReactionCount >= this.settings.destructionThreshold,
    );
  }

  private updateCracks(): void {
    const progress = this.uniqueReactionCount / this.settings.destructionThreshold;
    this.crackLayer.classList.toggle(
      "is-visible",
      this.settings.destructionEnabled && this.settings.crackEffectEnabled && progress >= 0.6,
    );
    this.crackLayer.classList.toggle("is-severe", progress >= 0.8);
  }

  private playDestruction(): void {
    if (this.canvas.width === 0 || this.destructionLayer.childElementCount > 0) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.canvas.classList.add("is-reduced-destruction");
      window.setTimeout(() => this.canvas.classList.remove("is-reduced-destruction"), 450);
      return;
    }

    const canvasBounds = this.canvas.getBoundingClientRect();
    const viewportBounds = this.viewport.getBoundingClientRect();
    const image = this.canvas.toDataURL("image/png");
    const surface = document.createElement("div");
    const columns = 6;
    const rows = 4;
    surface.className = "destruction-surface";
    Object.assign(surface.style, {
      left: `${canvasBounds.left - viewportBounds.left}px`,
      top: `${canvasBounds.top - viewportBounds.top}px`,
      width: `${canvasBounds.width}px`,
      height: `${canvasBounds.height}px`,
    });

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const shard = document.createElement("span");
        const width = canvasBounds.width / columns;
        const height = canvasBounds.height / rows;
        shard.className = "slide-shard";
        Object.assign(shard.style, {
          left: `${column * width}px`,
          top: `${row * height}px`,
          width: `${width + 1}px`,
          height: `${height + 1}px`,
          backgroundImage: `url(${image})`,
          backgroundSize: `${canvasBounds.width}px ${canvasBounds.height}px`,
          backgroundPosition: `${-column * width}px ${-row * height}px`,
        });
        shard.style.setProperty("--shard-x", `${-130 + Math.random() * 260}px`);
        shard.style.setProperty("--shard-y", `${180 + Math.random() * 340}px`);
        shard.style.setProperty("--shard-rotation", `${-95 + Math.random() * 190}deg`);
        shard.style.setProperty("--shard-delay", `${Math.random() * 120}ms`);
        surface.append(shard);
      }
    }

    this.destructionLayer.append(surface);
    this.canvas.classList.add("is-shattering");
    this.shatterTimer = window.setTimeout(() => {
      this.destructionLayer.replaceChildren();
      this.canvas.classList.remove("is-shattering");
      this.shatterTimer = null;
    }, SHATTER_DURATION_MS);
  }

  private clearVisuals(): void {
    if (this.shatterTimer !== null) {
      window.clearTimeout(this.shatterTimer);
      this.shatterTimer = null;
    }
    this.emojiLayer.replaceChildren();
    this.destructionLayer.replaceChildren();
    this.canvas.classList.remove("is-shattering", "is-reduced-destruction");
    this.crackLayer.classList.remove("is-visible", "is-severe");
  }
}
