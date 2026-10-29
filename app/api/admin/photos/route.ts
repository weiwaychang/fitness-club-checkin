import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { requireAdmin, HttpError } from '@/lib/auth';
import { PHOTO_BUCKET, MAX_PHOTOS_PER_SESSION } from '@/lib/photos';

/** 上傳一張場次照片（前端已縮成 JPEG）。僅管理員。 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const form = await req.formData();
    const sessionId = String(form.get('sessionId') ?? '');
    const file = form.get('file');
    if (!sessionId || !(file instanceof File)) throw new HttpError(400, '缺少資料');
    if (file.type !== 'image/jpeg') throw new HttpError(400, '只接受 JPEG 圖片');
    if (file.size > 2 * 1024 * 1024) throw new HttpError(400, '照片過大');

    const { data: s } = await db().from('sessions').select('id').eq('id', sessionId).maybeSingle();
    if (!s) throw new HttpError(404, '找不到場次');
    const { count } = await db().from('session_photos').select('*', { count: 'exact', head: true }).eq('session_id', sessionId);
    if ((count ?? 0) >= MAX_PHOTOS_PER_SESSION) throw new HttpError(400, `每場次最多 ${MAX_PHOTOS_PER_SESSION} 張`);

    const path = `${sessionId}/${randomUUID()}.jpg`;
    const up = await db().storage.from(PHOTO_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: 'image/jpeg' });
    if (up.error) throw new HttpError(500, up.error.message);
    const { error } = await db().from('session_photos').insert({ session_id: sessionId, path, uploaded_by: admin.lineUserId });
    if (error) {
      await db().storage.from(PHOTO_BUCKET).remove([path]);
      throw new HttpError(500, error.message);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message ?? '上傳失敗' }, { status });
  }
}
