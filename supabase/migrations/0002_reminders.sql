-- 上課前提醒：記錄每場次是否已提醒（避免重複傳送），以及管理員是否接收提醒。
alter table sessions add column if not exists reminder_sent_at timestamptz;
alter table admins   add column if not exists notify_reminders boolean not null default true;
