import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { leesRustpols, leesSessies } from '@/scripts/import-samsung';
import type { Zone } from '@/lib/types';

/* De import van een Samsung-export. Wat hier fout gaat, gaat stil fout: een
 * sessie op de verkeerde dag, of een wandeling die als duurloop in het logboek
 * belandt. */

const BANDEN: Zone[] = [
  { key: 'Z1', name: 'Herstel', hr_min: 0, hr_max: 122, pace: '' },
  { key: 'Z2', name: 'Duurloop', hr_min: 123, hr_max: 152, pace: '' },
  { key: 'Z3', name: 'Steady', hr_min: 153, hr_max: 167, pace: '' },
];

const KOP = 'com.samsung.shealth.exercise,7006003,17';
const KOLOMMEN = [
  'title',
  'com.samsung.health.exercise.datauuid',
  'com.samsung.health.exercise.exercise_type',
  'com.samsung.health.exercise.start_time',
  'com.samsung.health.exercise.end_time',
  'com.samsung.health.exercise.time_offset',
  'com.samsung.health.exercise.duration',
  'com.samsung.health.exercise.distance',
  'com.samsung.health.exercise.mean_heart_rate',
  'com.samsung.health.exercise.max_heart_rate',
  'com.samsung.health.exercise.altitude_gain',
  'com.samsung.health.exercise.calorie',
].join(',');

const LOOP = 'aaaaaaaa-0000-0000-0000-000000000001';
const WANDEL = 'bbbbbbbb-0000-0000-0000-000000000002';
const ONBEKEND = 'cccccccc-0000-0000-0000-000000000003';

function maakExport(): string {
  const map = mkdtempSync(join(tmpdir(), 'samsung-'));
  const rijen = [
    KOP,
    KOLOMMEN,
    // Om 22:40 UTC met UTC+0200 erbij is het de volgende dag om 00:40 lokaal.
    `,${LOOP},1002,2026-06-14 22:40:00.000,2026-06-14 23:10:00.000,UTC+0200,1800000,5000,140,168,25,400`,
    `Ochtendrondje,${WANDEL},1001,2026-06-15 08:00:00.000,2026-06-15 08:20:00.000,UTC+0200,1200000,1500,,,,90`,
    `,${ONBEKEND},11007,2026-06-16 10:00:00.000,2026-06-16 10:10:00.000,UTC+0200,600000,,,,,60`,
  ];
  writeFileSync(join(map, 'com.samsung.shealth.exercise.20260829202704.csv'), rijen.join('\n'));

  const streams = join(map, 'jsons', 'com.samsung.shealth.exercise', 'a');
  mkdirSync(streams, { recursive: true });
  // Vier metingen van een seconde uit elkaar: 120 (Z1), 130 en 140 (Z2), 160 (Z3).
  const begin = Date.UTC(2026, 5, 14, 22, 40, 0);
  const punten = [120, 130, 140, 160].map((hr, i) => ({ heart_rate: hr, start_time: begin + i * 1000 }));
  writeFileSync(join(streams, `${LOOP}.com.samsung.health.exercise.live_data.json`), JSON.stringify(punten));

  const hr = join(map, 'jsons', 'com.samsung.shealth.tracker.heart_rate', '0');
  mkdirSync(hr, { recursive: true });
  writeFileSync(join(hr, 'dag.json'), JSON.stringify([
    { heart_rate: 70, heart_rate_min: 52, start_time: Date.UTC(2026, 5, 15, 6, 0, 0) },
    { heart_rate: 60, heart_rate_min: 48, start_time: Date.UTC(2026, 5, 15, 7, 0, 0) },
    // 23:30 UTC op de 15e is 01:30 lokaal op de 16e.
    { heart_rate: 55, heart_rate_min: 44, start_time: Date.UTC(2026, 5, 15, 23, 30, 0) },
  ]));

  return map;
}

describe('import van een Samsung-export', () => {
  const sessies = leesSessies(maakExport(), BANDEN);

  it('leest elke rij uit de csv', () => {
    expect(sessies).toHaveLength(3);
  });

  it('rekent de tijd om naar lokaal, dus naar de goede kalenderdag', () => {
    const loop = sessies.find((s) => s.external_id === LOOP)!;
    expect(loop.start_local).toBe('2026-06-15T00:40:00');
    expect(loop.date).toBe('2026-06-15');
  });

  it('vertaalt alleen de soorten die we kennen', () => {
    const perId = new Map(sessies.map((s) => [s.external_id, s]));
    expect(perId.get(LOOP)?.sport_type).toBe('Run');
    expect(perId.get(WANDEL)?.sport_type).toBe('Walk');
    // Een code die we niet hebben gecontroleerd raden we niet.
    expect(perId.get(ONBEKEND)?.sport_type).toBe('Workout');
    expect(perId.get(ONBEKEND)?.raw.samsung_type).toBe('11007');
  });

  it('houdt de eigen titel aan als die er staat', () => {
    const perId = new Map(sessies.map((s) => [s.external_id, s]));
    expect(perId.get(WANDEL)?.name).toBe('Ochtendrondje');
    expect(perId.get(LOOP)?.name).toBe('Hardlopen');
  });

  it('neemt de getallen over zoals ze er staan', () => {
    const loop = sessies.find((s) => s.external_id === LOOP)!;
    expect(loop.distance_m).toBe(5000);
    expect(loop.moving_s).toBe(1800);
    expect(loop.elapsed_s).toBe(1800);
    expect(loop.avg_hr).toBe(140);
    expect(loop.max_hr).toBe(168);
    expect(loop.elev_gain_m).toBe(25);
  });

  it('telt de zoneverdeling uit de stream', () => {
    const loop = sessies.find((s) => s.external_id === LOOP)!;
    // Drie stappen van een seconde, geteld op de hartslag aan het eind ervan.
    expect(loop.zones).toEqual({ Z2: 2, Z3: 1 });
  });

  it('laat sessies zonder stream leeg in plaats van te schatten', () => {
    const wandel = sessies.find((s) => s.external_id === WANDEL)!;
    expect(wandel.zones).toEqual({});
  });
});

describe('rustpols uit de hartslagmetingen', () => {
  const rust = leesRustpols(maakExport());
  it('kiest de laagste meting per lokale kalenderdag', () => {
    expect(rust).toEqual([
      { date: '2026-06-15', resting_hr: 48 },
      { date: '2026-06-16', resting_hr: 44 },
    ]);
  });
});
