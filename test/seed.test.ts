import { describe, expect, it } from 'vitest';
import { planSeed, referenceSeed } from '@/lib/seed-files';
import { checkSeed } from '@/lib/seed-check';
import { phaseForWeek } from '@/lib/plan';

describe('plan-seed', () => {
  const seed = planSeed();

  it('bevat 57 weken en 399 dagen', () => {
    expect(seed.weeks).toHaveLength(57);
    expect(seed.days).toHaveLength(399);
  });

  it('doorstaat alle integriteitscontroles', () => {
    expect(checkSeed(seed)).toEqual([]);
  });

  it('loopt van de startdatum tot en met de dag na de wedstrijd', () => {
    expect(seed.days[0]?.date).toBe(seed.meta.start);
    expect(seed.days.at(-1)?.date).toBe('2027-10-03');
    expect(seed.weeks.at(-1)?.status).toBe('WEDSTRIJD');
  });
});

describe('reference-seed', () => {
  const ref = referenceSeed();

  it('dekt alle 57 weken met een krachtfase en een voedingsschema', () => {
    for (let w = 1; w <= 57; w++) {
      expect(phaseForWeek(ref.strength_phases, w), `krachtfase week ${w}`).not.toBeNull();
      expect(phaseForWeek(ref.fueling_by_week, w), `voeding week ${w}`).not.toBeNull();
    }
  });

  it('heeft aaneensluitende, oplopende hartslagzones', () => {
    const bands = ref.zones.bands;
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.hr_min).toBe(bands[i - 1]!.hr_max + 1);
    }
    expect(bands[0]!.hr_min).toBe(0);
  });

  it('koppelt elke mijlpaal aan een bestaande week', () => {
    const weeks = new Set(planSeed().weeks.map((w) => w.week));
    for (const m of ref.milestones) expect(weeks.has(m.week), m.title).toBe(true);
  });
});
