export const PHOTO_BUCKET = 'session-photos';
export const MAX_PHOTOS_PER_SESSION = 12;

/** 公開網址（bucket 為公開讀取）。 */
export function photoUrl(path: string) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}
