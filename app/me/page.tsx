import Link from 'next/link';
import { db } from '@/lib/db';
import { getSession, devMockEnabled } from '@/lib/auth';
import { formatTaipei } from '@/lib/time';
import LoginGate from '@/components/LoginGate';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const me = await getSession();
  if (!me) return <LoginGate devMock={devMockEnabled()} />;

  // 一律以 session 內的 memberId 過濾：只能看自己的紀錄
  const { data } = await db().from('checkins')
    .select('checked_in_at, sessions!inner(session_date, status, activities(name))')
    .eq('member_id', me.memberId)
    .order('checked_in_at', { ascending: false });

  const rows = (data ?? []).filter((r: any) => r.sessions.status === 'scheduled');
  const byMonth = new Map<string, any[]>();
  const byAct = new Map<string, number>();
  for (const r of rows as any[]) {
    const m = r.sessions.session_date.slice(0, 7);
    byMonth.set(m, [...(byMonth.get(m) ?? []), r]);
    const n = r.sessions.activities?.name ?? '';
    byAct.set(n, (byAct.get(n) ?? 0) + 1);
  }

  return (
    <>
      <p><Link href="/">← 返回</Link></p>
      <h1>我的簽到紀錄</h1>
      <div className="card">
        <p>{me.name}</p>
        <p className="muted">你的 LINE userId（認領用）：<br /><code style={{ wordBreak: 'break-all' }}>{me.lineUserId}</code></p>
        <p>累計 {rows.length} 次</p>
        <p className="muted">{[...byAct].map(([k, v]) => `${k} ${v}`).join('・')}</p>
      </div>
      {[...byMonth].map(([m, list]) => (
        <div className="card" key={m}>
          <h2>{m}（{list.length} 次）</h2>
          <table><tbody>
            {list.map((r: any, i: number) => (
              <tr key={i}>
                <td>{r.sessions.session_date}</td>
                <td>{r.sessions.activities?.name}</td>
                <td className="muted">{formatTaipei(r.checked_in_at).slice(11, 16)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      ))}
      {rows.length === 0 && <p className="card muted center">尚無簽到紀錄</p>}
    </>
  );
}
