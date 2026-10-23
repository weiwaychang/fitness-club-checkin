import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { formatTaipei } from '@/lib/time';
import { addCheckin, removeCheckin } from '../../actions';

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { data: s } = await db().from('sessions')
    .select('id, session_date, status, activities(name)').eq('id', id).maybeSingle();
  if (!s) notFound();

  const { data: list } = await db().from('checkins')
    .select('id, checked_in_at, added_by, member_id, members(display_name, line_user_id)')
    .eq('session_id', id).order('checked_in_at');
  const present = new Set((list ?? []).map((c: any) => c.member_id));
  const { data: members } = await db().from('members').select('id, display_name').order('display_name').limit(500);

  return (
    <>
      <h1>{(s as any).activities?.name}・{s.session_date}</h1>
      {s.status === 'cancelled' && <p className="warn">此場次已取消，不計入統計。</p>}
      <p>簽到 {list?.length ?? 0} 人</p>
      <div className="card scroll">
        <table>
          <thead><tr><th>顯示名稱</th><th>時間</th><th></th></tr></thead>
          <tbody>
            {(list ?? []).map((c: any) => (
              <tr key={c.id}>
                <td>{c.members?.display_name}{c.added_by ? ' （補簽）' : ''}</td>
                <td>{formatTaipei(c.checked_in_at).slice(11, 16)}</td>
                <td>
                  <form action={removeCheckin}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="session_id" value={id} />
                    <button className="btn small danger">移除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={addCheckin} className="card">
        <h2>代為補簽</h2>
        <input type="hidden" name="session_id" value={id} />
        <select name="member_id">
          {(members ?? []).filter((m) => !present.has(m.id)).map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
        <p><button className="btn small">補簽</button></p>
      </form>
    </>
  );
}
