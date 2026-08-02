import {
  DEFAULT_EFFECT_SETTINGS,
  normalizeEffectSettings,
  type EffectSettings,
} from "./effect-types";

export class EffectSettingsClient {
  constructor(private readonly presentationId: string) {}

  async load(): Promise<EffectSettings> {
    const response = await fetch(
      `/api/presentation/${encodeURIComponent(this.presentationId)}/effect-settings`,
    );
    if (!response.ok) {
      throw new Error("演出設定APIはまだ利用できません");
    }
    return normalizeEffectSettings(await response.json());
  }

  async save(settings: EffectSettings): Promise<EffectSettings> {
    const response = await fetch(
      `/api/presentation/${encodeURIComponent(this.presentationId)}/effect-settings`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      },
    );
    if (!response.ok) {
      throw new Error("演出設定APIはまだ利用できません");
    }
    return normalizeEffectSettings(await response.json());
  }

  defaults(): EffectSettings {
    return { ...DEFAULT_EFFECT_SETTINGS };
  }
}
