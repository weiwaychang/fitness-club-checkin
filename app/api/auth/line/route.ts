import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSession, devMockEnabled } from '@/lib/auth';

async function upsertMember(lineUserId: string, name: string) {
  const { data, error } = await db()
    .from('members')
    .upsert(
      { line_user_id: lineUserId, display_name: name, last_seen_at: new Date().toISOString() },
      { onConflict: 'line_user_id' },
    )
    .select('id, line_user_id, display_name')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // 本機開發：假登入（production 一律無效）
  if (body.mock) {
    if (!devMockEnabled()) return NextResponse.json({ error: 'mock login disabled' }, { status: 403 });
    const { data } = await db().from('members').select('id, line_user_id, display_name')
      .eq('line_user_id', String(body.mock)).maybeSingle();
    if (!data) return NextResponse.json({ error: 'unknown member' }, { status: 404 });
    await createSession({ memberId: data.id, lineUserId: data.line_user_id, name: data.display_name });
    return NextResponse.json({ ok: true });
  }

  const idToken = body.idToken;
  if (typeof idToken !== 'string' || !idToken) {
    return NextResponse.json({ error: 'missing idToken' }, { status: 400 });
  }

  // 由伺服器向 LINE 驗證 ID token（簽章、過期、audience），不信任前端自報 userId
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: process.env.LINE_CHANNEL_ID ?? '' }),
  });
  if (!res.ok) return NextResponse.json({ error: 'LINE 驗證失敗' }, { status: 401 });
  const info = await res.json();
  if (!info.sub) return NextResponse.json({ error: 'LINE 驗證失敗' }, { status: 401 });

  const m = await upsertMember(info.sub, info.name ?? '');
  await createSession({ memberId: m.id, lineUserId: m.line_user_id, name: m.display_name });
  return NextResponse.json({ ok: true });
}
