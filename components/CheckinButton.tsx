'use client';
import { useState } from 'react';

export default function CheckinButton({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'already' | 'error'>('idle');
  const [err, setErr] = useState('');

  async function go() {
    setState('busy');
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setState(j.already ? 'already' : 'done');
    else { setErr(j.error ?? '簽到失敗'); setState('error'); }
  }

  if (state === 'done') return <p className="ok big">✅ 簽到成功！</p>;
  if (state === 'already') return <p className="ok big">✅ 你已經簽到過了</p>;
  return (
    <>
      <button className="btn big" onClick={go} disabled={state === 'busy'}>
        {state === 'busy' ? '簽到中…' : '我要簽到'}
      </button>
      {state === 'error' && <p className="err">{err}</p>}
    </>
  );
}
