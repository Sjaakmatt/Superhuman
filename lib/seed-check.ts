import type { PlanSeed } from '@/lib/seed-files';
import { addDays, weekdayName } from '@/lib/date';

/** Integriteit van het plan. De seed schrijft niets weg zolang hier iets
 *  overblijft, en de test draait dezelfde controles. */
export function checkSeed(seed: PlanSeed): string[] {
  const problems: string[] = [];
  const { weeks, days, meta } = seed;

  if (weeks.length !== meta.weeks) problems.push(`${weeks.length} weken, ${meta.weeks} verwacht`);
  if (days.length !== meta.days) problems.push(`${days.length} dagen, ${meta.days} verwacht`);

  const byWeek = new Map(weeks.map((w) => [w.week, w]));
  for (let n = 1; n <= meta.weeks; n++) if (!byWeek.has(n)) problems.push(`week ${n} ontbreekt`);

  const dates = new Set<string>();
  for (const d of days) {
    if (dates.has(d.date)) problems.push(`dubbele dag ${d.date}`);
    dates.add(d.date);
    const w = byWeek.get(d.week);
    if (!w) {
      problems.push(`${d.date} hoort bij week ${d.week}, die niet bestaat`);
      continue;
    }
    if (d.phase !== w.phase) problems.push(`${d.date}: fase "${d.phase}" wijkt af van week ${w.week} ("${w.phase}")`);
    if (weekdayName(d.date) !== d.weekday) {
      problems.push(`${d.date}: weekdag "${d.weekday}" klopt niet met de kalender`);
    }
    if (d.date < w.start_date || d.date > addDays(w.start_date, 6)) {
      problems.push(`${d.date} valt buiten week ${w.week} (start ${w.start_date})`);
    }
  }

  // Aaneengesloten reeks: geen gaten tussen de eerste en de laatste dag.
  const sorted = [...days].map((d) => d.date).sort();
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== addDays(sorted[i - 1] as string, 1)) {
      problems.push(`gat in de reeks tussen ${sorted[i - 1]} en ${sorted[i]}`);
    }
  }

  // Weektotaal is de som van de dagen. Afronding op 0,1 km toegestaan.
  for (const w of weeks) {
    const sum = days.filter((d) => d.week === w.week).reduce((t, d) => t + Number(d.planned_km), 0);
    if (Math.abs(sum - Number(w.target_km)) > 0.1) {
      problems.push(`week ${w.week}: dagen tellen op tot ${sum.toFixed(1)} km, doel is ${w.target_km} km`);
    }
  }

  return problems;
}
