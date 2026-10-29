import { describe, it, expect } from 'vitest';
import { computeBadges, type BadgeCheckin } from '../lib/badges';

const row = (i: number, date: string, act = 'a', kind = 'regular'): BadgeCheckin =>
  ({ session_id: `s${i}`, session_date: date, activity_id: act, kind });

describe('badges', () => {
  it('no check-ins earns nothing', () => {
    const r = computeBadges([], [], '2026-11-10');
    expect(r.earned.size).toBe(0);
    expect(r.nextTier).toEqual({ key: 'bronze', remaining: 10 });
  });

  it('tiers by total count', () => {
    const rows = Array.from({ length: 30 }, (_, i) => row(i, '2026-10-01'));
    const r = computeBadges(rows, [], '2026-11-10');
    expect([...r.earned].sort()).toEqual(['bronze', 'silver', 'sprout']);
    expect(r.nextTier).toEqual({ key: 'gold', remaining: 30 });
  });

  it('streak needs 4 consecutive weeks', () => {
    const four = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((d, i) => row(i, d));
    expect(computeBadges(four, [], '2026-11-10').earned.has('streak4')).toBe(true);
    const gap = ['2026-10-05', '2026-10-12', '2026-10-26', '2026-11-02'].map((d, i) => row(i, d));
    expect(computeBadges(gap, [], '2026-11-10').earned.has('streak4')).toBe(false);
  });

  it('variety and special activity', () => {
    const rows = [row(1, '2026-10-01', 'a'), row(2, '2026-10-02', 'b'), row(3, '2026-10-03', 'c', 'special')];
    const r = computeBadges(rows, [], '2026-11-10');
    expect(r.earned.has('variety')).toBe(true);
    expect(r.earned.has('special')).toBe(true);
  });

  it('full month only after the month ends and with at least 3 sessions', () => {
    const counted = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']
      .map((d, i) => ({ session_id: `s${i}`, session_date: d, activity_id: 'a' }));
    const all = counted.map((c, i) => row(i, c.session_date));
    expect(computeBadges(all, counted, '2026-11-10').earned.has('fullmonth')).toBe(true);
    expect(computeBadges(all, counted, '2026-10-27').earned.has('fullmonth')).toBe(false);
    expect(computeBadges(all.slice(1), counted, '2026-11-10').earned.has('fullmonth')).toBe(false);
  });
});
