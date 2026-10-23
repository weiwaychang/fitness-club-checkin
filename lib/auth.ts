import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';

export type SessionUser = { memberId: string; lineUserId: string; name: string };

const COOKIE = 'fc_session';
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET 至少需 32 字元');
  return new TextEncoder().encode(s);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ mid: user.memberId, uid: user.lineUserId, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { memberId: String(payload.mid), lineUserId: String(payload.uid), name: String(payload.name ?? '') };
  } catch {
    return null;
  }
}

export async function requireMember(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new HttpError(401, '請先登入');
  return s;
}

export async function isAdmin(lineUserId: string): Promise<boolean> {
  await ensureInitialAdmins();
  const { data } = await db().from('admins').select('line_user_id').eq('line_user_id', lineUserId).maybeSingle();
  return !!data;
}

/** 每次請求即時查白名單，增減立即生效。 */
export async function requireAdmin(): Promise<SessionUser> {
  const s = await requireMember();
  if (!(await isAdmin(s.lineUserId))) throw new HttpError(403, '需要管理員權限');
  return s;
}

/** admins 表為空時，以環境變數 INITIAL_ADMIN_USER_IDS 初始化。 */
async function ensureInitialAdmins() {
  const { count } = await db().from('admins').select('*', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return;
  const ids = (process.env.INITIAL_ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length) {
    await db().from('admins').upsert(ids.map((id) => ({ line_user_id: id, added_by: 'env' })), { onConflict: 'line_user_id' });
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function devMockEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_MOCK_LOGIN === 'true';
}
