import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { addAdmin, removeAdmin } from '../actions';

export default async function AdminsPage() {
  const me = await requireAdmin();
  const { data: admins } = await db().from('admins').select('line_user_id, created_at').order('created_at');
  const ids = (admins ?? []).map((a) => a.line_user_id);
  const { data: members } = await db().from('members').select('line_user_id, display_name').in('line_user_id', ids);
  const names = new Map((members ?? []).map((m) => [m.line_user_id, m.display_name]));

  return (
    <>
      <h1>管理員白名單（{ids.length}）</h1>
      <div className="card">
        {ids.map((id) => (
          <div className="row" key={id} style={{ justifyContent: 'space-between', margin: '8px 0' }}>
            <span>
              {names.get(id) ?? <span className="muted">（尚未登入過）</span>}
              {id === me.lineUserId && ' ・你'}
              <br /><span className="muted" style={{ wordBreak: 'break-all' }}>{id}</span>
            </span>
            <form action={removeAdmin}>
              <input type="hidden" name="line_user_id" value={id} />
              <button className="btn small danger">移除</button>
            </form>
          </div>
        ))}
      </div>
      <form action={addAdmin} className="card">
        <h2>新增管理員</h2>
        <p className="muted">貼上 LINE userId，或到「社員」頁直接按「設為管理員」。</p>
        <input name="line_user_id" placeholder="Uxxxxxxxx…" required />
        <p><button className="btn small">新增</button></p>
      </form>
    </>
  );
}
