-- 場次審核：0 人簽到的過期場次進入「待確認」清單，由管理員決定「未開課(取消)」或「確實有上課」。
-- 請在「測試專案」與「正式專案」的 SQL Editor 各執行一次。可重複執行。

alter table sessions add column if not exists held_confirmed boolean not null default false;

-- 待確認：已過期、未取消、未確認有上課、且 0 人簽到
create or replace view v_pending_sessions as
select s.id, s.session_date, a.name as activity_name
from sessions s
join activities a on a.id = s.activity_id
where s.status = 'scheduled'
  and not s.held_confirmed
  and s.session_date < (now() at time zone 'Asia/Taipei')::date
  and not exists (select 1 from checkins c where c.session_id = s.id);

revoke all on v_pending_sessions from anon, authenticated;

-- 統計：只計「已排定、日期 <= 今天(台北)、且（至少 1 人簽到 或 已確認有上課）」的場次。
-- 0 人且未確認的場次先不計入，避免尚未處理時平均出席被拉低。
create or replace function report_stats(p_period text, p_from date, p_to date)
returns table (
  period text, activity_name text, category text,
  session_count bigint, total_attendance bigint, unique_members bigint,
  avg_attendance numeric, max_attendance bigint
)
language sql stable as $$
  with s0 as (
    select se.id, se.activity_id, se.held_confirmed,
           case when p_period = 'year' then to_char(se.session_date, 'YYYY')
                else to_char(se.session_date, 'YYYY-MM') end as per,
           (select count(*) from checkins c where c.session_id = se.id) as cnt
    from sessions se
    where se.status = 'scheduled'
      and se.session_date between p_from and p_to
      and se.session_date <= (now() at time zone 'Asia/Taipei')::date
  ),
  s as (select * from s0 where cnt > 0 or held_confirmed),
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
