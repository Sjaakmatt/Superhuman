import { describe, expect, it } from 'vitest';
import { isDezelfdeSessie, leesPayload, OVERGENOMEN } from '@/lib/ingest';

const training = {
  externalId: 'hc-123',
  bron: 'com.sec.android.app.shealth',
  datum: '2026-09-14',
  startLokaal: '2026-09-14T07:12:00',
  sportType: 'Run',
  titel: 'Ochtendloop',
  duurSec: 3120,
  afstandM: 9400,
  stijgingM: 42,
  kcal: 620,
  hartslagGem: 139,
  hartslagMax: 151,
};

const leeg = { trainingen: [], dagen: [], verwijderd: [] };

describe('leesPayload', () => {
  it('neemt een volledige training over', () => {
    const uit = leesPayload({ ...leeg, trainingen: [training] });
    expect(uit.ok).toBe(true);
    if (!uit.ok) return;
    expect(uit.payload.trainingen[0]).toMatchObject({ externalId: 'hc-123', duurSec: 3120, hartslagGem: 139 });
  });

  it('weigert wat geen lijst is', () => {
    expect(leesPayload(null).ok).toBe(false);
    expect(leesPayload({ trainingen: {}, dagen: [], verwijderd: [] }).ok).toBe(false);
    expect(leesPayload({ ...leeg, trainingen: [{ ...training, externalId: '' }] }).ok).toBe(false);
  });

  it('eist een kalenderdatum en een lokaal tijdstip', () => {
    expect(leesPayload({ ...leeg, trainingen: [{ ...training, datum: '14-09-2026' }] }).ok).toBe(false);
    expect(leesPayload({ ...leeg, trainingen: [{ ...training, startLokaal: '2026-09-14T07:12:00Z' }] }).ok).toBe(false);
  });

  it('laat een onmogelijke duur niet door', () => {
    expect(leesPayload({ ...leeg, trainingen: [{ ...training, duurSec: -1 }] }).ok).toBe(false);
    expect(leesPayload({ ...leeg, trainingen: [{ ...training, duurSec: 60 * 60 * 49 }] }).ok).toBe(false);
  });

  it('laat een waarde buiten bereik weg in plaats van hem op nul te zetten', () => {
    const uit = leesPayload({ ...leeg, trainingen: [{ ...training, hartslagGem: 300, afstandM: 999_999 }] });
    expect(uit.ok).toBe(true);
    if (!uit.ok) return;
    expect(uit.payload.trainingen[0]!.hartslagGem).toBeNull();
    expect(uit.payload.trainingen[0]!.afstandM).toBeNull();
  });

  it('rondt de rustpols af en weigert een onmogelijke', () => {
    const uit = leesPayload({ ...leeg, dagen: [{ datum: '2026-09-14', rustpols: 48.6, slaapUren: 7.5 }] });
    expect(uit.ok).toBe(true);
    if (!uit.ok) return;
    expect(uit.payload.dagen[0]).toMatchObject({ rustpols: 49, slaapUren: 7.5, gewichtKg: null });
    const raar = leesPayload({ ...leeg, dagen: [{ datum: '2026-09-14', rustpols: 5 }] });
    expect(raar.ok && raar.payload.dagen[0]!.rustpols).toBeNull();
  });

  it('houdt de omvang beperkt', () => {
    const veel = Array.from({ length: 501 }, (_, i) => ({ ...training, externalId: `x${i}` }));
    expect(leesPayload({ ...leeg, trainingen: veel }).ok).toBe(false);
  });
});

describe('OVERGENOMEN', () => {
  it('vertaalt een Health Connect-wandeling in de bergen naar trail', () => {
    expect(OVERGENOMEN.Hike).toBe('TrailRun');
    expect(OVERGENOMEN.Run).toBe('Run');
  });

  it('neemt krachttraining niet over', () => {
    expect(OVERGENOMEN.StrengthTraining).toBeUndefined();
    expect(OVERGENOMEN.Workout).toBeUndefined();
  });
});

describe('isDezelfdeSessie', () => {
  const uitHc = { startLokaal: '2026-09-14T07:12:00', duurSec: 3120 };

  it('herkent dezelfde loop uit twee bronnen', () => {
    expect(isDezelfdeSessie(uitHc, { start_local: '2026-09-14T07:14:30', moving_s: 3180 })).toBe(true);
  });

  it('houdt twee losse lopen op dezelfde dag uit elkaar', () => {
    expect(isDezelfdeSessie(uitHc, { start_local: '2026-09-14T18:00:00', moving_s: 3120 })).toBe(false);
  });

  it('houdt een korte en een lange loop uit elkaar die tegelijk begonnen', () => {
    expect(isDezelfdeSessie(uitHc, { start_local: '2026-09-14T07:12:00', moving_s: 900 })).toBe(false);
  });

  it('doet geen uitspraak zonder bruikbare tijden', () => {
    expect(isDezelfdeSessie(uitHc, { start_local: 'onzin', moving_s: 3120 })).toBe(false);
    expect(isDezelfdeSessie(uitHc, { start_local: '2026-09-14T07:12:00', moving_s: null })).toBe(false);
  });
});
