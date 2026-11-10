import 'server-only';
import { db } from './db';
import { pushText } from './line-push';
import { addDays, todayTaipei } from './time';

const LEAD_MS = 2 * 60 * 60 * 1000;

/** 場次開始時間（台北）。start_time 為 'HH:MM[:SS]'。 */
export function sessionStartMs(date: string, time: string): number {
  return Date.parse(`${date}T${time.slice(0, 5)}:00+08:00`);
}

/** 是否進入「開始前 2 小時內」且尚未開始。 */
export function isDueForReminder(date: string, time: string | null, nowMs: number): boolean {
  if (!time) return false;
  const lead = sessionStartMs(date, time) - nowMs;
  return lead > 0 && lead <= LEAD_MS;
}

function liffLink(token: string) {
  const liff = process.env.NEXT_PUBLIC_LIFF_ID;
  return liff ? `https://liff.line.me/${liff}/c/${token}` : '';
}

/** 傳送已進入 2 小時內、尚未提醒的場次通知給接收提醒的管理員。回傳已提醒的場次數。 */
export async function sendDueReminders(now: Date = new Date()): Promise<number> {
  const today = todayTaipei(now);
  const { data: sessions, error } = await db()
    .from('sessions')
    .select('id, session_date, start_time, activities(name, location, checkin_token, is_active)')
    .eq('status', 'scheduled')
    .is('reminder_sent_at', null)
    .in('session_date', [today, addDays(today, 1)]);
  if (error) throw new Error(error.message);

  const due = (sessions ?? []).filter(
    (s: any) => s.activities?.is_active && isDueForReminder(s.session_date, s.start_time, now.getTime()),
  );
  if (!due.length) return 0;

  const { data: admins } = await db().from('admins').select('line_user_id').eq('notify_reminders', true);
  const recipients = (admins ?? []).map((a) => a.line_user_id);

  let count = 0;
  for (const s of due as any[]) {
    // 先「認領」再傳送，避免排程重疊時重複提醒
    const { data: claimed } = await db()
      .from('sessions')
      .update({ reminder_sent_at: now.toISOString() })
      .eq('id', s.id)
      .is('reminder_sent_at', null)
      .select('id');
    if (!claimed?.length) continue;

    const a = s.activities;
    const lines = [
      `⏰ 2 小時內有課：${a.name} ${s.start_time.slice(0, 5)}`,
      a.location ? `地點：${a.location}` : '',
      '請記得把簽到連結貼到群組：',
      liffLink(a.checkin_token),
    ].filter(Boolean);
    try {
      await pushText(recipients, lines.join('\n'));
      count++;
    } catch (e) {
      // 傳送失敗：釋放認領，下一輪再試
      await db().from('sessions').update({ reminder_sent_at: null }).eq('id', s.id);
      throw e;
    }
  }
  return count;
}
