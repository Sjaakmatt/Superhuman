import { minToTime } from "./nutrition";
import type { ScheduleBlockRow } from "./types";

/**
 * De "Nu"-motor (L6): op basis van de klok + wat nog niet gedaan is,
 * stelt de app één primaire actie voor uit het dagritme, met een preview
 * van wat straks komt. De home is nooit een dood dashboard.
 */

export const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

interface KindMeta {
  /** Aanmoedigende regel voor de Nu-kaart */
  line: (label: string) => string;
  cta: string;
  href: (refId: number | null) => string;
  /** Voedt dit blok een attribuut dat als "gedaan vandaag" telt? */
  doneKey: string | null;
}

const KIND_META: Record<string, KindMeta> = {
  stretch: {
    line: (l) => `Tijd voor ${l.toLowerCase()} — houd los wat vastzit.`,
    cta: "Start sessie",
    href: (id) => (id ? `/beweging/stretch/${id}` : "/beweging/stretch"),
    doneKey: "stretch",
  },
  workout: {
    line: (l) => `${l} staat klaar. Eén schone rep meer dan vorige keer.`,
    cta: "Start sessie",
    href: () => "/beweging/sessie/auto",
    doneKey: "workout",
  },
  breath: {
    line: () => "Een paar minuten ademen brengt je terug bij jezelf.",
    cta: "Adem mee",
    href: () => "/geest/breathwork",
    doneKey: "breath",
  },
  meditation: {
    line: () => "Tijd voor stilte. Kies een korte meditatie.",
    cta: "Mediteer",
    href: (id) => (id ? `/geest/meditaties/${id}` : "/geest/meditaties"),
    doneKey: "meditation",
  },
  meal: {
    line: (l) => `${l}-venster is open. Eet iets met eiwit.`,
    cta: "Naar voeding",
    href: () => "/voeding",
    doneKey: null,
  },
  water: {
    line: () => "Even hydrateren — neem een glas water.",
    cta: "Naar voeding",
    href: () => "/voeding",
    doneKey: null,
  },
  focus: {
    line: (l) => `${l}: leg je telefoon weg en werk één ding af.`,
    cta: "Ik ga focussen",
    href: () => "/vandaag",
    doneKey: "focus",
  },
  journal: {
    line: () => "Sluit de dag af — schrijf kort hoe het ging.",
    cta: "Naar journal",
    href: () => "/geest/journal",
    doneKey: "journal",
  },
  review: {
    line: () => "Je week in cijfers staat klaar. Vijf minuten.",
    cta: "Naar review",
    href: () => "/review",
    doneKey: "review",
  },
};

export function blockMeta(kind: string): KindMeta {
  return KIND_META[kind] ?? KIND_META.focus;
}

export interface NowProposal {
  /** Actief blok dat nu aandacht vraagt (niet gedaan) */
  active: ScheduleBlockRow | null;
  /** Eerstvolgende blok vandaag (voor de straks-preview) */
  next: ScheduleBlockRow | null;
}

/**
 * Kies het blok dat nú aandacht vraagt: binnen zijn venster, vandaag
 * gepland, en nog niet gedaan. De meest "overdue" (vroegste start) wint.
 * Daarnaast het eerstvolgende blok voor de preview.
 */
export function pickNowBlock(
  blocks: ScheduleBlockRow[],
  nowMin: number,
  dayCode: string,
  doneKeys: Set<string>,
  doneBlockIds: Set<number> = new Set(),
): NowProposal {
  const today = blocks
    .filter((b) => b.enabled && b.days.includes(dayCode))
    .sort((a, b) => a.start_min - b.start_min);

  const active =
    today
      .filter((b) => {
        if (nowMin < b.start_min || nowMin > b.start_min + b.window_min) {
          return false;
        }
        if (doneBlockIds.has(b.id)) return false; // handmatig afgevinkt
        const key = blockMeta(b.kind).doneKey;
        return !key || !doneKeys.has(key);
      })
      // Echte, afvinkbare acties eerst (een maaltijd/water blijft z'n hele
      // venster "open" en zou anders een later blok maskeren); daarbinnen
      // het meest recent gestarte blok — dat is wat nú net begon.
      .sort((a, b) => {
        const ka = blockMeta(a.kind).doneKey ? 1 : 0;
        const kb = blockMeta(b.kind).doneKey ? 1 : 0;
        if (ka !== kb) return kb - ka;
        return b.start_min - a.start_min;
      })[0] ?? null;

  // Straks-preview: het eerstvolgende blok dat nog niet begon en niet al
  // als "nu" getoond wordt.
  const next =
    today.find((b) => b.start_min > nowMin && b.id !== active?.id) ?? null;

  return { active, next };
}

export function blockTime(block: ScheduleBlockRow): string {
  return minToTime(block.start_min);
}
