import Link from 'next/link';
import { db } from '@/lib/db';
import { getSession, devMockEnabled } from '@/lib/auth';
import { formatTaipei } from '@/lib/time';
import LoginGate from '@/components/LoginGate';
import { BADGES } from '@/lib/badges';
import { loadBadges } from '@/lib/stats-server';

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

  const b = await loadBadges(me.memberId).catch(() => null);

  return (
    <>
      <p><Link href="/">← 返回</Link></p>
      <h1>我的簽到紀錄</h1>
      {b && (
        <div className="card">
          <h2>我的徽章（{b.earned.size} / {BADGES.length}）</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {BADGES.map((x) => {
              const on = b.earned.has(x.key);
              return (
                <div key={x.key} style={{ opacity: on ? 1 : 0.45 }}>
                  <p style={{ margin: 0, fontWeight: 500 }}>{x.emoji} {x.name}</p>
                  <p className="muted" style={{ margin: 0, fontSize: '.8rem' }}>
                    {on ? '已獲得' : b.nextTier?.key === x.key ? `還差 ${b.nextTier.remaining} 次` : x.desc}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>徽章只有你自己看得到。</p>
        </div>
      )}
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
