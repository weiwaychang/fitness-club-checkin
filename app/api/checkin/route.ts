import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireMember, HttpError } from '@/lib/auth';
import { todayTaipei } from '@/lib/time';

/** 該社員本月（台北時間）已簽到次數，取消場次不計。 */
async function monthCount(memberId: string, today: string): Promise<number> {
  const { count } = await db().from('checkins')
    .select('id, sessions!inner(session_date, status)', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('sessions.status', 'scheduled')
    .gte('sessions.session_date', `${today.slice(0, 7)}-01`);
  return count ?? 0;
}

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

    const { data: ins, error } = await db().from('checkins')
      .insert({ session_id: s.id, member_id: me.memberId })
      .select('checked_in_at').single();
    if (error) {
      if (error.code !== '23505') throw new Error(error.message);
      const { data: prev } = await db().from('checkins').select('checked_in_at')
        .eq('session_id', s.id).eq('member_id', me.memberId).maybeSingle();
      return NextResponse.json({
        ok: true, already: true,
        checkedInAt: prev?.checked_in_at, monthCount: await monthCount(me.memberId, todayTaipei(now)),
      });
    }
    return NextResponse.json({
      ok: true, already: false,
      checkedInAt: ins.checked_in_at, monthCount: await monthCount(me.memberId, todayTaipei(now)),
    });
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: status === 500 ? '系統錯誤' : e.message }, { status });
  }
}
