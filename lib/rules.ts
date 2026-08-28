import { addDays, formatShort, type IsoDate } from '@/lib/date';
import { adherence, meanOver, weekJump, weightChangePerWeek, wellnessTrend } from '@/lib/metrics';
import type { Milestone, Shoe } from '@/lib/types';

/* De alarmen zijn SQL en TypeScript, niet AI. Of een grens wordt overschreden
 * bepaalt dit bestand; het model schrijft alleen de toelichting. Elke regel
 * heeft een test met een geval dat vuurt en een dat niet vuurt. */

export type Level = 'info' | 'warn' | 'stop';

export type RuleHit = {
  id: string;
  level: Level;
  title: string;
  detail: string;
  /** Sinds wanneer dit speelt; null als het over één moment gaat. */
  since: IsoDate | null;
};

export type RuleInput = {
  today: IsoDate;
  /** Welzijn, oplopend op datum. */
  wellness: { date: IsoDate; total: number | null; weight_kg: number | null }[];
  /** Sessielogs, oplopend op datum. */
  logs: {
    date: IsoDate;
    rpe: number | null;
    pain_score: number | null;
    pain_note: string | null;
    pain_next_morning: number | null;
  }[];
  /** Werkelijk gelopen kilometers per planweek. */
  weekKm: Map<number, number>;
  currentWeek: number;
  /** Status van de huidige week uit plan_week: opbouw, DELOAD, TAPER, ... */
  weekStatus: string;
  /** De laatste zes geplande Z2-sessies van minstens twintig minuten. */
  z2: { date: IsoDate; avg_hr: number; minutes: number }[];
  z2Ceiling: number;
  /** Afdaalminuten per week, gepland en gelopen. Oplopend op week. */
  descent: { week: number; actual_min: number; target_min: number }[];
  /** Krachtsessies per week, gedaan en gepland. Oplopend op week. */
  strength: { week: number; done: number; planned: number }[];
  milestones: Milestone[];
  bloodPanelDates: IsoDate[];
  shoes: Shoe[];
};

const nl = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',');

/** Weeknummer waarin een datum valt, op basis van de weekkilometers-sleutels.
 *  Alleen nodig voor de pijnregel, die per week groepeert. */
function weekIndex(dates: IsoDate[], date: IsoDate): number {
  const first = dates[0];
  if (!first) return 0;
  const days = Math.floor((Date.parse(date) - Date.parse(first)) / 86_400_000);
  return Math.floor(days / 7);
}

function painKey(note: string | null): string {
  return (note ?? 'onbenoemd').trim().toLowerCase();
}

export function evaluate(input: RuleInput): RuleHit[] {
  const hits: RuleHit[] = [];
  const { today, logs, wellness } = input;

  // ── pijn ────────────────────────────────────────────────────────────────
  const recentLogs = logs.filter((l) => l.date >= addDays(today, -13));

  const morning = [...recentLogs].reverse().find((l) => (l.pain_next_morning ?? 0) > 0);
  if (morning) {
    hits.push({
      id: 'pain-morning',
      level: 'warn',
      title: 'Pijn de ochtend erna',
      detail: `Na ${formatShort(morning.date, today)} was de pijn de volgende ochtend nog ${morning.pain_next_morning}/10. Het pijnmodel vraagt nul. Loop makkelijk tot dat weer klopt.`,
      since: morning.date,
    });
  }

  const high = [...recentLogs].reverse().find((l) => (l.pain_score ?? 0) > 5);
  if (high) {
    hits.push({
      id: 'pain-high',
      level: 'stop',
      title: 'Pijn boven 5 tijdens het lopen',
      detail: `${formatShort(high.date, today)}: ${high.pain_score}/10${high.pain_note ? ` (${high.pain_note})` : ''}. Boven de vijf stop je met lopen. Rust, en zoek er iemand bij als het na drie dagen niet zakt.`,
      since: high.date,
    });
  }

  // Stijgende pijn op dezelfde plek, drie weken op rij. Per week de hoogste score.
  const dates = logs.map((l) => l.date);
  const perPlace = new Map<string, Map<number, number>>();
  for (const l of logs) {
    if (!l.pain_score) continue;
    const key = painKey(l.pain_note);
    const w = weekIndex(dates, l.date);
    const byWeek = perPlace.get(key) ?? new Map<number, number>();
    byWeek.set(w, Math.max(byWeek.get(w) ?? 0, l.pain_score));
    perPlace.set(key, byWeek);
  }
  for (const [place, byWeek] of perPlace) {
    const weeks = [...byWeek.keys()].sort((a, b) => a - b);
    for (let i = 2; i < weeks.length; i++) {
      const [w0, w1, w2] = [weeks[i - 2]!, weeks[i - 1]!, weeks[i]!];
      if (w1 !== w0 + 1 || w2 !== w1 + 1) continue;
      const [a, b, c] = [byWeek.get(w0)!, byWeek.get(w1)!, byWeek.get(w2)!];
      if (a < b && b < c) {
        const since = logs.find((l) => painKey(l.pain_note) === place && weekIndex(dates, l.date) === w0)?.date ?? null;
        hits.push({
          id: 'pain-rising',
          level: 'stop',
          title: `Pijn loopt op: ${place}`,
          detail: `Drie weken op rij hoger op dezelfde plek (${a} → ${b} → ${c} van de 10). Dat is het patroon dat vooraf gaat aan uitval. Niet doorlopen.`,
          since,
        });
        break;
      }
    }
  }

  // ── welzijn ─────────────────────────────────────────────────────────────
  const trend = wellnessTrend(wellness, today);
  if (trend.last14 !== null) {
    const twoDays = [addDays(today, -1), today]
      .map((d) => wellness.find((w) => w.date === d))
      .filter((w): w is (typeof wellness)[number] => Boolean(w) && typeof w!.total === 'number');
    if (twoDays.length === 2 && twoDays.every((w) => (w.total as number) <= trend.last14! - 2)) {
      hits.push({
        id: 'wellness-drop',
        level: 'warn',
        title: 'Twee dagen onder je eigen gemiddelde',
        detail: `Je welzijnstotaal is twee dagen achtereen minstens 2 punten onder het veertiendaags gemiddelde (${nl(trend.last14)}). Vaak is dat slaap of stress buiten het lopen. Houd de sessie rustig.`,
        since: twoDays[0]!.date,
      });
    }
  }

  if (trend.last7 !== null && trend.baseline !== null && trend.last7 <= trend.baseline - 3) {
    const days = [0, 1, 2, 3, 4, 5, 6]
      .map((i) => addDays(today, -i))
      .filter((d) => {
        const m = meanOver(wellness, d, 7, (w) => w.total);
        return m !== null && m <= trend.baseline! - 3;
      });
    if (days.length >= 5) {
      hits.push({
        id: 'wellness-sustained',
        level: 'stop',
        title: 'Je welzijn zakt al langer weg',
        detail: `Het zevendaags gemiddelde ligt ${nl(trend.baseline - trend.last7)} punten onder je basislijn (${nl(trend.baseline)}) en dat houdt al ${days.length} dagen aan. Dit is geen zware dag maar een trend. Neem rust en bouw daarna terug op.`,
        since: days[days.length - 1] ?? null,
      });
    }
  }

  // ── volume ──────────────────────────────────────────────────────────────
  const jump = weekJump(input.weekKm, input.currentWeek);
  if (jump !== null && jump > 1.3) {
    hits.push({
      id: 'week-jump',
      level: 'warn',
      title: 'Weeksprong boven 1,30',
      detail: `Deze week staat op ${nl(jump * 100, 0)}% van je zwaarste van de twee voorgaande weken. Boven 1,30 loopt het blessurerisico op zonder dat je er fitter van wordt.`,
      since: null,
    });
  }

  // ── intensiteit ─────────────────────────────────────────────────────────
  const drifted = input.z2.slice(-6).filter((s) => s.avg_hr > input.z2Ceiling);
  if (input.z2.length >= 3 && drifted.length >= 3) {
    hits.push({
      id: 'z2-drift',
      level: 'warn',
      title: 'Je duurlopen kruipen omhoog',
      detail: `${drifted.length} van je laatste ${Math.min(6, input.z2.length)} Z2-sessies gingen boven ${input.z2Ceiling} slagen. Rustig betekent rustiger dan dit; anders verlies je juist de basis die je in Z2 opbouwt.`,
      since: drifted[0]?.date ?? null,
    });
  }

  // ── afdalen ─────────────────────────────────────────────────────────────
  const descentWeeks = input.descent.filter((d) => d.target_min > 0).slice(-3);
  if (descentWeeks.length === 3 && descentWeeks.every((d) => d.actual_min < d.target_min * 0.8)) {
    hits.push({
      id: 'descent-behind',
      level: 'warn',
      title: 'Je afdaalminuten blijven achter',
      detail: `Drie weken op rij onder 80% van het doel (laatst ${Math.round(descentWeeks[2]!.actual_min)} van ${descentWeeks[2]!.target_min} min). Op 100 km sloopt de afdaling je quadriceps, niet de klim.`,
      since: null,
    });
  }

  // ── kracht ──────────────────────────────────────────────────────────────
  const strengthWeeks = input.strength.slice(-4);
  const rate = adherence(strengthWeeks);
  if (strengthWeeks.length === 4 && rate !== null && rate < 0.7) {
    hits.push({
      id: 'strength-behind',
      level: 'warn',
      title: 'Kracht blijft liggen',
      detail: `Over vier weken deed je ${nl(rate * 100, 0)}% van de geplande krachtsessies. Kracht is het enige onderdeel dat je loopeconomie verbetert zonder extra kilometers.`,
      since: null,
    });
  }

  // ── gewicht ─────────────────────────────────────────────────────────────
  const isBuild = /opbouw|overload/i.test(input.weekStatus);
  const drop = weightChangePerWeek(wellness, today);
  if (isBuild && drop !== null && drop < -0.01) {
    hits.push({
      id: 'weight-drop',
      level: 'warn',
      title: 'Je valt af in een opbouwblok',
      detail: `${nl(Math.abs(drop) * 100)}% per week. In een opbouwblok is dat te snel: je eet te weinig voor de belasting, en dat kost spier en ijzer.`,
      since: null,
    });
  }

  // ── metingen en materiaal ───────────────────────────────────────────────
  const dueBlood = input.milestones
    .filter((m) => m.kind === 'meting' && m.date <= today)
    .filter((m) => !input.bloodPanelDates.some((d) => d >= addDays(m.date, -14) && d <= addDays(m.date, 28)));
  const lastDue = dueBlood[dueBlood.length - 1];
  if (lastDue) {
    hits.push({
      id: 'blood-due',
      level: 'info',
      title: 'Bloedpanel staat open',
      detail: `"${lastDue.title}" stond gepland op ${formatShort(lastDue.date, today)} en is nog niet ingevoerd. Ferritine onder 30 verklaart meer moeheid dan welke trainingsaanpassing ook.`,
      since: lastDue.date,
    });
  }

  for (const shoe of input.shoes.filter((s) => !s.retired && s.km > 700)) {
    hits.push({
      id: 'shoe-worn',
      level: 'info',
      title: `${shoe.name} staat op ${Math.round(shoe.km)} km`,
      detail: 'Boven de 700 km neemt de demping meetbaar af. Zet hem op rust of gebruik hem alleen voor korte draf.',
      since: null,
    });
  }

  return hits.sort((a, b) => order(b.level) - order(a.level));
}

function order(level: Level): number {
  return level === 'stop' ? 2 : level === 'warn' ? 1 : 0;
}

export function highest(hits: RuleHit[]): Level | null {
  if (hits.some((h) => h.level === 'stop')) return 'stop';
  if (hits.some((h) => h.level === 'warn')) return 'warn';
  return hits.length ? 'info' : null;
}
