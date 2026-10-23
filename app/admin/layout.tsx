import Link from 'next/link';
import { getSession, isAdmin, devMockEnabled } from '@/lib/auth';
import LoginGate from '@/components/LoginGate';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getSession();
  if (!me) return <LoginGate devMock={devMockEnabled()} />;
  if (!(await isAdmin(me.lineUserId))) {
    return <div className="card center"><h1>403</h1><p>你沒有管理員權限。</p></div>;
  }
  return (
    <>
      <nav className="nav">
        <Link href="/admin">總覽</Link>
        <Link href="/admin/activities">課程/活動</Link>
        <Link href="/admin/sessions">場次</Link>
        <Link href="/admin/members">社員</Link>
        <Link href="/admin/admins">管理員</Link>
        <Link href="/admin/export">匯出</Link>
      </nav>
      {children}
    </>
  );
}
