export type Cell = string | number | null | undefined;

/** 防 CSV injection：以 = + - @ Tab CR 開頭的文字前面補 '。 */
export function sanitizeCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function escape(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 回傳含 UTF-8 BOM 的 CSV，Excel 直接開啟中文不會亂碼。 */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((r) => r.map((c) => escape(sanitizeCell(c))).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
