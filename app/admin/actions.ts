'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { generateWeeklySessions } from '@/lib/generate';
import { isValidDate } from '@/lib/time';
import { CANCEL_REASONS } from '@/lib/labels';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function createActivity(f: FormData) {
  await requireAdmin();
  const name = str(f, 'name');
  const mode = str(f, 'schedule_mode') === 'weekly' ? 'weekly' : 'manual';
  const kind = str(f, 'kind') === 'special' ? 'special' : 'regular';
  if (!name) throw new Error('請輸入名稱');
  const weekday = mode === 'weekly' ? Number(str(f, 'weekday')) : null;
  if (mode === 'weekly' && !(weekday! >= 0 && weekday! <= 6)) throw new Error('請選擇星期');
  const { error } = await db().from('activities').insert({
    name, kind, category: str(f, 'category') || name, schedule_mode: mode, weekday,
    start_time: str(f, 'start_time') || null, location: str(f, 'location'),
  });
  if (error) throw new Error(error.message);
  if (mode === 'weekly') await generateWeeklySessions(4);
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
