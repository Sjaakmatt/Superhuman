-- Views die je één keer schrijft en overal gebruikt.

-- Gepland tegen gelopen per week. Alleen hardlopen telt mee voor de kilometers;
-- krachtsessies tellen apart. Afdaalminuten komen uit activity_descent, want
-- Strava kent die maat niet (definitie in CLAUDE.md).
create or replace view v_week_actual as
with runs as (
  select pd.week,
         a.id,
         a.athlete_id,
         a.distance_m,
         a.moving_s,
         a.elev_gain_m
  from plan_day pd
  join activity a on a.date = pd.date and a.sport_type in ('Run', 'TrailRun')
),
strength as (
  select pd.week, s.athlete_id, count(*) filter (where s.completed_at is not null) as done
  from plan_day pd
  join strength_session s on s.date = pd.date
  group by pd.week, s.athlete_id
)
select w.week,
       w.start_date,
       w.target_km,
       w.hm_target,
       w.descent_min_target,
       w.strength_sessions,
       r.athlete_id,
       coalesce(sum(r.distance_m) / 1000.0, 0)      as actual_km,
       coalesce(sum(r.moving_s) / 60.0, 0)          as actual_min,
       coalesce(sum(r.elev_gain_m), 0)              as actual_hm,
       coalesce(sum(d.descent_seconds) / 60.0, 0)   as actual_descent_min,
       coalesce(max(st.done), 0)                    as strength_done
from plan_week w
left join runs r on r.week = w.week
left join activity_descent d on d.activity_id = r.id
left join strength st on st.week = w.week and st.athlete_id = r.athlete_id
group by w.week, w.start_date, w.target_km, w.hm_target, w.descent_min_target,
         w.strength_sessions, r.athlete_id;

-- Intensiteitsverdeling over de laatste 28 dagen, in seconden per zone.
create or replace view v_intensity_28d as
select a.athlete_id, z.zone, sum(z.seconds) as seconds
from activity a
join activity_zone z on z.activity_id = a.id
where a.date > (current_date - interval '28 days')
group by a.athlete_id, z.zone;
