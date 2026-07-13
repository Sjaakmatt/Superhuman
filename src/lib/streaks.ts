/**
 * Streaks en ritme, afgeleid uit xp_events (geen aparte opslag).
 * Geen streak-shame: we tonen streak + consistentie-%, nooit "verbroken".
 */

/** YYYY-MM-DD van een timestamp, in een specifieke tijdzone. */
export function dateStrInTz(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Datum-string n dagen verschuiven (rekenen in UTC, geen DST-issues). */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO-weekdag van een datum-string: 1 = maandag … 7 = zondag. */
export function isoWeekday(dateStr: string): number {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Aaneengesloten dagen met activiteit, terugtellend vanaf vandaag.
 * Vandaag zonder activiteit telt niet als onderbreking: dan tellen we
 * vanaf gisteren (de dag is immers nog bezig).
 */
export function currentStreak(activeDates: Set<string>, today: string): number {
  let cursor = activeDates.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (activeDates.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

/** Aandeel actieve dagen in het venster t/m vandaag (0..1). */
export function consistency(
  activeDates: Set<string>,
  today: string,
  windowDays = 28,
): number {
  let active = 0;
  for (let i = 0; i < windowDays; i += 1) {
    if (activeDates.has(shiftDate(today, -i))) active += 1;
  }
  return active / windowDays;
}
