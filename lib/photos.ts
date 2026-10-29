import { db } from './db';

export const PHOTO_BUCKET = 'session-photos';
export const MAX_PHOTOS_PER_SESSION = 12;

/** 公開網址（bucket 為公開讀取）。 */
export function photoUrl(path: string) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

/** 這門課最近上傳的一張場次照片網址；沒有（或照片表尚未建立）就回傳 null。 */
export async function latestPhotoUrl(activityId: string): Promise<string | null> {
  const { data } = await db().from('session_photos')
    .select('path, sessions!inner(activity_id)').eq('sessions.activity_id', activityId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data ? photoUrl(data.path) : null;
}
