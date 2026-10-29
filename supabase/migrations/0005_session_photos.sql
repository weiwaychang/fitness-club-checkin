-- 場次照片：檔案放在 Storage bucket「session-photos」，這張表記錄誰、何時上傳
-- bucket 設為公開讀取（LINE 連結預覽圖需要公開網址；檔名為隨機 uuid，不可猜）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('session-photos', 'session-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create table if not exists session_photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  path text not null unique,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists session_photos_session_idx on session_photos(session_id);
alter table session_photos enable row level security;
