import Link from 'next/link';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { addDays, todayTaipei } from '@/lib/time';
import { CANCEL_REASONS, cancelLabel } from '@/lib/labels';
import { confirmHeld, setSessionCancelled } from './actions';

export default async function AdminHome() {
  await requireAdmin();
  const today = todayTaipei();
  const { data } = await db().from('sessions')
    .select('id, session_date, status, cancel_reason, activities(name), checkins(count)')
    .gte('session_date', addDays(today, -14)).lte('session_date', addDays(today, 7))
    .order('session_date', { ascending: false });
  const { count: members } = await db().from('members').select('*', { count: 'exact', head: true });
  const { data: pending, error: pendingErr } = await db().from('v_pending_sessions')
    .select('id, session_date, activity_name').order('session_date', { ascending: false }).limit(100);

  return (
    <>
      <h1>總覽</h1>
      <div className="card"><p>社員（曾登入）：{members ?? 0} 人</p></div>

      {pendingErr && (
        <p className="card warn">尚未套用資料庫更新 0002（supabase/migrations/0002_session_review.sql），「待確認場次」暫時無法使用。</p>
      )}
      {(pending ?? []).length > 0 && (
        <>
          <h2>待確認場次（{pending!.length}）</h2>
          <p className="muted">這些場次已過期且沒有人簽到。請確認是沒開課（取消，不計入統計），或其實有上課（0 人也計入）。</p>
          <div className="card">
            {pending!.map((s: any) => (
              <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid #e4ece8' }}>
                <p><Link href={`/admin/sessions/${s.id}`}>{s.activity_name}</Link>・{s.session_date}</p>
                <div className="row">
                  <form action={setSessionCancelled} className="row">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="cancel" value="true" />
                    <select name="reason" defaultValue="holiday" style={{ width: 'auto' }}>
                      {Object.entries(CANCEL_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button className="btn small danger">未開課（取消）</button>
                  </form>
                  <form action={confirmHeld}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn small ghost">確實有上課</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <h2>近期場次</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>日期</th><th>活動</th><th>出席</th></tr></thead>
          <tbody>
            {(data ?? []).map((s: any) => (
              <tr key={s.id}>
                <td>{s.session_date}</td>
                <td><Link href={`/admin/sessions/${s.id}`}>{s.activities?.name}</Link></td>
                <td>{s.status === 'cancelled' ? <span className="tag cancel">{cancelLabel(s.cancel_reason)}</span> : s.checkins?.[0]?.count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
