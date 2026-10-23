import { describe, it, expect } from 'vitest';
import { toCsv, sanitizeCell } from '../lib/csv';
import { todayTaipei, formatTaipei, addDays, weekdayOf } from '../lib/time';

describe('csv', () => {
  it('adds BOM and escapes quotes/commas', () => {
    const out = toCsv(['a', 'b'], [['x,y', 'say "hi"']]);
    expect(out.startsWith('﻿')).toBe(true);
    expect(out).toContain('"x,y","say ""hi"""');
  });
  it('neutralises formula injection', () => {
    expect(sanitizeCell('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(sanitizeCell('+1')).toBe("'+1");
    expect(sanitizeCell('@a')).toBe("'@a");
    expect(sanitizeCell(-5)).toBe('-5');
    expect(sanitizeCell(null)).toBe('');
  });
});

describe('time (Asia/Taipei)', () => {
  it('rolls the date at 00:00 Taipei, not UTC', () => {
    expect(todayTaipei(new Date('2026-10-14T15:59:59Z'))).toBe('2026-10-14');
    expect(todayTaipei(new Date('2026-10-14T16:00:00Z'))).toBe('2026-10-15');
  });
  it('formats timestamps in Taipei time', () => {
    expect(formatTaipei('2026-10-15T08:30:00Z')).toBe('2026-10-15 16:30:00');
    expect(formatTaipei('2026-10-14T16:00:00Z')).toBe('2026-10-15 00:00:00');
  });
  it('date helpers', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekdayOf('2026-10-15')).toBe(4); // 週四
  });
});
