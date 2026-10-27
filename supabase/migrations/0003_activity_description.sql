-- 課程說明：顯示在簽到頁與 LINE 連結預覽。請在「測試專案」與「正式專案」各執行一次，可重複執行。
-- 建議在 push / 部署新程式「之前」先執行。
alter table activities add column if not exists description text not null default '';
