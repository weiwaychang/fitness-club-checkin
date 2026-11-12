import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, createSession } from '@/lib/auth';
import { verifyIdToken } from '@/lib/line-verify';

/** 簽到後在背景更新自己的 LINE 名稱與頭像。失敗不影響任何功能。 */
export async function POST(req: Request) {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { idToken } = await req.json().catch(() => ({}));
  if (typeof idToken !== 'string' || !idToken) return NextResponse.json({ ok: false });

  const p = await verifyIdToken(idToken).catch(() => null);
  // 憑證必須屬於目前登入者本人
  if (!p || p.sub !== me.lineUserId) return NextResponse.json({ ok: false });

  const patch: Record<string, unknown> = { picture_url: p.picture };
  if (p.name) patch.display_name = p.name;
  const { error } = await db().from('members').update(patch).eq('id', me.memberId);
  if (error) return NextResponse.json({ ok: false });
  if (p.name && p.name !== me.name) await createSession({ ...me, name: p.name });
  return NextResponse.json({ ok: true });
}
