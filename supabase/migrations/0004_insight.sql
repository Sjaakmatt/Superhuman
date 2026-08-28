-- Wat de app terugzegt. `rule_hits` legt vast welke deterministische regels
-- vuurden: elke waarschuwing is terug te voeren op een regel die je kunt lezen.

create table if not exists insight (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references athlete(id) on delete cascade,
  kind         text not null check (kind in ('daily','weekly','longrun','debrief','alert')),
  period_start date not null,
  period_end   date not null,
  body_md      text not null,
  findings     jsonb not null default '[]'::jsonb,
  proposals    jsonb not null default '[]'::jsonb,
  rule_hits    jsonb not null default '[]'::jsonb,
  status       text not null default 'new' check (status in ('new','accepted','dismissed')),
  created_at   timestamptz not null default now()
);
create index if not exists insight_recent_idx on insight (athlete_id, kind, created_at desc);
-- Eén analyse per soort per periode; opnieuw draaien overschrijft.
create unique index if not exists insight_period_idx on insight (athlete_id, kind, period_start, period_end);

create table if not exists plan_adjustment (
  id         uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athlete(id) on delete cascade,
  date       date not null references plan_day(date),
  field      text not null,
  old_value  text,
  new_value  text,
  source     text not null check (source in ('ai','user')),
  insight_id uuid references insight(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists plan_adjustment_date_idx on plan_adjustment (date);
