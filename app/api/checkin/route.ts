import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireMember, HttpError } from '@/lib/auth';
import { todayTaipei } from '@/lib/time';

export async function POST(req: Request) {
  try {
    const me = await requireMember();
    const { sessionId } = await req.json();
    if (typeof sessionId !== 'string') throw new HttpError(400, '缺少場次');

    const { data: s } = await db()
      .from('sessions')
      .select('id, session_date, status, checkin_opens_at, checkin_closes_at, activities(is_active)')
      .eq('id', sessionId).maybeSingle();
    if (!s) throw new HttpError(404, '找不到場次');
    if (s.status === 'cancelled') throw new HttpError(409, '此場次已取消');
    if ((s as any).activities?.is_active === false) throw new HttpError(409, '此課程已停用');

    const now = new Date();
    if (s.checkin_opens_at || s.checkin_closes_at) {
      if (s.checkin_opens_at && now < new Date(s.checkin_opens_at)) throw new HttpError(409, '簽到尚未開放');
      if (s.checkin_closes_at && now > new Date(s.checkin_closes_at)) throw new HttpError(409, '簽到已截止');
    } else if (s.session_date !== todayTaipei(now)) {
      throw new HttpError(409, '僅限活動當天簽到');
    }

    const { error } = await db().from('checkins').insert({ session_id: s.id, member_id: me.memberId });
    if (error) {
      if (error.code === '23505') return NextResponse.json({ ok: true, already: true });
      throw new Error(error.message);
    }
    return NextResponse.json({ ok: true, already: false });
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: status === 500 ? '系統錯誤' : e.message }, { status });
  }
}
