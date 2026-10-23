-- 假資料（僅供開發測試）。可重複執行前請先清空表。
-- 假管理員 userId：Uadmin0000000000000000000000000001 ~ 5
-- 假社員 userId：Udev00000000000000000000000000001 ~ 40

insert into members (line_user_id, display_name, first_seen_at)
select 'Uadmin000000000000000000000000000' || g, '管理員' || g, now() - interval '90 days'
from generate_series(1, 5) g
on conflict do nothing;

insert into members (line_user_id, display_name, first_seen_at)
select 'Udev' || lpad(g::text, 29, '0'),
       (array['小明','阿華','Amy','Jason','小美','Kevin','Linda','大雄','Tina','阿傑'])[1 + g % 10] || g,
       now() - (g || ' days')::interval
from generate_series(1, 40) g
on conflict do nothing;

insert into admins (line_user_id, added_by)
select 'Uadmin000000000000000000000000000' || g, 'seed' from generate_series(1, 5) g
on conflict do nothing;

insert into activities (name, kind, category, schedule_mode, weekday, start_time, location, checkin_token) values
  ('瑜伽課',       'regular', '瑜伽',       'weekly', 2, '18:30', '公司 B1 教室', 'dev-yoga-0001'),
  ('皮拉提斯課',   'regular', '皮拉提斯',   'weekly', 4, '18:30', '公司 B1 教室', 'dev-pilates-0001'),
  ('越野跑課',     'regular', '越野跑',     'manual', null, '07:30', '大安森林公園', 'dev-trail-0001'),
  ('象山峰健行',   'regular', '象山峰健行', 'weekly', 6, '08:00', '象山捷運站',   'dev-xiangshan-0001'),
  ('國道馬',       'special', '國道馬',     'manual', null, '05:30', '國道三號',   'dev-nh-marathon-0001'),
  ('NS RUN',       'special', 'NS RUN',     'manual', null, '06:00', '河濱公園',   'dev-nsrun-0001'),
  ('公益淨灘',     'special', '公益淨灘',   'manual', null, '09:00', '福隆海灘',   'dev-beach-0001')
on conflict do nothing;

-- 近 12 週的每週場次
insert into sessions (activity_id, session_date, start_time)
select a.id, d::date, a.start_time
from activities a
cross join generate_series((now() at time zone 'Asia/Taipei')::date - 84,
                           (now() at time zone 'Asia/Taipei')::date + 14, interval '1 day') d
where a.schedule_mode = 'weekly' and extract(dow from d)::int = a.weekday
on conflict do nothing;

-- 越野跑：每 3 週一場；特殊活動各一場
insert into sessions (activity_id, session_date, start_time)
select a.id, (now() at time zone 'Asia/Taipei')::date - (n * 21), a.start_time
from activities a, generate_series(0, 3) n where a.category = '越野跑'
on conflict do nothing;

insert into sessions (activity_id, session_date, start_time)
select a.id, (now() at time zone 'Asia/Taipei')::date - (20 + 10 * (row_number() over (order by a.name))::int), a.start_time
from activities a where a.kind = 'special'
on conflict do nothing;

-- 象山峰雨天取消兩場
update sessions set status = 'cancelled', cancel_reason = 'rain'
where id in (
  select s.id from sessions s join activities a on a.id = s.activity_id
  where a.category = '象山峰健行' and s.session_date < (now() at time zone 'Asia/Taipei')::date
  order by s.session_date desc limit 2
);

-- 隨機簽到（過去且未取消的場次；每位社員約 35% 機率出席）
insert into checkins (session_id, member_id, checked_in_at)
select s.id, m.id, s.session_date::timestamp + time '08:00' + (random() * interval '2 hours')
from sessions s
cross join members m
where s.status = 'scheduled'
  and s.session_date <= (now() at time zone 'Asia/Taipei')::date
  and m.line_user_id like 'Udev%'
  and random() < 0.35
on conflict do nothing;
