import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { formatTaipei, WEEKDAY_LABELS, weekdayOf } from '@/lib/time';
import CopyButton from '@/components/CopyButton';
import PhotoUploader from '@/components/PhotoUploader';
import { photoUrl } from '@/lib/photos';
import { addCheckin, deletePhoto, removeCheckin, updateSessionTopic } from '../../actions';

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { data: s } = await db().from('sessions')
    .select('id, session_date, start_time, status, topic, activities(name, location, start_time, checkin_token)')
    .eq('id', id).maybeSingle();
  if (!s) notFound();

  const act = (s as any).activities;
  const liff = process.env.NEXT_PUBLIC_LIFF_ID;
  const link = liff ? `https://liff.line.me/${liff}/c/${act?.checkin_token}` : `/c/${act?.checkin_token}`;
  const time = (s.start_time ?? act?.start_time ?? '').slice(0, 5);
  const post = [
    `【${act?.name}】${s.session_date.slice(5).replace('-', '/')}（${WEEKDAY_LABELS[weekdayOf(s.session_date)].slice(1)}）${time} 簽到`,
    s.topic && `本次主題：${s.topic}`,
    act?.location && `地點：${act.location}`,
    '👇 活動當天點下方連結簽到',
    link,
    '（網址為 liff.line.me 開頭；只會請 LINE 授權顯示名稱，不需要密碼）',
  ].filter(Boolean).join('\n');

  // 照片表尚未建立（0005 未執行）時不影響其他功能
  const { data: photos, error: photoErr } = await db().from('session_photos')
    .select('id, path, created_at').eq('session_id', id).order('created_at');

  const { data: list } = await db().from('checkins')
    .select('id, checked_in_at, added_by, member_id, members(display_name, line_user_id)')
    .eq('session_id', id).order('checked_in_at');
  const present = new Set((list ?? []).map((c: any) => c.member_id));
  const { data: members } = await db().from('members').select('id, display_name').order('display_name').limit(500);

  return (
    <>
      <h1>{(s as any).activities?.name}・{s.session_date}</h1>
      {s.status === 'cancelled' && <p className="warn">此場次已取消，不計入統計。</p>}
      <form action={updateSessionTopic} className="card">
        <h2>本次主題</h2>
        <input type="hidden" name="id" value={id} />
        <input name="topic" defaultValue={s.topic ?? ''} maxLength={200} placeholder="例：核心肌群強化" />
        <p><button className="btn small">儲存主題</button></p>
        <label>本場群組貼文（儲存主題後再複製）</label>
        <CopyButton text={post} />
      </form>
      <div className="card">
        <h2>活動照片{photos?.length ? `（${photos.length}）` : ''}</h2>
        {photoErr ? <p className="warn">尚未啟用照片功能（請先執行 0005_session_photos.sql）。</p> : (
          <>
            <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
              {(photos ?? []).map((p) => (
                <form action={deletePhoto} key={p.id} style={{ width: 120 }}>
                  <input type="hidden" name="id" value={p.id} />
                  <a href={photoUrl(p.path)} target="_blank" rel="noreferrer">
                    <img src={photoUrl(p.path)} alt="" loading="lazy"
                      style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                  </a>
                  <div className="muted" style={{ fontSize: '.8rem' }}>{formatTaipei(p.created_at).slice(0, 16)}</div>
                  <button className="btn small danger">刪除</button>
                </form>
              ))}
            </div>
            {!photos?.length && <p className="muted">尚無照片。活動結束後可在此補上傳，系統會自動縮小。</p>}
            <PhotoUploader sessionId={id} />
          </>
        )}
      </div>
      <p>簽到 {list?.length ?? 0} 人</p>
      <div className="card scroll">
        <table>
          <thead><tr><th>顯示名稱</th><th>時間</th><th></th></tr></thead>
          <tbody>
            {(list ?? []).map((c: any) => (
              <tr key={c.id}>
                <td>{c.members?.display_name}{c.added_by ? ' （補簽）' : ''}</td>
                <td>{formatTaipei(c.checked_in_at).slice(11, 16)}</td>
                <td>
                  <form action={removeCheckin}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="session_id" value={id} />
                    <button className="btn small danger">移除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={addCheckin} className="card">
        <h2>代為補簽</h2>
        <input type="hidden" name="session_id" value={id} />
        <select name="member_id">
          {(members ?? []).filter((m) => !present.has(m.id)).map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
        <p><button className="btn small">補簽</button></p>
      </form>
    </>
  );
}
