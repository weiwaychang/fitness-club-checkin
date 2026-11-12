import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import Avatar from '@/components/Avatar';
import { addAdmin, removeAdmin, sendTestMessage, setReminderNotify } from '../actions';

export default async function AdminsPage() {
  const me = await requireAdmin();
  const { data: admins } = await db().from('admins').select('line_user_id, created_at, notify_reminders').order('created_at');
  const ids = (admins ?? []).map((a) => a.line_user_id);
  const notify = new Map((admins ?? []).map((a) => [a.line_user_id, a.notify_reminders]));
  const { data: members } = await db().from('members').select('line_user_id, display_name, picture_url').in('line_user_id', ids);
  const names = new Map((members ?? []).map((m) => [m.line_user_id, m.display_name]));
  const pics = new Map((members ?? []).map((m) => [m.line_user_id, m.picture_url]));

  return (
    <>
      <h1>管理員白名單（{ids.length}）</h1>
      <div className="card">
        {ids.map((id) => (
          <div className="row" key={id} style={{ justifyContent: 'space-between', margin: '8px 0' }}>
            <span>
              <Avatar url={pics.get(id)} name={names.get(id)} size={30} />
              {names.get(id) ?? <span className="muted">（尚未登入過）</span>}
              {id === me.lineUserId && ' ・你'}
              <br /><span className="muted" style={{ wordBreak: 'break-all' }}>{id}</span>
            </span>
            <span className="row">
              <form action={setReminderNotify}>
                <input type="hidden" name="line_user_id" value={id} />
                <input type="hidden" name="notify" value={String(!notify.get(id))} />
                <button className="btn small ghost">{notify.get(id) ? '提醒：開' : '提醒：關'}</button>
              </form>
              <form action={removeAdmin}>
                <input type="hidden" name="line_user_id" value={id} />
                <button className="btn small danger">移除</button>
              </form>
            </span>
          </div>
        ))}
      </div>
      <form action={sendTestMessage} className="card">
        <h2>上課提醒</h2>
        <p className="muted">上課前 2 小時，系統會傳 LINE 訊息給「提醒：開」的管理員，每位收件者每堂課 1 則。想節省額度可只留 1 位開啟。</p>
        <button className="btn small ghost">傳一則測試訊息給我</button>
      </form>
      <form action={addAdmin} className="card">
        <h2>新增管理員</h2>
        <p className="muted">貼上 LINE userId，或到「社員」頁直接按「設為管理員」。</p>
        <input name="line_user_id" placeholder="Uxxxxxxxx…" required />
        <p><button className="btn small">新增</button></p>
      </form>
    </>
  );
}
