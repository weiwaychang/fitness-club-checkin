import 'server-only';
import { db } from './db';
import { todayTaipei } from './time';
import { computeBadges, type BadgeCheckin, type CountedSession } from './badges';

/** 載入某位社員的徽章計算所需資料，並算出目前徽章。 */
export async function loadBadgeInput(memberId: string) {
  const today = todayTaipei();
  const { data: mine } = await db().from('checkins')
    .select('session_id, sessions!inner(session_date, status, activity_id, activities(kind))')
    .eq('member_id', memberId).eq('sessions.status', 'scheduled').limit(5000);
  const rows: BadgeCheckin[] = (mine ?? []).map((r: any) => ({
    session_id: r.session_id,
    session_date: r.sessions.session_date,
    activity_id: r.sessions.activity_id,
    kind: r.sessions.activities?.kind ?? 'regular',
  }));

  const { data: weekly } = await db().from('sessions')
    .select('id, session_date, activity_id, held_confirmed, checkins(count), activities!inner(schedule_mode)')
    .eq('activities.schedule_mode', 'weekly').eq('status', 'scheduled').lte('session_date', today).limit(5000);
  const counted: CountedSession[] = (weekly ?? [])
    .filter((s: any) => s.held_confirmed || (s.checkins?.[0]?.count ?? 0) > 0)
    .map((s: any) => ({ session_id: s.id, session_date: s.session_date, activity_id: s.activity_id }));

  return { rows, counted, today };
}

export async function loadBadges(memberId: string, excludeSessionId?: string) {
  const { rows, counted, today } = await loadBadgeInput(memberId);
  const use = excludeSessionId ? rows.filter((r) => r.session_id !== excludeSessionId) : rows;
  return computeBadges(use, counted, today);
}

export type GoalProgress = {
  month: string; targetCheckins: number; targetMembers: number; checkins: number; members: number;
};

/** 指定月份（YYYY-MM）的共同目標與目前進度；沒設定目標或資料表不存在就回傳 null。 */
export async function loadGoal(month: string): Promise<GoalProgress | null> {
  const { data: g, error } = await db().from('club_goals').select('*').eq('month', month).maybeSingle();
  if (error || !g || (g.target_checkins <= 0 && g.target_members <= 0)) return null;

  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const { data: ss } = await db().from('sessions')
    .select('id, held_confirmed, checkins(member_id)')
    .eq('status', 'scheduled').gte('session_date', `${month}-01`).lt('session_date', next)
    .lte('session_date', todayTaipei()).limit(5000);
  const counted = (ss ?? []).filter((s: any) => s.held_confirmed || (s.checkins?.length ?? 0) > 0);
  const members = new Set<string>();
  let checkins = 0;
  for (const s of counted as any[]) {
    for (const c of s.checkins ?? []) { checkins++; members.add(c.member_id); }
  }
  return { month, targetCheckins: g.target_checkins, targetMembers: g.target_members, checkins, members: members.size };
}
