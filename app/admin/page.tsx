import Link from 'next/link';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { addDays, todayTaipei } from '@/lib/time';

export default async function AdminHome() {
  await requireAdmin();
  const today = todayTaipei();
  const { data } = await db().from('sessions')
    .select('id, session_date, status, activities(name), checkins(count)')
    .gte('session_date', addDays(today, -14)).lte('session_date', addDays(today, 7))
    .order('session_date', { ascending: false });
  const { count: members } = await db().from('members').select('*', { count: 'exact', head: true });

  return (
    <>
      <h1>總覽</h1>
      <div className="card"><p>社員（曾登入）：{members ?? 0} 人</p></div>
      <h2>近期場次</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>日期</th><th>活動</th><th>出席</th></tr></thead>
          <tbody>
            {(data ?? []).map((s: any) => (
              <tr key={s.id}>
                <td>{s.session_date}</td>
                <td><Link href={`/admin/sessions/${s.id}`}>{s.activities?.name}</Link></td>
                <td>{s.status === 'cancelled' ? <span className="tag cancel">已取消</span> : s.checkins?.[0]?.count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
