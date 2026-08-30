import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/* Een upsert wijst met `onConflict` een unieke sleutel aan. Bestaat die niet,
 * dan weigert Postgres met "no unique or exclusion constraint matching the ON
 * CONFLICT specification" — en dat merk je pas als iemand op opslaan drukt.
 *
 * Dit is precies wat er gebeurde toen de sleutel van `wellness` van `date`
 * naar (athlete_id, date) ging en de ochtendcheck bleef wijzen naar de oude:
 * elke opslag mislukte, maanden lang, zonder dat een test iets zei.
 *
 * Deze test leest de migraties, houdt de unieke sleutels per tabel bij, en
 * legt daar elke onConflict in de broncode naast. */

const WORTEL = join(__dirname, '..');

type Sleutels = Map<string, Set<string>>;

const sorteer = (kolommen: string) =>
  kolommen
    .split(',')
    .map((k) => k.trim().replace(/"/g, ''))
    .filter(Boolean)
    .sort()
    .join(',');

/** De unieke sleutels per tabel, opgebouwd in migratievolgorde: een latere
 *  migratie mag een primaire sleutel vervangen. */
function leesMigraties(): Sleutels {
  const map = join(WORTEL, 'supabase', 'migrations');
  const uniek: Sleutels = new Map();
  const pkey = new Map<string, string>();
  const zet = (tabel: string, sleutel: string) => {
    const set = uniek.get(tabel) ?? new Set<string>();
    set.add(sleutel);
    uniek.set(tabel, set);
  };

  for (const bestand of readdirSync(map).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(map, bestand), 'utf8').toLowerCase();

    // create table … ( … primary key (a, b) … ) en kolommen met "primary key"
    for (const m of sql.matchAll(/create table if not exists (\w+)\s*\(([\s\S]*?)\n\);/g)) {
      const tabel = m[1]!;
      const body = m[2]!;
      const samen = /primary key\s*\(([^)]+)\)/.exec(body);
      if (samen) {
        pkey.set(tabel, sorteer(samen[1]!));
        zet(tabel, sorteer(samen[1]!));
      } else {
        for (const kolom of body.split('\n')) {
          const k = /^\s*(\w+)\s+[^,]*\bprimary key\b/.exec(kolom);
          if (k) {
            pkey.set(tabel, k[1]!);
            zet(tabel, k[1]!);
          }
        }
      }
      for (const u of body.matchAll(/^\s*unique\s*\(([^)]+)\)/gm)) zet(tabel, sorteer(u[1]!));
    }

    for (const m of sql.matchAll(/alter table (\w+)\s+drop constraint if exists \w*_pkey/g)) {
      const oud = pkey.get(m[1]!);
      if (oud) uniek.get(m[1]!)?.delete(oud);
    }
    for (const m of sql.matchAll(/alter table (\w+)\s+add primary key\s*\(([^)]+)\)/g)) {
      pkey.set(m[1]!, sorteer(m[2]!));
      zet(m[1]!, sorteer(m[2]!));
    }
    for (const m of sql.matchAll(/create unique index (?:if not exists )?\w+\s+on (\w+)\s*\(([^)]+)\)/g)) {
      zet(m[1]!, sorteer(m[2]!));
    }
    for (const m of sql.matchAll(/alter table (\w+)\s+add constraint \w+ unique\s*\(([^)]+)\)/g)) {
      zet(m[1]!, sorteer(m[2]!));
    }
    for (const m of sql.matchAll(/drop table if exists (\w+)/g)) uniek.delete(m[1]!);
  }
  return uniek;
}

/** Elke `.from('tabel')` … `onConflict: 'a,b'` in de broncode. De upsert staat
 *  soms een paar regels na de from, dus we kijken vooruit in hetzelfde blok. */
function leesUpserts(): { bestand: string; tabel: string; sleutel: string }[] {
  const uit: { bestand: string; tabel: string; sleutel: string }[] = [];
  const loop = (map: string) => {
    for (const naam of readdirSync(map, { withFileTypes: true })) {
      const pad = join(map, naam.name);
      if (naam.isDirectory()) {
        if (naam.name === 'node_modules' || naam.name.startsWith('.')) continue;
        loop(pad);
        continue;
      }
      if (!/\.tsx?$/.test(naam.name)) continue;
      const tekst = readFileSync(pad, 'utf8');
      for (const m of tekst.matchAll(/\.from\(\s*'(\w+)'\s*\)([\s\S]{0,900}?)onConflict:\s*'([^']+)'/g)) {
        // Alleen als er geen tweede .from( tussen zit: dan hoort de onConflict
        // bij die andere tabel.
        if (m[2]!.includes(".from(")) continue;
        uit.push({ bestand: pad.slice(WORTEL.length + 1), tabel: m[1]!, sleutel: sorteer(m[3]!) });
      }
    }
  };
  for (const map of ['lib', 'app', 'scripts']) loop(join(WORTEL, map));
  return uit;
}

describe('elke onConflict wijst naar een bestaande unieke sleutel', () => {
  const sleutels = leesMigraties();
  const upserts = leesUpserts();

  it('vindt de upserts in de broncode', () => {
    expect(upserts.length).toBeGreaterThan(8);
  });

  it.each(upserts.map((u) => [`${u.bestand}: ${u.tabel} (${u.sleutel})`, u] as const))(
    '%s',
    (_naam, u) => {
      const bekend = sleutels.get(u.tabel);
      expect(bekend, `geen unieke sleutel bekend voor ${u.tabel}`).toBeDefined();
      expect([...bekend!]).toContain(u.sleutel);
    },
  );
});
