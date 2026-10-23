import Link from 'next/link';
import { getSession, isAdmin, devMockEnabled } from '@/lib/auth';
import LoginGate from '@/components/LoginGate';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const me = await getSession();
  if (!me) return <LoginGate devMock={devMockEnabled()} />;
  const admin = await isAdmin(me.lineUserId);
  return (
    <>
      <h1>健身社團簽到</h1>
      <div className="card">
        <p>哈囉，{me.name || '社員'}！</p>
        <p className="muted">請從 LINE 群組的活動連結進行簽到。</p>
        <p><Link className="btn" href="/me">我的簽到紀錄</Link></p>
        {admin && <p><Link className="btn ghost" href="/admin">管理後台</Link></p>}
      </div>
    </>
  );
}
