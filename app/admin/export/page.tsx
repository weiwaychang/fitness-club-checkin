import { requireAdmin } from '@/lib/auth';
import { todayTaipei } from '@/lib/time';

export default async function ExportPage() {
  await requireAdmin();
  const year = todayTaipei().slice(0, 4);
  return (
    <>
      <h1>匯出 CSV</h1>
      <p className="muted">檔案為 UTF-8（含 BOM），Excel 可直接開啟；LINE userId 在第一欄，方便 XLOOKUP。</p>

      <form className="card" action="/api/admin/export/detail" method="get">
        <h2>1. 簽到明細</h2>
        <label>起始日期（可留空）</label><input type="date" name="from" />
        <label>結束日期（可留空）</label><input type="date" name="to" />
        <p><button className="btn">下載</button></p>
      </form>

      <div className="card">
        <h2>2. 社員清單（供認領）</h2>
        <a className="btn" href="/api/admin/export/roster">下載</a>
      </div>

      <form className="card" action="/api/admin/export/stats" method="get">
        <h2>3. 統計報表（預算申請）</h2>
        <label>年度</label><input name="year" defaultValue={year} pattern="\d{4}" />
        <label>彙總方式</label>
        <select name="period"><option value="month">依月份</option><option value="year">依年度</option></select>
        <p><button className="btn">下載</button></p>
      </form>
    </>
  );
}
