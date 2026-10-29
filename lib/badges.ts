import { addDays, weekdayOf } from './time';

/** 一筆「有計入統計」的個人簽到（場次未取消）。 */
export type BadgeCheckin = { session_id: string; session_date: string; activity_id: string; kind: string };
/** 每週固定課程中「有計入統計」的場次（用來判斷月全勤）。 */
export type CountedSession = { session_id: string; session_date: string; activity_id: string };

export const BADGES = [
  { key: 'sprout', emoji: '🌱', name: '新芽', desc: '完成第 1 次簽到' },
  { key: 'bronze', emoji: '🥉', name: '銅牌', desc: '累計簽到 10 次' },
  { key: 'silver', emoji: '🥈', name: '銀牌', desc: '累計簽到 30 次' },
  { key: 'gold', emoji: '🥇', name: '金牌', desc: '累計簽到 60 次' },
  { key: 'streak4', emoji: '🔥', name: '連續 4 週', desc: '連續 4 週每週至少簽到 1 次' },
  { key: 'fullmonth', emoji: '📅', name: '月全勤', desc: '某個月（月底後計算）每週課程的場次全部出席，且該月至少 3 場' },
  { key: 'variety', emoji: '🧭', name: '多元嘗試', desc: '參加過 3 種以上不同的課程或活動' },
  { key: 'special', emoji: '🏅', name: '特別活動', desc: '參加過非常規活動（國道馬、NS RUN、淨灘…）' },
] as const;

export type BadgeKey = (typeof BADGES)[number]['key'];

const TIERS: { key: BadgeKey; need: number }[] = [
  { key: 'bronze', need: 10 }, { key: 'silver', need: 30 }, { key: 'gold', need: 60 },
];

/** 該週的週一日期，作為「週」的識別。 */
function weekStart(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

function hasStreak(dates: string[], len: number): boolean {
  const weeks = [...new Set(dates.map(weekStart))].sort();
  let run = 1;
  for (let i = 1; i < weeks.length; i++) {
    run = weeks[i] === addDays(weeks[i - 1], 7) ? run + 1 : 1;
    if (run >= len) return true;
  }
  return false;
}

export function computeBadges(rows: BadgeCheckin[], counted: CountedSession[], today: string) {
  const total = rows.length;
  const earned = new Set<BadgeKey>();
  if (total >= 1) earned.add('sprout');
  for (const t of TIERS) if (total >= t.need) earned.add(t.key);
  if (hasStreak(rows.map((r) => r.session_date), 4)) earned.add('streak4');
  if (new Set(rows.map((r) => r.activity_id)).size >= 3) earned.add('variety');
  if (rows.some((r) => r.kind === 'special')) earned.add('special');

  const mine = new Set(rows.map((r) => r.session_id));
  const byMonth = new Map<string, CountedSession[]>();
  for (const s of counted) {
    if (s.session_date.slice(0, 7) >= today.slice(0, 7)) continue; // 當月尚未結束
    const k = `${s.activity_id}|${s.session_date.slice(0, 7)}`;
    byMonth.set(k, [...(byMonth.get(k) ?? []), s]);
  }
  for (const list of byMonth.values()) {
    if (list.length >= 3 && list.every((s) => mine.has(s.session_id))) { earned.add('fullmonth'); break; }
  }

  const next = TIERS.find((t) => total < t.need);
  const nextTier = next ? { key: next.key, remaining: next.need - total } : null;
  return { total, earned, nextTier };
}
