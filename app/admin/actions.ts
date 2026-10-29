'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { generateWeeklySessions } from '@/lib/generate';
import { isValidDate, todayTaipei } from '@/lib/time';
import { CANCEL_REASONS } from '@/lib/labels';
import { PHOTO_BUCKET } from '@/lib/photos';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function createActivity(f: FormData) {
  await requireAdmin();
  const name = str(f, 'name');
  const mode = str(f, 'schedule_mode') === 'weekly' ? 'weekly' : 'manual';
  const kind = str(f, 'kind') === 'special' ? 'special' : 'regular';
  if (!name) throw new Error('請輸入名稱');
  const weekday = mode === 'weekly' ? Number(str(f, 'weekday')) : null;
  if (mode === 'weekly' && !(weekday! >= 0 && weekday! <= 6)) throw new Error('請選擇星期');
  const date = str(f, 'session_date');
  if (date && !isValidDate(date)) throw new Error('日期格式錯誤');
  const { data: created, error } = await db().from('activities').insert({
    name, kind, category: str(f, 'category') || name, schedule_mode: mode, weekday,
    start_time: str(f, 'start_time') || null, location: str(f, 'location'),
    description: str(f, 'description'),
  }).select('id, start_time').single();
  if (error) throw new Error(error.message);
  if (mode === 'weekly') await generateWeeklySessions(4);
  // 臨時 / 單場活動：建立時直接帶入活動日期，連結馬上可用，不必再到「場次」新增
  if (mode === 'manual' && date) {
    const { error: e2 } = await db().from('sessions')
      .insert({ activity_id: created.id, session_date: date, start_time: created.start_time });
    if (e2) throw new Error(e2.message);
  }
  revalidatePath('/admin/activities');
  revalidatePath('/admin/sessions');
}

/** 編輯名稱、說明、時間、地點。排程方式與星期不可改（避免與已產生場次衝突）。 */
export async function updateActivity(f: FormData) {
  await requireAdmin();
  const name = str(f, 'name');
  if (!name) throw new Error('請輸入名稱');
  const id = str(f, 'id');
  const startTime = str(f, 'start_time') || null;
  const { error } = await db().from('activities').update({
    name, description: str(f, 'description'),
    start_time: startTime, location: str(f, 'location'),
  }).eq('id', id);
  if (error) throw new Error(error.message);

  // 場次建立時就複製了課程時間，所以儲存時一併同步今天起的所有場次（過去場次不動）
  const sync = await db().from('sessions').update({ start_time: startTime })
    .eq('activity_id', id).gte('session_date', todayTaipei());
  if (sync.error) throw new Error(sync.error.message);
  revalidatePath('/admin/sessions');
  revalidatePath('/admin/activities');
}

export async function toggleActivity(f: FormData) {
  await requireAdmin();
  const { error } = await db().from('activities')
    .update({ is_active: str(f, 'active') === 'true' }).eq('id', str(f, 'id'));
  if (error) throw new Error(error.message);
  revalidatePath('/admin/activities');
}

/** 新增場次：dates 可用換行/逗號/空白分隔多個日期（越野跑一次排多場）。 */
export async function addSessions(f: FormData) {
  await requireAdmin();
  const activityId = str(f, 'activity_id');
  const dates = str(f, 'dates').split(/[\s,，]+/).filter(Boolean);
  if (!dates.length || !dates.every(isValidDate)) throw new Error('日期格式需為 YYYY-MM-DD');
  const { data: act } = await db().from('activities').select('start_time').eq('id', activityId).single();
  const rows = dates.map((d) => ({
    activity_id: activityId, session_date: d, start_time: str(f, 'start_time') || act?.start_time || null,
  }));
  const { error } = await db().from('sessions')
    .upsert(rows, { onConflict: 'activity_id,session_date', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/sessions');
}

/** 設定單一場次的「本次主題」，顯示在簽到頁與群組貼文。 */
export async function updateSessionTopic(f: FormData) {
  await requireAdmin();
  const id = str(f, 'id');
  const { error } = await db().from('sessions').update({ topic: str(f, 'topic').slice(0, 200) }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/sessions/${id}`);
  revalidatePath('/admin/sessions');
}

/** 設定某月份的社團共同目標；兩個目標都填 0 視為不設定。 */
export async function setClubGoal(f: FormData) {
  await requireAdmin();
  const month = str(f, 'month');
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('月份格式錯誤');
  const n = (k: string) => Math.max(0, Math.min(100000, Math.floor(Number(str(f, k)) || 0)));
  const { error } = await db().from('club_goals').upsert({
    month, target_checkins: n('target_checkins'), target_members: n('target_members'),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'month' });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function deletePhoto(f: FormData) {
  await requireAdmin();
  const { data: p } = await db().from('session_photos').select('path, session_id').eq('id', str(f, 'id')).maybeSingle();
  if (!p) return;
  await db().storage.from(PHOTO_BUCKET).remove([p.path]);
  const { error } = await db().from('session_photos').delete().eq('id', str(f, 'id'));
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/sessions/${p.session_id}`);
}

export async function setSessionCancelled(f: FormData) {
  await requireAdmin();
  const cancel = str(f, 'cancel') === 'true';
  const reason = str(f, 'reason');
  const { error } = await db().from('sessions').update({
    status: cancel ? 'cancelled' : 'scheduled',
    cancel_reason: cancel ? (reason in CANCEL_REASONS ? reason : 'other') : null,
  }).eq('id', str(f, 'id'));
  if (error) throw new Error(error.message);
  revalidatePath('/admin/sessions');
  revalidatePath('/admin');
}

/** 待確認清單：「確實有上課」→ 0 人也照常計入統計，不再提醒。 */
export async function confirmHeld(f: FormData) {
  await requireAdmin();
  const { error } = await db().from('sessions')
    .update({ held_confirmed: true }).eq('id', str(f, 'id'));
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/admin/export');
}

export async function generateNow() {
  await requireAdmin();
  await generateWeeklySessions(4);
  revalidatePath('/admin/sessions');
}

export async function addAdmin(f: FormData) {
  const me = await requireAdmin();
  const id = str(f, 'line_user_id');
  if (!/^U[0-9a-f]{32}$|^U[\w-]{6,}$/i.test(id)) throw new Error('LINE userId 格式不正確');
  const { error } = await db().from('admins')
    .upsert({ line_user_id: id, added_by: me.lineUserId }, { onConflict: 'line_user_id' });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/admins');
}

export async function removeAdmin(f: FormData) {
  await requireAdmin();
  const id = str(f, 'line_user_id');
  const { count } = await db().from('admins').select('*', { count: 'exact', head: true });
  if ((count ?? 0) <= 1) throw new Error('不可移除最後一位管理員');
  const { error } = await db().from('admins').delete().eq('line_user_id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/admins');
}

export async function addCheckin(f: FormData) {
  const me = await requireAdmin();
  const { error } = await db().from('checkins')
    .insert({ session_id: str(f, 'session_id'), member_id: str(f, 'member_id'), added_by: me.lineUserId });
  if (error && error.code !== '23505') throw new Error(error.message);
  revalidatePath(`/admin/sessions/${str(f, 'session_id')}`);
}

export async function removeCheckin(f: FormData) {
  await requireAdmin();
  const { error } = await db().from('checkins').delete().eq('id', str(f, 'id'));
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/sessions/${str(f, 'session_id')}`);
}
