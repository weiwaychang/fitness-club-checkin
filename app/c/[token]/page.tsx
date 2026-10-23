import { db } from '@/lib/db';
import { getSession, devMockEnabled } from '@/lib/auth';
import { todayTaipei, WEEKDAY_LABELS, weekdayOf } from '@/lib/time';
import LoginGate from '@/components/LoginGate';
import CheckinButton from '@/components/CheckinButton';

export const dynamic = 'force-dynamic';

function fmtDate(d: string) {
  return `${d}（${WEEKDAY_LABELS[weekdayOf(d)]}）`;
}

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getSession();
  if (!me) return <LoginGate devMock={devMockEnabled()} />;

  const { data: act } = await db().from('activities')
    .select('id, name, location, is_active').eq('checkin_token', token).maybeSingle();
  if (!act || !act.is_active) {
    return <div className="card center"><h1>找不到此活動</h1><p className="muted">連結無效或活動已停用。</p></div>;
  }

  const today = todayTaipei();
  // 今天的場次優先；否則找最近的下一場
  const { data: todays } = await db().from('sessions')
    .select('id, session_date, start_time, status, cancel_reason')
    .eq('activity_id', act.id).eq('session_date', today).maybeSingle();
  const { data: next } = todays ? { data: null } : await db().from('sessions')
    .select('id, session_date, start_time, status')
    .eq('activity_id', act.id).eq('status', 'scheduled').gt('session_date', today)
    .order('session_date').limit(1).maybeSingle();

  let body: React.ReactNode;
  if (todays?.status === 'cancelled') {
    body = <p className="warn big center">今天的場次已取消{todays.cancel_reason === 'rain' ? '（雨天取消）' : ''}。</p>;
  } else if (todays) {
    const { data: done } = await db().from('checkins').select('id')
      .eq('session_id', todays.id).eq('member_id', me.memberId).maybeSingle();
    body = done
      ? <p className="ok big">✅ 你已經簽到過了</p>
      : <CheckinButton sessionId={todays.id} />;
  } else if (next) {
    body = <p className="center muted">今天沒有場次。下一場：{fmtDate(next.session_date)}</p>;
  } else {
    body = <p className="center muted">目前沒有已排定的場次。</p>;
  }

  return (
    <>
      <h1>{act.name}</h1>
      <div className="card">
        <p className="muted">
          {todays ? fmtDate(todays.session_date) : fmtDate(today)}
          {todays?.start_time ? ` ${todays.start_time.slice(0, 5)}` : ''}
          {act.location ? `・${act.location}` : ''}
        </p>
        <p>{me.name || '社員'}，你好！</p>
        {body}
      </div>
      <p className="muted center">本系統僅記錄 LINE 顯示名稱與簽到時間，供活動統計使用。</p>
    </>
  );
}
