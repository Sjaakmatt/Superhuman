import { describe, expect, it } from 'vitest';
import { parseBlock, setCount } from '@/lib/strength';
import { planSeed, referenceSeed } from '@/lib/seed-files';

const exercises = referenceSeed().exercises;

describe('setCount', () => {
  it('leest het aantal series uit een reeks', () => {
    expect(setCount('3-4x8-12 @65-75%', 3)).toBe(4);
    expect(setCount('4x10', 3)).toBe(4);
    expect(setCount('5x4 x 3s @~90% MVC', 3)).toBe(5);
  });

  it('valt terug op de standaard zonder voorschrift', () => {
    expect(setCount('naar gevoel', 3)).toBe(3);
  });
});

describe('parseBlock', () => {
  it('koppelt elk onderdeel aan een oefening uit de referentie', () => {
    const parsed = parseBlock(
      'Back squat 3-4x8-12 @65-75% | Roemeense deadlift 3x8 | Pallof press 3x12 p/z',
      exercises,
    );
    expect(parsed.map((p) => p.slug)).toEqual(['back-squat', 'rdl', 'pallof']);
    expect(parsed[0]!.sets).toBe(4);
    expect(parsed[0]!.prescription).toBe('3-4x8-12 @65-75%');
  });

  it('verwart Roeien niet met Roemeense deadlift', () => {
    expect(parseBlock('Roemeense deadlift 3x8', exercises)[0]!.slug).toBe('rdl');
    expect(parseBlock('Roeien 3x10', exercises)[0]!.slug).toBe('row');
  });

  it('laat onbekende regels staan zonder ze te verzinnen', () => {
    const parsed = parseBlock('Mobiliteit heup 10 min', exercises);
    expect(parsed[0]!.slug).toBeNull();
    expect(parsed[0]!.name).toBe('Mobiliteit heup 10 min');
  });

  it('herkent elk onderdeel in het echte plan', () => {
    const details = [...new Set(planSeed().days.map((d) => d.strength_detail))].filter((d): d is string => Boolean(d));
    const parts = details.flatMap((d) => parseBlock(d, exercises));
    expect(parts.length).toBeGreaterThan(50);
    expect(parts.filter((p) => p.slug === null)).toEqual([]);
  });

  it('vertaalt de trap-bar-variant naar de oefening uit de referentie', () => {
    const parsed = parseBlock('Trap-bar of conventionele deadlift 4-5x4-6 @80-87%', exercises);
    expect(parsed[0]!.slug).toBe('trapbar-deadlift');
    expect(parsed[0]!.prescription).toBe('4-5x4-6 @80-87%');
  });
});
