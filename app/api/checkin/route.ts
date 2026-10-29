import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireMember, HttpError } from '@/lib/auth';
import { todayTaipei } from '@/lib/time';
import { BADGES } from '@/lib/badges';
import { loadBadges, loadGoal } from '@/lib/stats-server';

/** 該社員本月（台北時間）已簽到次數，取消場次不計。 */
async function monthCount(memberId: string, today: string): Promise<number> {
  const { count } = await db().from('checkins')
    .select('id, sessions!inner(session_date, status)', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('sessions.status', 'scheduled')
    .gte('sessions.session_date', `${today.slice(0, 7)}-01`);
  return count ?? 0;
}

/** 這次簽到新解鎖的徽章、下一個目標、社團本月目標。任何失敗都不影響簽到本身。 */
async function extras(memberId: string, sessionId: string, today: string) {
  try {
    const [after, before, goal] = await Promise.all([
      loadBadges(memberId), loadBadges(memberId, sessionId), loadGoal(today.slice(0, 7)),
    ]);
    const newBadges = BADGES.filter((b) => after.earned.has(b.key) && !before.earned.has(b.key))
      .map((b) => ({ emoji: b.emoji, name: b.name, desc: b.desc }));
    const tier = after.nextTier ? BADGES.find((b) => b.key === after.nextTier!.key)! : null;
    return {
      newBadges,
      nextTier: tier ? { name: tier.name, remaining: after.nextTier!.remaining } : null,
      goal,
    };
  } catch {
    return {};
  }
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
      ...(await extras(me.memberId, s.id, todayTaipei(now))),
    });
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: status === 500 ? '系統錯誤' : e.message }, { status });
  }
}
