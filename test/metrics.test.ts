import { describe, expect, it } from 'vitest';
import {
  adherence,
  descentMeters,
  descentSeconds,
  distribution,
  weekJump,
  weightChangePerWeek,
  wellnessTrend,
  z2Drift,
  zoneSeconds,
} from '@/lib/metrics';
import { referenceSeed } from '@/lib/seed-files';
import { addDays } from '@/lib/date';

/** Een stukje echte stream: 60 s vlak, 120 s afdaling van −7%, 60 s klim.
 *  Strava bemonstert onregelmatig, dus de tijdstappen zijn ongelijk. */
function trail() {
  const time: number[] = [];
  const grade: number[] = [];
  const altitude: number[] = [];
  let t = 0;
  let alt = 400;
  const push = (g: number, dt: number) => {
    t += dt;
    alt += (-g / 100) * 0; // hoogte zetten we los, zie hieronder
    time.push(t);
    grade.push(g);
    altitude.push(alt);
  };
  push(0, 0);
  for (let i = 0; i < 12; i++) push(0.5, 5); // 60 s vlak
  for (let i = 0; i < 20; i++) {
    alt -= 4.2; // 6 m/s bij −7% over 6 s ≈ 4,2 m daling
    time.push((t += 6));
    grade.push(-7);
    altitude.push(alt);
  }
  for (let i = 0; i < 10; i++) {
    alt += 3;
    time.push((t += 6));
    grade.push(6);
    altitude.push(alt);
  }
  return { time, grade, altitude };
}

describe('afdaalminuten', () => {
  it('telt alleen seconden steiler dan -4%', () => {
    const { time, grade } = trail();
    expect(descentSeconds(time, grade)).toBe(120);
  });

  it('telt de bijbehorende hoogtemeters', () => {
    const { altitude, grade } = trail();
    expect(descentMeters(altitude, grade)).toBe(84);
  });

  it('telt niets op een vlakke loop', () => {
    expect(descentSeconds([0, 5, 10, 15], [0, -1, -3.9, 0])).toBe(0);
  });

  it('overleeft een lege stream', () => {
    expect(descentSeconds([], [])).toBe(0);
  });
});

describe('zoneverdeling', () => {
  const bands = referenceSeed().zones.bands;

  it('deelt seconden in op de zones uit de referentie', () => {
    const time = [0, 10, 20, 30, 40];
    const hr = [0, 110, 140, 140, 175];
    expect(zoneSeconds(time, hr, bands)).toEqual({ Z1: 10, Z2: 20, Z4: 10 });
  });

  it('levert een lege verdeling zonder hartslag', () => {
    expect(distribution(zoneSeconds([0, 10], [], bands))).toEqual({ z1_z2: 0, z3: 0, z4_z5: 0, seconds: 0 });
  });

  it('rekent aandelen uit die optellen tot 1', () => {
    const d = distribution({ Z1: 300, Z2: 4500, Z3: 900, Z4: 300 });
    expect(d.z1_z2 + d.z3 + d.z4_z5).toBeCloseTo(1);
    expect(d.z1_z2).toBeCloseTo(0.8);
  });
});

describe('weeksprong', () => {
  const v = new Map([
    [10, 70],
    [11, 40],
    [12, 72],
  ]);

  it('vergelijkt met de zwaarste van twee weken, niet met de deloadweek', () => {
    expect(weekJump(v, 12)).toBeCloseTo(72 / 70);
  });

  it('is null zonder twee voorgaande weken', () => {
    expect(weekJump(new Map([[12, 72]]), 12)).toBeNull();
  });
});

describe('Z2-drift', () => {
  it('negeert sessies korter dan twintig minuten', () => {
    const drift = z2Drift(
      [
        { date: '2027-01-01', avg_hr: 180, minutes: 8 },
        { date: '2027-01-03', avg_hr: 150, minutes: 60 },
      ],
      152,
    );
    expect(drift).toBe(-2);
  });

  it('is null zonder bruikbare sessies', () => {
    expect(z2Drift([], 152)).toBeNull();
  });
});

describe('welzijnstrend', () => {
  const today = '2027-03-01';
  const rows = Array.from({ length: 40 }, (_, i) => ({ date: addDays(today, -(39 - i)), total: 28 }));

  it('vergelijkt de laatste week met een basislijn die die week niet bevat', () => {
    for (const r of rows) if (r.date > addDays(today, -7)) r.total = 20;
    const t = wellnessTrend(rows, today);
    expect(t.baseline).toBe(28);
    expect(t.last7!).toBeLessThan(t.baseline!);
  });
});

describe('gewicht en adherentie', () => {
  it('rekent gewichtsverlies om naar procent per week', () => {
    const rows = [
      { date: '2027-01-01', weight_kg: 75 },
      { date: '2027-01-15', weight_kg: 73.5 },
    ];
    expect(weightChangePerWeek(rows, '2027-01-15', 21)!).toBeCloseTo(-0.01, 3);
  });

  it('kapt een extra krachtsessie af op honderd procent', () => {
    expect(adherence([{ done: 5, planned: 3 }, { done: 0, planned: 3 }])).toBeCloseTo(0.5);
  });
});
