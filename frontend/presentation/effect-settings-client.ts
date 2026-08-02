import {
  DEFAULT_EFFECT_SETTINGS,
  normalizeEffectSettings,
  type EffectSettings,
} from "./effect-types";

export class EffectSettingsClient {
  constructor(private readonly presentationId: string) {}

  async load(): Promise<EffectSettings> {
    try {
      const value = localStorage.getItem(this.storageKey());
      return normalizeEffectSettings(value ? JSON.parse(value) : null);
    } catch {
      return this.defaults();
    }
  }

  async save(settings: EffectSettings): Promise<EffectSettings> {
    const normalizedSettings = normalizeEffectSettings(settings);
    localStorage.setItem(this.storageKey(), JSON.stringify(normalizedSettings));
    return normalizedSettings;
  }

  defaults(): EffectSettings {
    return { ...DEFAULT_EFFECT_SETTINGS };
  }

  private storageKey(): string {
    return `team15-presentation-effects:${this.presentationId}`;
  }
}
