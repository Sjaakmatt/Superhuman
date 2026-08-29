import { describe, expect, it } from 'vitest';
import { addMonths, formatMonth, monthDays, monthOf, weekdayIndex } from '@/lib/date';

describe('maandhulpjes voor de agenda', () => {
  it('kent de lengte van elke maand, ook in een schrikkeljaar', () => {
    expect(monthDays('2026-09')).toHaveLength(30);
    expect(monthDays('2027-02')).toHaveLength(28);
    expect(monthDays('2028-02')).toHaveLength(29);
    expect(monthDays('2026-12')[0]).toBe('2026-12-01');
    expect(monthDays('2026-12').at(-1)).toBe('2026-12-31');
  });

  it('rekent maanden op en af over de jaargrens heen', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-08', 14)).toBe('2027-10');
  });

  it('zet maandag op nul', () => {
    expect(weekdayIndex('2026-08-31')).toBe(0); // maandag, de eerste plandag
    expect(weekdayIndex('2026-09-06')).toBe(6); // zondag
  });

  it('schrijft de maand voluit in het Nederlands', () => {
    expect(formatMonth('2026-09')).toBe('september 2026');
    expect(monthOf('2027-10-02')).toBe('2027-10');
  });
});
