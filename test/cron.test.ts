import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* De cron-configuratie staat op twee plekken: welke schema's bestaan
 * (wrangler.jsonc) en welke route erbij hoort (worker.ts). Lopen die uit elkaar,
 * dan vuurt de cron wel maar gebeurt er niets — en dat merk je pas als een
 * analyse een week lang uitblijft. Deze test houdt ze gelijk.
 *
 * Er is nog een val: Cloudflare telt weekdagen van 1 = zondag tot 7 = zaterdag,
 * terwijl de meeste cron-systemen bij 0 = zondag beginnen. Een 0 weigert
 * Cloudflare bij het deployen, maar een 5 zou stilzwijgend donderdag betekenen
 * in plaats van vrijdag. Vandaar de eis van drieletterafkortingen. */

/** Haalt commentaar en trailing komma's uit JSONC, met respect voor strings. */
function parseJsonc<T>(source: string): T {
  let out = '';
  let inString = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (inString) {
      out += c;
      if (c === '\\') out += source[++i] ?? '';
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
    } else if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      out += '\n';
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1')) as T;
}

const wrangler = parseJsonc<{ triggers: { crons: string[] } }>(readFileSync('wrangler.jsonc', 'utf8'));
const worker = readFileSync('worker.ts', 'utf8');

/** De sleutels van CRON_ROUTES uit worker.ts. */
function routeKeys(): string[] {
  const block = /const CRON_ROUTES = \{([\s\S]*?)\n\};/.exec(worker);
  expect(block, 'CRON_ROUTES niet gevonden in worker.ts').not.toBeNull();
  return [...block![1]!.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]!);
}

describe('cron-configuratie', () => {
  it('koppelt elke trigger uit wrangler.jsonc aan een route in worker.ts', () => {
    expect([...routeKeys()].sort()).toEqual([...wrangler.triggers.crons].sort());
  });

  it('heeft vijf schema\'s, één per geplande taak', () => {
    expect(wrangler.triggers.crons).toHaveLength(5);
  });

  it('gebruikt vijf velden per expressie', () => {
    for (const cron of wrangler.triggers.crons) {
      expect(cron.trim().split(/\s+/), cron).toHaveLength(5);
    }
  });

  it('schrijft weekdagen voluit, want Cloudflare telt 1 = zondag', () => {
    for (const cron of wrangler.triggers.crons) {
      const weekdag = cron.trim().split(/\s+/)[4]!;
      expect(weekdag, `${cron}: gebruik MON…SUN of *, geen cijfer`).toMatch(
        /^(\*|MON|TUE|WED|THU|FRI|SAT|SUN)$/,
      );
    }
  });

  it('verwijst alleen naar routes die echt bestaan', () => {
    const block = /const CRON_ROUTES = \{([\s\S]*?)\n\};/.exec(worker)![1]!;
    const routes = [...block.matchAll(/'(\/api\/[^']+)'/g)].map((m) => m[1]!);
    expect(routes).toHaveLength(5);

    for (const route of routes) {
      const pad = route.replace(/^\//, '');
      // Dynamische segmenten: /api/insight/weekly wordt afgehandeld door
      // app/api/insight/[kind]/route.ts.
      const map = pad.split('/').slice(0, -1).join('/');
      const bestaat = existsSync(`app/${pad}/route.ts`) || existsSync(`app/${map}/[kind]/route.ts`);
      expect(bestaat, `geen route handler voor ${route}`).toBe(true);
    }
  });
});
