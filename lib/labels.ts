/** 取消原因（存入 sessions.cancel_reason 的代碼 → 顯示文字） */
export const CANCEL_REASONS: Record<string, string> = {
  holiday: '連假/放假',
  typhoon: '颱風假',
  rain: '雨天',
  instructor: '講師請假',
  other: '其他',
};

export function cancelLabel(reason?: string | null): string {
  return (reason && CANCEL_REASONS[reason]) || '已取消';
}
