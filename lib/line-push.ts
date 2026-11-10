import 'server-only';

/** 以 Messaging API 傳文字訊息給多位使用者（每位收件者各算 1 則額度）。 */
export async function pushText(userIds: string[], text: string): Promise<void> {
  const token = process.env.LINE_MESSAGING_TOKEN;
  if (!token) throw new Error('缺少 LINE_MESSAGING_TOKEN');
  if (!userIds.length) return;
  for (let i = 0; i < userIds.length; i += 500) {
    const res = await fetch('https://api.line.me/v2/bot/message/multicast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: userIds.slice(i, i + 500), messages: [{ type: 'text', text }] }),
    });
    if (!res.ok) throw new Error(`LINE 傳送失敗（${res.status}）：${await res.text()}`);
  }
}
