import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, isAdmin, devMockEnabled } from '@/lib/auth';
import LoginGate from '@/components/LoginGate';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // liff.line.me/<id>/c/<token> 會被 LINE 轉成「/?liff.state=/c/<token>」，在此轉到實際頁面
  const state = (await searchParams)['liff.state'];
  if (typeof state === 'string' && state.startsWith('/') && !state.startsWith('//')) redirect(state);

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
      <p className="muted center"><Link href="/about">關於本系統與個資說明</Link></p>
    </>
  );
}
