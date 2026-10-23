import 'server-only';
import { db } from './db';
import { addDays, todayTaipei, weekdayOf } from './time';

/** 為每個啟用中的 weekly 活動補足今天起 weeksAhead 週內的場次（idempotent）。 */
export async function generateWeeklySessions(weeksAhead = 4): Promise<number> {
  const { data: acts, error } = await db()
    .from('activities').select('id, weekday, start_time')
    .eq('schedule_mode', 'weekly').eq('is_active', true);
  if (error) throw new Error(error.message);

  const today = todayTaipei();
  const rows: any[] = [];
  for (const a of acts ?? []) {
    for (let i = 0; i < weeksAhead * 7; i++) {
      const d = addDays(today, i);
      if (weekdayOf(d) === a.weekday) rows.push({ activity_id: a.id, session_date: d, start_time: a.start_time });
    }
  }
  if (!rows.length) return 0;
  const { data, error: e2 } = await db()
    .from('sessions')
    .upsert(rows, { onConflict: 'activity_id,session_date', ignoreDuplicates: true })
    .select('id');
  if (e2) throw new Error(e2.message);
  return data?.length ?? 0;
}
