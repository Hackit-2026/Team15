export type EffectSettings = {
  emojiEffectEnabled: boolean;
  destructionEnabled: boolean;
  destructionThreshold: number;
  crackEffectEnabled: boolean;
};

export type ReactionCreatedEvent = {
  eventId: string;
  roomId: number | string;
  presentationId: number | string;
  page: number;
  reactionType: "confused";
  uniqueReactionCount: number;
  destructionThreshold: number;
  thresholdReached: boolean;
  timestamp: string;
};

export type SlideDestroyedEvent = {
  roomId: number | string;
  presentationId: number | string;
  page: number;
  uniqueReactionCount: number;
  destructionThreshold: number;
  timestamp: string;
};

export const DEFAULT_EFFECT_SETTINGS: EffectSettings = {
  emojiEffectEnabled: true,
  destructionEnabled: false,
  destructionThreshold: 5,
  crackEffectEnabled: false,
};

export function normalizeEffectSettings(value: unknown): EffectSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_EFFECT_SETTINGS };
  }
  const data = value as Partial<EffectSettings>;
  const threshold = Number(data.destructionThreshold);
  return {
    emojiEffectEnabled: typeof data.emojiEffectEnabled === "boolean"
      ? data.emojiEffectEnabled
      : DEFAULT_EFFECT_SETTINGS.emojiEffectEnabled,
    destructionEnabled: typeof data.destructionEnabled === "boolean"
      ? data.destructionEnabled
      : DEFAULT_EFFECT_SETTINGS.destructionEnabled,
    destructionThreshold: Number.isFinite(threshold)
      ? Math.min(100, Math.max(2, Math.trunc(threshold)))
      : DEFAULT_EFFECT_SETTINGS.destructionThreshold,
    crackEffectEnabled: typeof data.crackEffectEnabled === "boolean"
      ? data.crackEffectEnabled
      : DEFAULT_EFFECT_SETTINGS.crackEffectEnabled,
  };
}
