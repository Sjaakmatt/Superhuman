/**
 * De zes attributen (build brief §4). Alles wat de gebruiker doet voedt
 * één van deze stats.
 */
export const ATTRIBUTE_KEYS = [
  "vitaliteit",
  "kracht",
  "soepel",
  "voeding",
  "focus",
  "geest",
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

export interface AttributeDef {
  key: AttributeKey;
  label: string;
  /** CSS custom property met de attribuutkleur */
  colorVar: string;
  /** Waar dit attribuut door gevoed wordt */
  fedBy: string;
}

export const ATTRIBUTES: Record<AttributeKey, AttributeDef> = {
  vitaliteit: {
    key: "vitaliteit",
    label: "Vitaliteit",
    colorVar: "var(--attr-vitaliteit)",
    fedBy: "slaap, herstel, water",
  },
  kracht: {
    key: "kracht",
    label: "Kracht",
    colorVar: "var(--attr-kracht)",
    fedBy: "krachttraining, sport",
  },
  soepel: {
    key: "soepel",
    label: "Soepelheid",
    colorVar: "var(--attr-soepel)",
    fedBy: "stretchen, mobiliteit",
  },
  voeding: {
    key: "voeding",
    label: "Voeding",
    colorVar: "var(--attr-voeding)",
    fedBy: "voeding-check-in, plan volgen",
  },
  focus: {
    key: "focus",
    label: "Focus",
    colorVar: "var(--attr-focus)",
    fedBy: "deep work, routines, discipline",
  },
  geest: {
    key: "geest",
    label: "Geest",
    colorVar: "var(--attr-geest)",
    fedBy: "meditatie, breathwork, journaling, stemming",
  },
};
