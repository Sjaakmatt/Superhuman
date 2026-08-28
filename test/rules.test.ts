import { describe, expect, it } from 'vitest';
import { evaluate, type RuleInput } from '@/lib/rules';
import { addDays } from '@/lib/date';

const TODAY = '2027-01-20';

/** Een invoer waarin geen enkele regel vuurt. Elke test verandert precies
 *  één ding, zodat je ziet waardoor een regel afgaat. */
function base(): RuleInput {
  const wellness = Array.from({ length: 60 }, (_, i) => ({
    date: addDays(TODAY, -(59 - i)),
    total: 27,
    weight_kg: 74,
  }));
  return {
    today: TODAY,
    wellness,
    logs: [],
    weekKm: new Map([
      [19, 60],
      [20, 62],
      [21, 64],
    ]),
    currentWeek: 21,
    weekStatus: 'opbouw',
    z2: [],
    z2Ceiling: 152,
    descent: [],
    strength: [],
    milestones: [],
    bloodPanelDates: [],
    shoes: [],
  };
}

const ids = (input: RuleInput) => evaluate(input).map((h) => h.id);

describe('geen alarm zonder aanleiding', () => {
  it('vuurt niets op een normale dag', () => {
    expect(ids(base())).toEqual([]);
  });
});

describe('pain-morning', () => {
  it('vuurt bij pijn de volgende ochtend', () => {
    const i = base();
    i.logs = [{ date: addDays(TODAY, -2), rpe: 5, pain_score: 3, pain_note: 'achillespees', pain_next_morning: 2 }];
    expect(ids(i)).toContain('pain-morning');
  });

  it('vuurt niet als de ochtend erna schoon is', () => {
    const i = base();
    i.logs = [{ date: addDays(TODAY, -2), rpe: 5, pain_score: 3, pain_note: 'achillespees', pain_next_morning: 0 }];
    expect(ids(i)).not.toContain('pain-morning');
  });
});

describe('pain-high', () => {
  it('vuurt boven 5 en is een stop', () => {
    const i = base();
    i.logs = [{ date: addDays(TODAY, -1), rpe: 6, pain_score: 6, pain_note: 'knie', pain_next_morning: 0 }];
    const hit = evaluate(i).find((h) => h.id === 'pain-high');
    expect(hit?.level).toBe('stop');
  });

  it('vuurt niet op precies 5', () => {
    const i = base();
    i.logs = [{ date: addDays(TODAY, -1), rpe: 6, pain_score: 5, pain_note: 'knie', pain_next_morning: 0 }];
    expect(ids(i)).not.toContain('pain-high');
  });
});

describe('pain-rising', () => {
  it('vuurt bij drie oplopende weken op dezelfde plek', () => {
    const i = base();
    i.logs = [
      { date: addDays(TODAY, -20), rpe: 5, pain_score: 2, pain_note: 'ITB', pain_next_morning: 0 },
      { date: addDays(TODAY, -13), rpe: 5, pain_score: 3, pain_note: 'ITB', pain_next_morning: 0 },
      { date: addDays(TODAY, -6), rpe: 5, pain_score: 4, pain_note: 'ITB', pain_next_morning: 0 },
    ];
    const hit = evaluate(i).find((h) => h.id === 'pain-rising');
    expect(hit?.level).toBe('stop');
  });

  it('vuurt niet als het drie verschillende plekken zijn', () => {
    const i = base();
    i.logs = [
      { date: addDays(TODAY, -20), rpe: 5, pain_score: 2, pain_note: 'ITB', pain_next_morning: 0 },
      { date: addDays(TODAY, -13), rpe: 5, pain_score: 3, pain_note: 'kuit', pain_next_morning: 0 },
      { date: addDays(TODAY, -6), rpe: 5, pain_score: 4, pain_note: 'hiel', pain_next_morning: 0 },
    ];
    expect(ids(i)).not.toContain('pain-rising');
  });
});

describe('wellness-drop', () => {
  it('vuurt bij twee dagen minstens 2 punten onder het 14-daags gemiddelde', () => {
    const i = base();
    for (const d of [addDays(TODAY, -1), TODAY]) {
      const row = i.wellness.find((w) => w.date === d)!;
      row.total = 24;
    }
    expect(ids(i)).toContain('wellness-drop');
  });

  it('vuurt niet bij één slechte dag', () => {
    const i = base();
    i.wellness.find((w) => w.date === TODAY)!.total = 21;
    expect(ids(i)).not.toContain('wellness-drop');
  });
});

describe('wellness-sustained', () => {
  it('vuurt als het zevendaags gemiddelde langer wegzakt', () => {
    const i = base();
    for (const w of i.wellness) if (w.date >= addDays(TODAY, -11)) w.total = 22;
    const hit = evaluate(i).find((h) => h.id === 'wellness-sustained');
    expect(hit?.level).toBe('stop');
  });

  it('vuurt niet bij twee mindere dagen', () => {
    const i = base();
    for (const w of i.wellness) if (w.date >= addDays(TODAY, -1)) w.total = 22;
    expect(ids(i)).not.toContain('wellness-sustained');
  });
});

describe('week-jump', () => {
  it('vuurt boven 1,30 ten opzichte van de zwaarste van twee weken', () => {
    const i = base();
    i.weekKm = new Map([
      [19, 60],
      [20, 40],
      [21, 82],
    ]);
    expect(ids(i)).toContain('week-jump');
  });

  it('vuurt niet als de deloadweek de basis zou verlagen', () => {
    const i = base();
    i.weekKm = new Map([
      [19, 70],
      [20, 40],
      [21, 72],
    ]);
    expect(ids(i)).not.toContain('week-jump');
  });
});

describe('z2-drift', () => {
  const s = (date: string, hr: number) => ({ date, avg_hr: hr, minutes: 45 });

  it('vuurt bij drie van zes sessies boven het plafond', () => {
    const i = base();
    i.z2 = [s('2027-01-06', 148), s('2027-01-08', 150), s('2027-01-11', 156), s('2027-01-14', 157), s('2027-01-17', 155), s('2027-01-19', 149)];
    expect(ids(i)).toContain('z2-drift');
  });

  it('vuurt niet bij twee van zes', () => {
    const i = base();
    i.z2 = [s('2027-01-06', 148), s('2027-01-08', 150), s('2027-01-11', 156), s('2027-01-14', 157), s('2027-01-17', 145), s('2027-01-19', 149)];
    expect(ids(i)).not.toContain('z2-drift');
  });
});

describe('descent-behind', () => {
  it('vuurt na drie weken onder 80% van het doel', () => {
    const i = base();
    i.descent = [
      { week: 19, actual_min: 20, target_min: 60 },
      { week: 20, actual_min: 30, target_min: 60 },
      { week: 21, actual_min: 40, target_min: 60 },
    ];
    expect(ids(i)).toContain('descent-behind');
  });

  it('vuurt niet als één van de drie weken wel gehaald is', () => {
    const i = base();
    i.descent = [
      { week: 19, actual_min: 20, target_min: 60 },
      { week: 20, actual_min: 55, target_min: 60 },
      { week: 21, actual_min: 40, target_min: 60 },
    ];
    expect(ids(i)).not.toContain('descent-behind');
  });
});

describe('strength-behind', () => {
  it('vuurt onder 70% adherentie over vier weken', () => {
    const i = base();
    i.strength = [
      { week: 18, done: 1, planned: 3 },
      { week: 19, done: 2, planned: 3 },
      { week: 20, done: 1, planned: 3 },
      { week: 21, done: 2, planned: 3 },
    ];
    expect(ids(i)).toContain('strength-behind');
  });

  it('vuurt niet als je de sessies wél doet', () => {
    const i = base();
    i.strength = [
      { week: 18, done: 3, planned: 3 },
      { week: 19, done: 2, planned: 3 },
      { week: 20, done: 3, planned: 3 },
      { week: 21, done: 2, planned: 3 },
    ];
    expect(ids(i)).not.toContain('strength-behind');
  });
});

describe('weight-drop', () => {
  it('vuurt bij meer dan 1% verlies per week in een opbouwblok', () => {
    const i = base();
    for (const w of i.wellness) {
      const back = Math.floor((Date.parse(TODAY) - Date.parse(w.date)) / 86_400_000);
      if (back <= 20) w.weight_kg = 74 - (20 - back) * 0.12;
    }
    expect(ids(i)).toContain('weight-drop');
  });

  it('vuurt niet in een taperweek', () => {
    const i = base();
    i.weekStatus = 'TAPER';
    for (const w of i.wellness) {
      const back = Math.floor((Date.parse(TODAY) - Date.parse(w.date)) / 86_400_000);
      if (back <= 20) w.weight_kg = 74 - (20 - back) * 0.12;
    }
    expect(ids(i)).not.toContain('weight-drop');
  });
});

describe('blood-due', () => {
  it('vuurt als een meetmijlpaal verstreken is zonder invoer', () => {
    const i = base();
    i.milestones = [{ week: 20, date: addDays(TODAY, -20), kind: 'meting', title: 'Bloedpanel kort' }];
    const hit = evaluate(i).find((h) => h.id === 'blood-due');
    expect(hit?.level).toBe('info');
  });

  it('vuurt niet als er een panel omheen staat', () => {
    const i = base();
    i.milestones = [{ week: 20, date: addDays(TODAY, -20), kind: 'meting', title: 'Bloedpanel kort' }];
    i.bloodPanelDates = [addDays(TODAY, -18)];
    expect(ids(i)).not.toContain('blood-due');
  });
});

describe('shoe-worn', () => {
  it('vuurt boven 700 km', () => {
    const i = base();
    i.shoes = [{ id: '1', name: 'Speedgoat', drop_mm: 4, km: 742, retired: false }];
    expect(ids(i)).toContain('shoe-worn');
  });

  it('vuurt niet voor een schoen die met pensioen is', () => {
    const i = base();
    i.shoes = [{ id: '1', name: 'Speedgoat', drop_mm: 4, km: 742, retired: true }];
    expect(ids(i)).not.toContain('shoe-worn');
  });
});

describe('volgorde', () => {
  it('zet stop bovenaan, dan warn, dan info', () => {
    const i = base();
    i.logs = [{ date: addDays(TODAY, -1), rpe: 8, pain_score: 7, pain_note: 'knie', pain_next_morning: 3 }];
    i.shoes = [{ id: '1', name: 'Speedgoat', drop_mm: 4, km: 742, retired: false }];
    const levels = evaluate(i).map((h) => h.level);
    expect(levels[0]).toBe('stop');
    expect(levels.at(-1)).toBe('info');
  });
});
