import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSession, devMockEnabled } from '@/lib/auth';
import { formatTaipei, sessionTime, todayTaipei, WEEKDAY_LABELS, weekdayOf } from '@/lib/time';
import { cancelLabel } from '@/lib/labels';
import { headers } from 'next/headers';
import { latestPhotoUrl } from '@/lib/photos';
import LoginGate from '@/components/LoginGate';
import CheckinButton from '@/components/CheckinButton';
import GoalBar from '@/components/GoalBar';
import { loadGoal } from '@/lib/stats-server';

export const dynamic = 'force-dynamic';

function fmtDate(d: string) {
  return `${d}（${WEEKDAY_LABELS[weekdayOf(d)]}）`;
}

/** 每個課程自己的連結預覽（LINE 群組貼連結時顯示）。不需登入。 */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const { data: a } = await db().from('activities').select('*').eq('checkin_token', token).maybeSingle();
  if (!a || !a.is_active) return { title: '健身社團簽到' };
  const when = a.schedule_mode === 'weekly'
    ? `每${WEEKDAY_LABELS[a.weekday]}${a.start_time ? ` ${a.start_time.slice(0, 5)}` : ''}` : '';
  const desc = [when, a.location, String(a.description ?? '').replace(/\s+/g, ' ').slice(0, 80)]
    .filter(Boolean).join('・') || '活動簽到';
  const title = `${a.name}｜簽到`;
  // 預覽封面圖：這門課最近一張場次照片；沒有就用社團 Logo
  const host = (await headers()).get('host');
  const images = [(await latestPhotoUrl(a.id)) ?? `https://${host}/logo.jpg`];
  return { title, description: desc, openGraph: { title, description: desc, images } };
}

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getSession();
  if (!me) return <LoginGate devMock={devMockEnabled()} />;

  const { data: act } = await db().from('activities')
    .select('*').eq('checkin_token', token).maybeSingle();
  if (!act || !act.is_active) {
    return <div className="card center"><h1>找不到此活動</h1><p className="muted">連結無效或活動已停用。</p></div>;
  }

  const today = todayTaipei();
  // 今天的場次優先；否則找最近的下一場
  const { data: todays } = await db().from('sessions')
    .select('*')
    .eq('activity_id', act.id).eq('session_date', today).maybeSingle();
  const { data: next } = todays ? { data: null } : await db().from('sessions')
    .select('id, session_date, start_time, status')
    .eq('activity_id', act.id).eq('status', 'scheduled').gt('session_date', today)
    .order('session_date').limit(1).maybeSingle();

  let body: React.ReactNode;
  if (todays?.status === 'cancelled') {
    body = <p className="warn big center">今天的場次已取消（{cancelLabel(todays.cancel_reason)}）。</p>;
  } else if (todays) {
    const { data: done } = await db().from('checkins').select('id, checked_in_at')
      .eq('session_id', todays.id).eq('member_id', me.memberId).maybeSingle();
    body = done
      ? (
        <div className="center">
          <p className="ok big">✅ 你已經簽到過了</p>
          <p>{act.name}・{formatTaipei(done.checked_in_at).slice(11, 16)} 簽到</p>
          <p><Link className="btn ghost" href="/me">查看我的簽到紀錄</Link></p>
        </div>
      )
      : <CheckinButton sessionId={todays.id} title={`${act.name}・${fmtDate(todays.session_date)}`} />;
  } else if (next) {
    body = <p className="center muted">今天沒有場次。下一場：{fmtDate(next.session_date)}</p>;
  } else {
    body = <p className="center muted">目前沒有已排定的場次。</p>;
  }

  const photo = await latestPhotoUrl(act.id);
  const goal = await loadGoal(today.slice(0, 7)).catch(() => null);

  return (
    <>
      <h1>{act.name}</h1>
      <div className="card">
        {photo
          ? <img src={photo} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 10, display: 'block', marginBottom: 12 }} />
          : <img src="/logo.jpg" alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 16, display: 'block', margin: '0 auto 12px' }} />}
        <p className="muted">
          {todays ? fmtDate(todays.session_date) : fmtDate(today)}
          {todays && sessionTime(todays, act) ? ` ${sessionTime(todays, act)}` : ''}
          {act.location ? `・${act.location}` : ''}
        </p>
        {todays?.topic ? <p><strong>本次主題：{todays.topic}</strong></p> : null}
        {act.description ?<p style={{ whiteSpace: 'pre-line' }}>{act.description}</p> : null}
        <p>{me.name || '社員'}，你好！</p>
        {body}
      </div>
      {goal && <GoalBar goal={goal} />}
      <p className="muted center">
        本系統僅記錄 LINE 顯示名稱與簽到時間，供活動統計使用，不會要求密碼或金流資料。{' '}
        <Link href="/about">了解更多</Link>
      </p>
    </>
  );
}
