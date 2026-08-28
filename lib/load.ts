import type { PlanDay } from '@/lib/types';

/** De belastingschaal uit tokens.css (--l0 t/m --l4) in vijf stappen.
 *  Onze eigen indeling, alleen voor kleur — nooit voor een beslissing.
 *  Basis is de geplande afstand; een intensieve zone telt één stap zwaarder. */
export function loadLevel(day: Pick<PlanDay, 'planned_km' | 'zone'>): 0 | 1 | 2 | 3 | 4 {
  const km = Number(day.planned_km) || 0;
  let level: number;
  if (km === 0) level = 0;
  else if (km <= 8) level = 1;
  else if (km <= 15) level = 2;
  else if (km <= 24) level = 3;
  else level = 4;

  const hard = day.zone && /Z3|Z4|UP/.test(day.zone);
  if (hard && level > 0 && level < 4) level += 1;
  return level as 0 | 1 | 2 | 3 | 4;
}

export function loadColor(level: number): string {
  return `var(--l${Math.max(0, Math.min(4, Math.round(level)))})`;
}

/** Tekst op een vlak van de belastingschaal: op de twee donkerste stappen
 *  keert het contrast om. */
export function loadInk(level: number): string {
  return level >= 3 ? 'var(--acc-ink)' : 'var(--ink2)';
}
