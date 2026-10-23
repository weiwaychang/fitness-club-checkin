import { NextResponse } from 'next/server';
import { db, fetchAll } from '@/lib/db';
import { requireAdmin, HttpError } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { formatTaipei, isValidDate, todayTaipei } from '@/lib/time';

export async function GET(req: Request, ctx: { params: Promise<{ type: string }> }) {
  try {
    const admin = await requireAdmin();
    const { type } = await ctx.params;
    const q = new URL(req.url).searchParams;
    const today = todayTaipei();
    let csv: string;
    const params: Record<string, string> = {};

    if (type === 'detail') {
      const from = q.get('from') || '2000-01-01';
      const to = q.get('to') || '2999-12-31';
      if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, '日期格式錯誤');
      Object.assign(params, { from, to });
      const rows = await fetchAll((a, b) =>
        db().from('v_checkin_detail').select('*')
          .gte('session_date', from).lte('session_date', to)
          .order('checked_in_at').range(a, b));
      csv = toCsv(
        ['LINE userId', '顯示名稱', '活動名稱', '課程類型', '日期', '簽到時間'],
        rows.map((r) => [r.line_user_id, r.display_name, r.activity_name, r.category, r.session_date, formatTaipei(r.checked_in_at)]),
      );
    } else if (type === 'roster') {
      const rows = await fetchAll((a, b) =>
        db().from('v_member_roster').select('*').order('first_checkin_date').range(a, b));
      csv = toCsv(
        ['LINE userId', '顯示名稱', '首次簽到日期', '參加過的活動'],
        rows.map((r) => [r.line_user_id, r.display_name, r.first_checkin_date, r.activities]),
      );
    } else if (type === 'stats') {
      const period = q.get('period') === 'year' ? 'year' : 'month';
      const year = q.get('year') || today.slice(0, 4);
      if (!/^\d{4}$/.test(year)) throw new HttpError(400, '年度格式錯誤');
      Object.assign(params, { period, year });
      const { data, error } = await db().rpc('report_stats', {
        p_period: period, p_from: `${year}-01-01`, p_to: `${year}-12-31`,
      });
      if (error) throw new Error(error.message);
      csv = toCsv(
        [period === 'year' ? '年度' : '月份', '活動名稱', '課程類型', '場次數', '總人次', '不重複人數', '平均出席人數', '最高出席人數'],
        (data ?? []).map((r: any) => [r.period, r.activity_name, r.category, r.session_count, r.total_attendance, r.unique_members, r.avg_attendance, r.max_attendance]),
      );
    } else {
      throw new HttpError(404, '未知的匯出類型');
    }

    await db().from('export_logs').insert({ admin_line_user_id: admin.lineUserId, export_type: type, params });
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${type}-${today}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: status === 500 ? '系統錯誤' : e.message }, { status });
  }
}
