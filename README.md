# 健身社團簽到統計系統

Next.js 15 + Supabase + Vercel，LINE LIFF 登入，手機優先、繁體中文。設計細節見規劃文件。

## 本機開發（假資料）
1. `npm install`
2. 建立 Supabase 專案，在 SQL Editor 依序執行 `supabase/migrations/0001_init.sql`、`supabase/seed.sql`
3. `copy .env.example .env.local`，填入 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`，
   `SESSION_SECRET` 設 32 字元以上隨機字串，`DEV_MOCK_LOGIN=true`
4. `npm run dev`，開 `http://localhost:3000/dev-login` 選擇假社員/管理員登入
5. 簽到連結範例：`/c/dev-yoga-0001`（僅「今天」有場次才能簽到；種子資料瑜伽=週二、皮拉提斯=週四、象山=週六）
6. `npm test` 執行單元測試

## 上線設定
- LINE Developers：建立 LINE Login channel → 新增 LIFF app（Endpoint URL 為 Vercel 網址，scope 勾 `openid` `profile`）
- Vercel 環境變數：`NEXT_PUBLIC_LIFF_ID`、`LINE_CHANNEL_ID`、`SESSION_SECRET`、`SUPABASE_URL`、
  `SUPABASE_SERVICE_ROLE_KEY`、`INITIAL_ADMIN_USER_IDS`（5 位管理員 userId）、`CRON_SECRET`；**不要**設 `DEV_MOCK_LOGIN`
- 正式環境不要執行 `seed.sql`
- 簽到連結格式：`https://liff.line.me/<LIFF_ID>/c/<token>`，在「管理 → 課程/活動」可複製
- `vercel.json` 每週一 00:00（台北）自動補產生未來 4 週的每週場次

## 安全設計
- DB 全表 RLS 且無 policy，僅伺服器端 service role 存取；service role key 不可外洩到前端
- ID token 由伺服器向 LINE 驗證後發自家 session cookie；管理員權限每次請求查 `admins` 表
- 一人一場一次：`checkins unique(session_id, member_id)`
- CSV 防 formula injection、含 BOM；每次匯出寫入 `export_logs`
