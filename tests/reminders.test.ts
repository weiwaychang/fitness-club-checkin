import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../lib/db', () => ({ db: () => ({}) }));
vi.mock('../lib/line-push', () => ({ pushText: async () => {} }));

import { isDueForReminder, sessionStartMs } from '../lib/reminders';

const at = (iso: string) => Date.parse(iso);

describe('isDueForReminder (class 18:30 Taipei = 10:30Z)', () => {
  it('false when more than 2h before', () => {
    expect(isDueForReminder('2026-11-10', '18:30:00', at('2026-11-10T08:29:00Z'))).toBe(false);
  });
  it('true at exactly 2h and inside the window', () => {
    expect(isDueForReminder('2026-11-10', '18:30:00', at('2026-11-10T08:30:00Z'))).toBe(true);
    expect(isDueForReminder('2026-11-10', '18:30:00', at('2026-11-10T10:00:00Z'))).toBe(true);
  });
  it('false once the class has started', () => {
    expect(isDueForReminder('2026-11-10', '18:30:00', at('2026-11-10T10:30:00Z'))).toBe(false);
  });
  it('false when no start time', () => {
    expect(isDueForReminder('2026-11-10', null, at('2026-11-10T09:00:00Z'))).toBe(false);
  });
  it('uses Taipei offset for early morning class', () => {
    expect(sessionStartMs('2026-11-10', '07:30:00')).toBe(at('2026-11-09T23:30:00Z'));
  });
});
