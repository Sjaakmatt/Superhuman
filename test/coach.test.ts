import { describe, expect, it } from 'vitest';
import { TOOLS, knip } from '@/lib/coach';

const VANDAAG = '2026-08-29';

describe('knip', () => {
  it('valt terug op de laatste veertien dagen zonder geldig bereik', () => {
    expect(knip(undefined, undefined, VANDAAG)).toEqual(['2026-08-16', '2026-08-29']);
    expect(knip('gisteren', 'morgen', VANDAAG)).toEqual(['2026-08-16', '2026-08-29']);
  });

  it('laat een gewoon bereik met rust', () => {
    expect(knip('2026-08-01', '2026-08-29', VANDAAG)).toEqual(['2026-08-01', '2026-08-29']);
  });

  it('draait een omgekeerd bereik om', () => {
    expect(knip('2026-08-29', '2026-08-01', VANDAAG)).toEqual(['2026-08-01', '2026-08-29']);
  });

  it('knipt een te lang bereik terug tot honderdtwintig dagen', () => {
    const [van, tot] = knip('2026-01-01', '2026-08-29', VANDAAG);
    expect(tot).toBe('2026-08-29');
    expect(van).toBe('2026-05-01');
  });
});

describe('gereedschappen', () => {
  it('hebben een unieke naam en een objectschema', () => {
    const namen = TOOLS.map((t) => t.name);
    expect(new Set(namen).size).toBe(namen.length);
    for (const tool of TOOLS) {
      expect(tool.input_schema.type).toBe('object');
      expect(tool.description?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it('zijn alleen lezend — geen naam die iets wijzigt', () => {
    for (const tool of TOOLS) {
      expect(tool.name).not.toMatch(/schrijf|wijzig|verwijder|pas_aan|update|insert|delete/);
    }
  });
});
