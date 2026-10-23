import { db, fetchAll } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { addAdmin } from '../actions';

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = '' } = await searchParams;
  const rows = await fetchAll((a, b) => {
    let qb = db().from('members').select('line_user_id, display_name, first_seen_at').order('display_name');
    if (q) qb = qb.ilike('display_name', `%${q.replace(/[%_,()]/g, '')}%`);
    return qb.range(a, b);
  });

  return (
    <>
      <h1>社員（{rows.length}）</h1>
      <form className="card row"><input name="q" defaultValue={q} placeholder="搜尋顯示名稱" /><button className="btn small">搜尋</button></form>
      <div className="card scroll">
        <table>
          <thead><tr><th>顯示名稱</th><th>LINE userId</th><th></th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.line_user_id}>
                <td>{m.display_name}</td>
                <td className="muted" style={{ wordBreak: 'break-all' }}>{m.line_user_id}</td>
                <td>
                  <form action={addAdmin}>
                    <input type="hidden" name="line_user_id" value={m.line_user_id} />
                    <button className="btn small ghost">設為管理員</button>
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
