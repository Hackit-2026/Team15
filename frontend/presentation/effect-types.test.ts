import { describe, expect, it } from "vitest";
import { DEFAULT_EFFECT_SETTINGS, normalizeEffectSettings } from "./effect-types";

describe("normalizeEffectSettings", () => {
  it("バックエンド未接続時は安全な初期値を使う", () => {
    expect(normalizeEffectSettings(null)).toEqual(DEFAULT_EFFECT_SETTINGS);
    expect(normalizeEffectSettings({}).destructionEnabled).toBe(false);
  });

  it("発動人数を2人から100人の範囲に収める", () => {
    expect(normalizeEffectSettings({ destructionThreshold: 1 }).destructionThreshold).toBe(2);
    expect(normalizeEffectSettings({ destructionThreshold: 150 }).destructionThreshold).toBe(100);
  });
});
