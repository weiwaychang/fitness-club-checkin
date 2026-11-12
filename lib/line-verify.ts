import 'server-only';

export type LineProfile = { sub: string; name: string; picture: string | null };

/** 只接受 LINE 頭像網址（https），避免把任意網址寫進資料庫。 */
export function safePicture(p: unknown): string | null {
  if (typeof p !== 'string') return null;
  try {
    const u = new URL(p);
    return u.protocol === 'https:' && /(^|\.)line-scdn\.net$/.test(u.hostname) ? p : null;
  } catch {
    return null;
  }
}

/** 由伺服器向 LINE 驗證 ID token（簽章、過期、audience），回傳 userId、名稱、頭像。失敗回 null。 */
export async function verifyIdToken(idToken: string): Promise<LineProfile | null> {
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: process.env.LINE_CHANNEL_ID ?? '' }),
  });
  if (!res.ok) return null;
  const info = await res.json();
  if (!info.sub) return null;
  return { sub: info.sub, name: info.name ?? '', picture: safePicture(info.picture) };
}
