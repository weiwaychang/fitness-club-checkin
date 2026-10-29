// 所有日期以 Asia/Taipei 為準。日期字串一律 YYYY-MM-DD。
const TZ = 'Asia/Taipei';

export function todayTaipei(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

/** 2026-10-15T08:30:00Z -> "2026-10-15 16:30:00" */
export function formatTaipei(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  const hour = g('hour') === '24' ? '00' : g('hour');
  return `${g('year')}-${g('month')}-${g('day')} ${hour}:${g('minute')}:${g('second')}`;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0=週日 … 6=週六 */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

/**
 * 場次的開始時間（HH:MM）。每週固定課程一律以課程目前的時間為準（改課程時間後立即生效）；
 * 手動排定的活動才用場次自己的時間。
 */
export function sessionTime(
  s: { start_time?: string | null },
  a: { start_time?: string | null; schedule_mode?: string | null } | null | undefined,
): string {
  const t = a?.schedule_mode === 'weekly' ? a.start_time : (s.start_time ?? a?.start_time);
  return t ? t.slice(0, 5) : '';
}

export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}
