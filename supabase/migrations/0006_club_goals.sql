-- 社團每月共同目標（人次、參與人數），由管理員在後台設定；沒設定的月份不顯示目標
create table if not exists club_goals (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  target_checkins integer not null default 0 check (target_checkins >= 0),
  target_members integer not null default 0 check (target_members >= 0),
  updated_at timestamptz not null default now()
);
alter table club_goals enable row level security;
