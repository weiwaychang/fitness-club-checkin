import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { devMockEnabled } from '@/lib/auth';
import DevLoginButton from '@/components/DevLoginButton';

export const dynamic = 'force-dynamic';

export default async function DevLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!devMockEnabled()) notFound();
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith('/') ? sp.next : '/';
  const { data: admins } = await db().from('admins').select('line_user_id');
  const adminIds = new Set((admins ?? []).map((a) => a.line_user_id));
  const { data: members } = await db().from('members').select('line_user_id, display_name').order('display_name').limit(60);

  return (
    <>
      <h1>開發用假登入</h1>
      <p className="muted">僅在 DEV_MOCK_LOGIN=true 且非 production 時可用。</p>
      <div className="card">
        {(members ?? []).map((m) => (
          <p key={m.line_user_id}>
            <DevLoginButton
              userId={m.line_user_id}
              label={`${m.display_name}${adminIds.has(m.line_user_id) ? '（管理員）' : ''}`}
              next={next}
            />
          </p>
        ))}
      </div>
    </>
  );
}
