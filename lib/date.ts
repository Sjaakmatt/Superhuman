/** Een trainingsdag is een kalenderdag in Europe/Amsterdam, geen moment.
 *  Alles in deze app rekent met `YYYY-MM-DD`-strings; nooit met Date-objecten
 *  waarvan de tijdzone per omgeving verschilt (de Worker draait op UTC). */

export const TZ = 'Europe/Amsterdam';

export type IsoDate = string; // YYYY-MM-DD

const ymd = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** De kalenderdag in Amsterdam op een gegeven moment (standaard: nu). */
export function today(at: Date = new Date()): IsoDate {
  return ymd.format(at);
}

/** Verschuif een kalenderdag met hele dagen. Zomertijd raakt dit niet: we
 *  rekenen in UTC-middag en formatteren daarna terug. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = Date.UTC(y, m - 1, d + days, 12);
  return new Date(t).toISOString().slice(0, 10);
}

/** Aantal dagen tussen twee kalenderdagen (b − a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const p = (s: IsoDate) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(b) - p(a)) / 86_400_000);
}

/** Maandag van de week waarin `date` valt. */
export function weekStart(date: IsoDate): IsoDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = zondag
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

const WEEKDAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'] as const;

export function weekdayName(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] as string;
}

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'] as const;

/** "4 sep" of "4 sep 2027" wanneer het jaar afwijkt van het referentiejaar. */
export function formatShort(date: IsoDate, reference?: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const label = `${d} ${MONTHS[m - 1]}`;
  return reference && reference.slice(0, 4) !== String(y) ? `${label} ${y}` : label;
}

export function formatLong(date: IsoDate): string {
  return `${weekdayName(date).toLowerCase()} ${formatShort(date)}`;
}

/** De kalenderdag van een Strava-tijdstip. `start_date_local` is al lokaal,
 *  dus we knippen hem af — een loop van 23:40 hoort bij die dag. */
export function localDayOf(startDateLocal: string): IsoDate {
  return startDateLocal.slice(0, 10);
}

/** De maand waar een kalenderdag in valt, als `YYYY-MM`. */
export function monthOf(date: IsoDate): string {
  return date.slice(0, 7);
}

/** Verschuif een maand met hele maanden. */
export function addMonths(month: string, months: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Alle kalenderdagen van een maand, op volgorde. */
export function monthDays(month: string): IsoDate[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** Maandag = 0, zondag = 6. De agenda begint op maandag, net als het plan. */
export function weekdayIndex(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

const MONTH_NAMES = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
] as const;

/** "september 2026". */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
