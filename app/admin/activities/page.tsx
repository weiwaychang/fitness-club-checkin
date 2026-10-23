import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { WEEKDAY_LABELS } from '@/lib/time';
import CopyField from '@/components/CopyField';
import { createActivity, toggleActivity } from '../actions';

export default async function ActivitiesPage() {
  await requireAdmin();
  const { data } = await db().from('activities').select('*').order('kind').order('name');
  const liff = process.env.NEXT_PUBLIC_LIFF_ID;

  return (
    <>
      <h1>課程 / 活動</h1>
      {(data ?? []).map((a) => {
        const link = liff ? `https://liff.line.me/${liff}/c/${a.checkin_token}` : `/c/${a.checkin_token}`;
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
            <label>簽到連結（貼到對應 LINE 群組）</label>
            <CopyField value={link} />
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
        <p><button className="btn">新增</button></p>
      </form>
    </>
  );
}
