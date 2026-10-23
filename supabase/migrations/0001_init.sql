-- 健身社團簽到系統：資料表、RLS、統計 view / function
-- 所有表開啟 RLS 且不建立任何 policy：anon / authenticated 一律拒絕，
-- 只有伺服器端使用 service_role key 存取（service_role 會略過 RLS）。

create extension if not exists pgcrypto;

create table members (
  id            uuid primary key default gen_random_uuid(),
  line_user_id  text not null unique,
  display_name  text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create table admins (
  line_user_id text primary key,
  added_by     text,
  created_at   timestamptz not null default now()
);

create table activities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          text not null check (kind in ('regular', 'special')),
  category      text not null,
  schedule_mode text not null check (schedule_mode in ('weekly', 'manual')),
  weekday       smallint check (weekday between 0 and 6),   -- 0=週日
  start_time    time,
  location      text not null default '',
  checkin_token text not null unique default encode(gen_random_bytes(9), 'hex'),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  check (schedule_mode <> 'weekly' or weekday is not null)
);

create table sessions (
  id                uuid primary key default gen_random_uuid(),
  activity_id       uuid not null references activities(id) on delete cascade,
  session_date      date not null,
  start_time        time,
  status            text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  cancel_reason     text,
  checkin_opens_at  timestamptz,
  checkin_closes_at timestamptz,
  created_at        timestamptz not null default now(),
  unique (activity_id, session_date)
);
create index sessions_date_idx on sessions (session_date);

create table checkins (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  member_id     uuid not null references members(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  added_by      text,                    -- 管理員代簽時記錄其 userId
  unique (session_id, member_id)
);
create index checkins_member_idx on checkins (member_id);
create index checkins_session_idx on checkins (session_id);

create table export_logs (
  id               bigint generated always as identity primary key,
  admin_line_user_id text not null,
  export_type      text not null,
  params           jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

alter table members     enable row level security;
alter table admins      enable row level security;
alter table activities  enable row level security;
alter table sessions    enable row level security;
alter table checkins    enable row level security;
alter table export_logs enable row level security;

-- ---------- 匯出用 view（取消場次不計入） ----------
create view v_checkin_detail as
select m.line_user_id,
       m.display_name,
       a.name        as activity_name,
       a.category,
       s.session_date,
       c.checked_in_at
from checkins c
join members m    on m.id = c.member_id
join sessions s   on s.id = c.session_id
join activities a on a.id = s.activity_id
where s.status = 'scheduled';

create view v_member_roster as
select m.line_user_id,
       m.display_name,
       min(s.session_date) as first_checkin_date,
       string_agg(distinct a.name, '、' order by a.name) as activities
from members m
join checkins c   on c.member_id = m.id
join sessions s   on s.id = c.session_id and s.status = 'scheduled'
join activities a on a.id = s.activity_id
group by m.id, m.line_user_id, m.display_name;

-- view 也不可被 anon 讀取
revoke all on v_checkin_detail, v_member_roster from anon, authenticated;

-- ---------- 統計報表 ----------
-- p_period: 'month' | 'year'；只計「已排定且日期 <= 今天(台北)」的場次。
-- activity_name = '【全部活動合計】' 的列為跨活動彙總（不重複人數跨活動去重）。
create or replace function report_stats(p_period text, p_from date, p_to date)
returns table (
  period text, activity_name text, category text,
  session_count bigint, total_attendance bigint, unique_members bigint,
  avg_attendance numeric, max_attendance bigint
)
language sql stable as $$
  with s as (
    select se.id, se.activity_id,
           case when p_period = 'year' then to_char(se.session_date, 'YYYY')
                else to_char(se.session_date, 'YYYY-MM') end as per,
           (select count(*) from checkins c where c.session_id = se.id) as cnt
    from sessions se
    where se.status = 'scheduled'
      and se.session_date between p_from and p_to
      and se.session_date <= (now() at time zone 'Asia/Taipei')::date
  ),
  agg as (
    select per, activity_id, count(*) as sc, sum(cnt) as tot, max(cnt) as mx
    from s group by per, activity_id
  ),
  uq as (
    select s.per, s.activity_id, count(distinct c.member_id) as u
    from s join checkins c on c.session_id = s.id group by 1, 2
  ),
  agg_all as (
    select per, count(*) as sc, sum(cnt) as tot, max(cnt) as mx from s group by per
  ),
  uq_all as (
    select s.per, count(distinct c.member_id) as u
    from s join checkins c on c.session_id = s.id group by 1
  )
  select agg.per, a.name, a.category, agg.sc, agg.tot::bigint, coalesce(uq.u, 0),
         round(agg.tot::numeric / agg.sc, 2), agg.mx::bigint
  from agg
  join activities a on a.id = agg.activity_id
  left join uq on uq.per = agg.per and uq.activity_id = agg.activity_id
  union all
  select agg_all.per, '【全部活動合計】', '', agg_all.sc, agg_all.tot::bigint, coalesce(uq_all.u, 0),
         round(agg_all.tot::numeric / agg_all.sc, 2), agg_all.mx::bigint
  from agg_all left join uq_all on uq_all.per = agg_all.per
  order by 1, 2;
$$;

revoke all on function report_stats(text, date, date) from public, anon, authenticated;
grant execute on function report_stats(text, date, date) to service_role;
