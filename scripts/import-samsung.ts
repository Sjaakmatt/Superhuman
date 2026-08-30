/* Een Samsung Health-export inlezen. Eenmalig, geen koppeling.
 *
 *   npm run import:samsung -- <map> <athlete-id>
 *   npm run import:samsung -- <map> <athlete-id> --sql --zones=banden.json
 *
 * De map is de uitgepakte export: ergens daarin staat
 * com.samsung.shealth.exercise.<datum>.csv, en daarnaast de mappen met streams
 * (jsons/com.samsung.shealth.exercise) en hartslagmetingen
 * (jsons/com.samsung.shealth.tracker.heart_rate). Alle drie worden gezocht,
 * hoe diep ze ook zitten.
 *
 * Met --sql schrijft hij de opdrachten naar stdout in plaats van naar de
 * database — voor als je de service-role-sleutel niet bij de hand hebt. De
 * hartslagbanden komen dan uit --zones, want die staan normaal in de database.
 *
 * Idempotent: alles gaat via (athlete_id, source, external_id), dus twee keer
 * draaien levert geen tweede rij op. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { admin } from '@/lib/db';
import { zoneSeconds } from '@/lib/metrics';
import type { Zone } from '@/lib/types';

/* Alleen deze twee soorten zijn tegen de gegevens zelf gecontroleerd: type 1002
 * loopt op 6 à 7 minuten per kilometer, type 1001 op 12 à 14. De overige codes
 * van Samsung raden we niet — die worden 'Workout', met de code in `raw` zodat
 * je later alsnog kunt bijwerken zonder opnieuw te importeren. */
const SOORT: Record<string, { sport: string; naam: string }> = {
  '1001': { sport: 'Walk', naam: 'Wandeling' },
  '1002': { sport: 'Run', naam: 'Hardlopen' },
};
const ONBEKEND = { sport: 'Workout', naam: 'Training' };

const K = (veld: string) => `com.samsung.health.exercise.${veld}`;

type Rij = Record<string, string>;

/** Samsung schrijft op regel 1 de tabelnaam en pas op regel 2 de kolomkoppen. */
function leesCsv(pad: string): Rij[] {
  const tekst = readFileSync(pad, 'utf8').replace(/^﻿/, '');
  const regels = splitsRegels(tekst);
  const koppen = ontleedRegel(regels[1] ?? '');
  return regels.slice(2)
    .filter((r) => r.trim().length > 0)
    .map((regel) => {
      const velden = ontleedRegel(regel);
      const rij: Rij = {};
      koppen.forEach((kop, i) => { rij[kop] = velden[i] ?? ''; });
      return rij;
    });
}

/** Regels splitsen zonder de regeleindes binnen aanhalingstekens te knippen —
 *  een opmerking bij een training mag een enter bevatten. */
function splitsRegels(tekst: string): string[] {
  const uit: string[] = [];
  let huidig = '';
  let inQuote = false;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i];
    if (c === '"') inQuote = !inQuote;
    if (c === '\n' && !inQuote) { uit.push(huidig.replace(/\r$/, '')); huidig = ''; continue; }
    huidig += c;
  }
  if (huidig.trim()) uit.push(huidig.replace(/\r$/, ''));
  return uit;
}

function ontleedRegel(regel: string): string[] {
  const uit: string[] = [];
  let veld = '';
  let inQuote = false;
  for (let i = 0; i < regel.length; i++) {
    const c = regel[i];
    if (inQuote) {
      if (c === '"' && regel[i + 1] === '"') { veld += '"'; i++; continue; }
      if (c === '"') { inQuote = false; continue; }
      veld += c;
      continue;
    }
    if (c === '"') { inQuote = true; continue; }
    if (c === ',') { uit.push(veld); veld = ''; continue; }
    veld += c;
  }
  uit.push(veld);
  return uit;
}

function zoek(map: string, past: (naam: string) => boolean, diepte = 6): string | null {
  let items: string[];
  try { items = readdirSync(map); } catch { return null; }
  for (const naam of items) {
    const pad = join(map, naam);
    if (past(naam)) return pad;
  }
  if (diepte <= 0) return null;
  for (const naam of items) {
    const pad = join(map, naam);
    let isMap = false;
    try { isMap = statSync(pad).isDirectory(); } catch { continue; }
    if (!isMap) continue;
    const gevonden = zoek(pad, past, diepte - 1);
    if (gevonden) return gevonden;
  }
  return null;
}

/** Alle bestanden onder een map, ongeacht hoe diep. Samsung verdeelt de streams
 *  over zestien submappen op de eerste letter van het id. */
function alleBestanden(map: string): string[] {
  const uit: string[] = [];
  const loop = (m: string) => {
    let items: string[];
    try { items = readdirSync(m); } catch { return; }
    for (const naam of items) {
      const pad = join(m, naam);
      let s;
      try { s = statSync(pad); } catch { continue; }
      if (s.isDirectory()) loop(pad);
      else uit.push(pad);
    }
  };
  loop(map);
  return uit;
}

type Punt = { start_time?: number; heart_rate?: number };

/** De tijd in de export staat in UTC; de verschuiving staat er los bij als
 *  "UTC+0200". Een trainingsdag is een kalenderdag, dus we rekenen eerst om
 *  naar lokale tijd en knippen daar de datum uit. */
function lokaal(utc: string, offset: string): { datum: string; start: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(utc);
  if (!m) return null;
  const [, jaar, maand, dag, uur, min, sec] = m;
  const ms = Date.UTC(Number(jaar), Number(maand) - 1, Number(dag), Number(uur), Number(min), Number(sec));
  const o = /^UTC([+-])(\d{2})(\d{2})$/.exec(offset.trim());
  const verschil = o ? (o[1] === '-' ? -1 : 1) * (Number(o[2]) * 60 + Number(o[3])) * 60_000 : 0;
  const d = new Date(ms + verschil);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    datum: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    start: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`,
  };
}

const getal = (v: string | undefined): number | null => {
  if (!v || !v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export type Sessie = {
  external_id: string;
  date: string;
  start_local: string;
  sport_type: string;
  name: string;
  distance_m: number | null;
  moving_s: number | null;
  elapsed_s: number | null;
  elev_gain_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_cadence: number | null;
  calories: number | null;
  raw: Record<string, unknown>;
  zones: Record<string, number>;
};

export function leesSessies(map: string, bands: Zone[]): Sessie[] {
  const csv = zoek(map, (n) => /^com\.samsung\.shealth\.exercise\.\d+\.csv$/.test(n));
  if (!csv) throw new Error('Geen com.samsung.shealth.exercise.<datum>.csv gevonden onder ' + map);

  const streamMap = zoek(map, (n) => n === 'com.samsung.shealth.exercise');
  const streams = new Map<string, string>();
  if (streamMap) {
    for (const pad of alleBestanden(streamMap)) {
      const m = /([0-9a-f-]{36})\.com\.samsung\.health\.exercise\.live_data\.json$/.exec(pad);
      if (m?.[1]) streams.set(m[1], pad);
    }
  }

  const uit: Sessie[] = [];
  for (const rij of leesCsv(csv)) {
    const id = (rij[K('datauuid')] ?? '').trim();
    const tijd = lokaal(rij[K('start_time')] ?? '', rij[K('time_offset')] ?? '');
    if (!id || !tijd) continue;

    const type = (rij[K('exercise_type')] ?? '').trim();
    const soort = SOORT[type] ?? ONBEKEND;
    const titel = (rij['title'] ?? '').trim();

    const duurMs = getal(rij[K('duration')]);
    const eind = lokaal(rij[K('end_time')] ?? '', rij[K('time_offset')] ?? '');
    const elapsed = eind ? Math.round((Date.parse(eind.start + 'Z') - Date.parse(tijd.start + 'Z')) / 1000) : null;

    uit.push({
      external_id: id,
      date: tijd.datum,
      start_local: tijd.start,
      sport_type: soort.sport,
      name: titel || soort.naam,
      distance_m: getal(rij[K('distance')]),
      moving_s: duurMs === null ? null : Math.round(duurMs / 1000),
      elapsed_s: elapsed,
      elev_gain_m: getal(rij[K('altitude_gain')]),
      avg_hr: getal(rij[K('mean_heart_rate')]),
      max_hr: getal(rij[K('max_heart_rate')]),
      avg_cadence: getal(rij[K('mean_cadence')]),
      calories: getal(rij[K('calorie')]) ?? getal(rij['total_calorie']),
      raw: { bron: 'samsung_health', samsung_type: type, min_heart_rate: getal(rij[K('min_heart_rate')]) },
      zones: streamZones(streams.get(id), bands),
    });
  }
  uit.sort((a, b) => a.start_local.localeCompare(b.start_local));
  return uit;
}

/** De zoneverdeling uit de stream. Samsung meet ongeveer elke seconde; we
 *  gebruiken dezelfde telling als bij Strava (lib/metrics), met de tijd in
 *  seconden vanaf het begin van de sessie. */
function streamZones(pad: string | undefined, bands: Zone[]): Record<string, number> {
  if (!pad || !bands.length) return {};
  let punten: Punt[];
  try { punten = JSON.parse(readFileSync(pad, 'utf8')) as Punt[]; } catch { return {}; }
  const met = punten
    .filter((p): p is { start_time: number; heart_rate: number } =>
      typeof p.start_time === 'number' && typeof p.heart_rate === 'number' && p.heart_rate > 0)
    .sort((a, b) => a.start_time - b.start_time);
  if (met.length < 2) return {};
  const begin = met[0]!.start_time;
  const tijd = met.map((p) => Math.round((p.start_time - begin) / 1000));
  const hr = met.map((p) => p.heart_rate);
  const seconden = zoneSeconds(tijd, hr, bands);
  return Object.fromEntries(Object.entries(seconden).map(([k, v]) => [k, Math.round(v)]));
}

/** De rustpols per dag. Samsung levert geen rustpols als veld; wij nemen de
 *  laagste gemeten hartslag van de kalenderdag. Dat is een eigen definitie —
 *  zie CLAUDE.md. */
export function leesRustpols(map: string): { date: string; resting_hr: number }[] {
  const hrMap = zoek(map, (n) => n === 'com.samsung.shealth.tracker.heart_rate');
  if (!hrMap) return [];
  const perDag = new Map<string, number>();
  for (const pad of alleBestanden(hrMap)) {
    if (!pad.endsWith('.json')) continue;
    let punten: { start_time?: number; heart_rate?: number; heart_rate_min?: number }[];
    try { punten = JSON.parse(readFileSync(pad, 'utf8')) as typeof punten; } catch { continue; }
    if (!Array.isArray(punten)) continue;
    for (const p of punten) {
      const hr = p.heart_rate_min ?? p.heart_rate;
      if (typeof p.start_time !== 'number' || typeof hr !== 'number' || hr <= 0) continue;
      // De meting draagt een epoch; de dag is de lokale dag in Amsterdam.
      const dag = new Date(p.start_time).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
      const laagste = perDag.get(dag);
      if (laagste === undefined || hr < laagste) perDag.set(dag, hr);
    }
  }
  return [...perDag.entries()].sort().map(([date, resting_hr]) => ({ date, resting_hr: Math.round(resting_hr) }));
}

// ── schrijven ───────────────────────────────────────────────────────────────

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
const n = (v: number | null) => (v === null ? 'null' : String(v));

function naarSql(athleteId: string, sessies: Sessie[], rust: { date: string; resting_hr: number }[]): string {
  const regels: string[] = [];
  const kolommen = 'athlete_id, source, external_id, date, start_local, sport_type, name, distance_m, moving_s, elapsed_s, elev_gain_m, avg_hr, max_hr, avg_cadence, calories, raw, streams_synced_at';
  const waarden = sessies.map((s) => `(${q(athleteId)}, 'samsung', ${q(s.external_id)}, ${q(s.date)}, ${q(s.start_local)}, ${q(s.sport_type)}, ${q(s.name)}, ${n(s.distance_m)}, ${n(s.moving_s)}, ${n(s.elapsed_s)}, ${n(s.elev_gain_m)}, ${n(s.avg_hr)}, ${n(s.max_hr)}, ${n(s.avg_cadence)}, ${n(s.calories)}, ${q(JSON.stringify(s.raw))}::jsonb, ${Object.keys(s.zones).length ? 'now()' : 'null'})`);
  regels.push(`insert into activity (${kolommen})\nvalues\n  ${waarden.join(',\n  ')}\non conflict (athlete_id, source, external_id) do update set\n  date = excluded.date, start_local = excluded.start_local, sport_type = excluded.sport_type,\n  name = excluded.name, distance_m = excluded.distance_m, moving_s = excluded.moving_s,\n  elapsed_s = excluded.elapsed_s, elev_gain_m = excluded.elev_gain_m, avg_hr = excluded.avg_hr,\n  max_hr = excluded.max_hr, avg_cadence = excluded.avg_cadence, calories = excluded.calories,\n  raw = excluded.raw, streams_synced_at = excluded.streams_synced_at;`);

  const zoneRijen = sessies.flatMap((s) =>
    Object.entries(s.zones).map(([zone, sec]) => `(${q(s.external_id)}, ${q(zone)}, ${sec})`));
  if (zoneRijen.length) {
    regels.push(`insert into activity_zone (activity_id, zone, seconds)\nselect a.id, z.zone, z.seconds\nfrom (values\n  ${zoneRijen.join(',\n  ')}\n) as z(external_id, zone, seconds)\njoin activity a on a.athlete_id = ${q(athleteId)} and a.source = 'samsung' and a.external_id = z.external_id\non conflict (activity_id, zone) do update set seconds = excluded.seconds;`);
  }

  if (rust.length) {
    const r = rust.map((x) => `(${q(athleteId)}, ${q(x.date)}, ${x.resting_hr})`);
    regels.push(`insert into wellness (athlete_id, date, resting_hr)\nvalues\n  ${r.join(',\n  ')}\non conflict (athlete_id, date) do update set resting_hr = coalesce(wellness.resting_hr, excluded.resting_hr);`);
  }

  return regels.join('\n\n');
}

async function main() {
  const args = process.argv.slice(2);
  const map = args[0];
  const athleteId = args[1];
  const alleenSql = args.includes('--sql');
  const zonesArg = args.find((a) => a.startsWith('--zones='))?.slice('--zones='.length);

  if (!map || !athleteId) {
    console.error('Gebruik: npm run import:samsung -- <map> <athlete-id> [--sql --zones=banden.json]');
    process.exit(1);
  }

  let bands: Zone[] = [];
  if (zonesArg) {
    bands = JSON.parse(readFileSync(zonesArg, 'utf8')) as Zone[];
  } else if (!alleenSql) {
    const { data } = await admin().from('athlete').select('hr_zones').eq('id', athleteId).maybeSingle();
    bands = ((data as { hr_zones: Zone[] } | null)?.hr_zones ?? []);
  }
  if (!bands.length) console.error('Let op: geen hartslagbanden, dus geen zoneverdeling.');

  const sessies = leesSessies(map, bands);
  const rust = leesRustpols(map);

  if (alleenSql) {
    console.log(naarSql(athleteId, sessies, rust));
    console.error(`${sessies.length} sessies, ${rust.length} dagen rustpols.`);
    return;
  }

  const sb = admin();
  for (const s of sessies) {
    const { data, error } = await sb.from('activity').upsert({
      athlete_id: athleteId, source: 'samsung', external_id: s.external_id,
      date: s.date, start_local: s.start_local, sport_type: s.sport_type, name: s.name,
      distance_m: s.distance_m, moving_s: s.moving_s, elapsed_s: s.elapsed_s,
      elev_gain_m: s.elev_gain_m, avg_hr: s.avg_hr, max_hr: s.max_hr,
      avg_cadence: s.avg_cadence, calories: s.calories, raw: s.raw,
      streams_synced_at: Object.keys(s.zones).length ? new Date().toISOString() : null,
    }, { onConflict: 'athlete_id,source,external_id' }).select('id').maybeSingle();
    if (error) { console.error(s.date, error.message); continue; }
    const id = (data as { id: number } | null)?.id;
    if (id && Object.keys(s.zones).length) {
      await sb.from('activity_zone').upsert(
        Object.entries(s.zones).map(([zone, seconds]) => ({ activity_id: id, zone, seconds })),
        { onConflict: 'activity_id,zone' },
      );
    }
  }
  for (const r of rust) {
    await sb.from('wellness').upsert({ athlete_id: athleteId, date: r.date, resting_hr: r.resting_hr },
      { onConflict: 'athlete_id,date', ignoreDuplicates: false });
  }
  console.log(`Klaar: ${sessies.length} sessies, ${rust.length} dagen rustpols.`);
}

// Alleen draaien als je hem zelf aanroept: zo kan een test de leesfuncties
// importeren zonder dat het script meteen gaat schrijven.
if (process.argv[1] && /import-samsung\.ts$/.test(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
