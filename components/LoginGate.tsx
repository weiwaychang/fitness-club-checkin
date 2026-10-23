'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** 未登入時顯示：用 LIFF 取得 ID token，交給伺服器驗證後 refresh。 */
export default function LoginGate({ devMock = false }: { devMock?: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState('登入中…');

  useEffect(() => {
    if (devMock) {
      router.replace('/dev-login?next=' + encodeURIComponent(location.pathname));
      return;
    }
    (async () => {
      try {
        const liff = (await import('@line/liff')).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: location.href });
          return;
        }
        const idToken = liff.getIDToken();
        const res = await fetch('/api/auth/line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error('驗證失敗');
        router.refresh();
      } catch {
        setMsg('登入失敗，請從 LINE 重新開啟連結。');
      }
    })();
  }, [devMock, router]);

  return <p className="card center">{msg}</p>;
}
