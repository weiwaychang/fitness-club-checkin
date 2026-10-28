import Link from 'next/link';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { addDays, todayTaipei, WEEKDAY_LABELS, weekdayOf } from '@/lib/time';
import { CANCEL_REASONS, cancelLabel } from '@/lib/labels';
import { addSessions, generateNow, setSessionCancelled } from '../actions';

export default async function SessionsPage() {
  await requireAdmin();
  const today = todayTaipei();
  const { data: acts } = await db().from('activities').select('id, name').eq('is_active', true).order('name');
  const { data } = await db().from('sessions')
    .select('id, session_date, start_time, status, cancel_reason, topic, activities(name, category), checkins(count)')
    .gte('session_date', addDays(today, -30)).order('session_date', { ascending: false }).limit(300);

  return (
    <>
      <h1>場次</h1>
      <form action={addSessions} className="card">
        <h2>新增場次</h2>
        <label>課程 / 活動</label>
        <select name="activity_id">{(acts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <label>日期（可多個，用空白/換行/逗號分隔，格式 YYYY-MM-DD）</label>
        <input name="dates" placeholder="2026-11-01 2026-11-22" required />
        <label>開始時間（可留空，沿用課程預設）</label>
        <input type="time" name="start_time" />
        <p><button className="btn">新增</button></p>
      </form>
      <form action={generateNow}><button className="btn ghost small">立即補產生未來 4 週的每週場次</button></form>

      <h2>近 30 天與未來場次</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>日期</th><th>活動</th><th>人數</th><th></th></tr></thead>
          <tbody>
            {(data ?? []).map((s: any) => (
              <tr key={s.id}>
                <td>{s.session_date.slice(5)}（{WEEKDAY_LABELS[weekdayOf(s.session_date)].slice(1)}）</td>
                <td>
                  <Link href={`/admin/sessions/${s.id}`}>{s.activities?.name}</Link>
                  <div className="muted">{s.topic ? `主題：${s.topic}` : '設定主題 / 貼文 →'}</div>
                </td>
                <td>{s.status === 'cancelled' ? <span className="tag cancel">{cancelLabel(s.cancel_reason)}</span> : s.checkins?.[0]?.count ?? 0}</td>
                <td>
                  <form action={setSessionCancelled} className="row">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="cancel" value={String(s.status !== 'cancelled')} />
                    {s.status !== 'cancelled' && (
                      <select name="reason" defaultValue="holiday" style={{ width: 'auto' }}>
                        {Object.entries(CANCEL_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    )}
                    <button className="btn small ghost">{s.status === 'cancelled' ? '恢復' : '取消'}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
