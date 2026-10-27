import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { WEEKDAY_LABELS } from '@/lib/time';
import CopyField from '@/components/CopyField';
import CopyButton from '@/components/CopyButton';
import { createActivity, toggleActivity, updateActivity } from '../actions';

export default async function ActivitiesPage() {
  await requireAdmin();
  const { data } = await db().from('activities').select('*').order('kind').order('name');
  const liff = process.env.NEXT_PUBLIC_LIFF_ID;

  return (
    <>
      <h1>課程 / 活動</h1>
      {(data ?? []).map((a) => {
        const link = liff ? `https://liff.line.me/${liff}/c/${a.checkin_token}` : `/c/${a.checkin_token}`;
        const when = a.schedule_mode === 'weekly' ? `每${WEEKDAY_LABELS[a.weekday]} ${a.start_time?.slice(0, 5) ?? ''}`.trim() : '';
        const post = [
          `【${a.name}】簽到`,
          when && `時間：${when}`,
          a.location && `地點：${a.location}`,
          a.description && a.description,
          '👇 活動當天點下方連結簽到',
          link,
          '（網址為 liff.line.me 開頭；只會請 LINE 授權顯示名稱，不需要密碼）',
        ].filter(Boolean).join('\n');
        return (
          <div className="card" key={a.id}>
            <p>
              <strong>{a.name}</strong> <span className="tag">{a.kind === 'regular' ? '常規' : '非常規'}</span>{' '}
              {!a.is_active && <span className="tag cancel">已停用</span>}
            </p>
            <p className="muted">
              {a.schedule_mode === 'weekly' ? `每${WEEKDAY_LABELS[a.weekday]} ${a.start_time?.slice(0, 5) ?? ''}` : '手動排定'}
              {a.location ? `・${a.location}` : ''}
            </p>
            {a.description ? <p style={{ whiteSpace: 'pre-line' }}>{a.description}</p> : null}

            <label>群組貼文範本（含簽到連結）</label>
            <CopyButton text={post} />
            <label>僅簽到連結</label>
            <CopyField value={link} />

            <details style={{ marginTop: 10 }}>
              <summary>編輯名稱 / 說明 / 時間 / 地點</summary>
              <form action={updateActivity}>
                <input type="hidden" name="id" value={a.id} />
                <label>名稱</label><input name="name" defaultValue={a.name} required />
                <label>課程說明（顯示在簽到頁與連結預覽）</label>
                <textarea name="description" defaultValue={a.description ?? ''} rows={4}
                  style={{ width: '100%', padding: 10, border: '1px solid #c8d3cd', borderRadius: 8, fontSize: '1rem', fontFamily: 'inherit' }} />
                <label>開始時間</label><input type="time" name="start_time" defaultValue={a.start_time?.slice(0, 5) ?? ''} />
                <label>地點</label><input name="location" defaultValue={a.location ?? ''} />
                <p><button className="btn small">儲存</button></p>
              </form>
            </details>

            <form action={toggleActivity} style={{ marginTop: 8 }}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="active" value={String(!a.is_active)} />
              <button className="btn small ghost">{a.is_active ? '停用' : '重新啟用'}</button>
            </form>
          </div>
        );
      })}

      <h2>新增課程 / 活動</h2>
      <form action={createActivity} className="card">
        <label>名稱</label><input name="name" required placeholder="例：瑜伽課、國道馬" />
        <label>類型</label>
        <select name="kind"><option value="regular">常規課程</option><option value="special">非常規活動</option></select>
        <label>課程類別（統計分類用，可留空）</label><input name="category" />
        <label>排程方式</label>
        <select name="schedule_mode">
          <option value="manual">手動排定場次（越野跑、單場活動）</option>
          <option value="weekly">每週固定（自動產生場次）</option>
        </select>
        <label>每週星期（每週固定時填）</label>
        <select name="weekday">{WEEKDAY_LABELS.map((w, i) => <option key={i} value={i}>{w}</option>)}</select>
        <label>開始時間</label><input type="time" name="start_time" />
        <label>地點</label><input name="location" />
        <label>課程說明（可留空，顯示在簽到頁與連結預覽）</label>
        <textarea name="description" rows={3}
          style={{ width: '100%', padding: 10, border: '1px solid #c8d3cd', borderRadius: 8, fontSize: '1rem', fontFamily: 'inherit' }} />
        <p><button className="btn">新增</button></p>
      </form>
    </>
  );
}
