'use client';
import { useState } from 'react';
import Link from 'next/link';
import GoalBar, { type GoalView } from './GoalBar';

const timeFmt = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false,
});

export default function CheckinButton({ sessionId, title }: { sessionId: string; title: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'already' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState<{
    at?: string; monthCount?: number;
    newBadges?: { emoji: string; name: string; desc: string }[];
    nextTier?: { name: string; remaining: number } | null;
    goal?: GoalView | null;
  }>({});

  async function go() {
    setState('busy');
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setInfo({
        at: j.checkedInAt ? timeFmt.format(new Date(j.checkedInAt)) : undefined, monthCount: j.monthCount,
        newBadges: j.newBadges, nextTier: j.nextTier, goal: j.goal,
      });
      setState(j.already ? 'already' : 'done');
    } else {
      setErr(j.error ?? '簽到失敗');
      setState('error');
    }
  }

  if (state === 'done' || state === 'already') {
    return (
      <div className="center">
        <p className="ok big">{state === 'done' ? '✅ 簽到成功！' : '✅ 你已經簽到過了'}</p>
        <p>{title}{info.at ? `・${info.at} 簽到` : ''}</p>
        {typeof info.monthCount === 'number' && <p className="muted">本月累計 {info.monthCount} 次</p>}
        {info.newBadges?.map((b) => (
          <div className="card" key={b.name}>
            <p className="muted">🎉 新徽章</p>
            <p className="big">{b.emoji} {b.name}</p>
            <p className="muted">{b.desc}</p>
          </div>
        ))}
        {!info.newBadges?.length && info.nextTier && (
          <p className="muted">再 {info.nextTier.remaining} 次可獲得{info.nextTier.name}</p>
        )}
        {info.goal && <GoalBar goal={info.goal} />}
        <p><Link className="btn ghost" href="/me">查看我的簽到紀錄與徽章</Link></p>
      </div>
    );
  }
  return (
    <>
      <button className="btn big" onClick={go} disabled={state === 'busy'}>
        {state === 'busy' ? '簽到中…' : '我要簽到'}
      </button>
      {state === 'error' && <p className="err">{err}</p>}
    </>
  );
}
