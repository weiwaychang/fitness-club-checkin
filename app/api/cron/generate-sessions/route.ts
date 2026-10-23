import { NextResponse } from 'next/server';
import { generateWeeklySessions } from '@/lib/generate';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const created = await generateWeeklySessions(4);
  return NextResponse.json({ ok: true, created });
}
