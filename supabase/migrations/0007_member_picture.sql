-- 社員的 LINE 頭像網址（登入與簽到時由 LINE 驗證回傳的資料更新）
alter table members add column if not exists picture_url text;
