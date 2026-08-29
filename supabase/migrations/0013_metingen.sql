-- De HRmax stond als één waarde op `athlete`. Een tweede hertest overschreef de
-- eerste, dus je kon niet zien of je maximum zakte — en dat is precies wat je
-- over 57 weken wilt weten. De metingen krijgen hun eigen rijen; `athlete`
-- houdt de laatste, want daar rekent de app mee.

create table if not exists hr_test (
  athlete_id uuid not null references athlete(id) on delete cascade,
  date       date not null,
  hr_max     int not null check (hr_max between 120 and 230),
  note       text,
  created_at timestamptz not null default now(),
  primary key (athlete_id, date)
);

alter table hr_test enable row level security;

drop policy if exists hr_test_own on hr_test;
create policy hr_test_own on hr_test
  for all to authenticated
  using (athlete_id = my_athlete_id())
  with check (athlete_id = my_athlete_id());

-- Wat al op athlete stond, blijft staan: dat is de laatste meting.
insert into hr_test (athlete_id, date, hr_max, note)
select id, hr_max_measured_on, hr_max, 'overgenomen van je profiel'
from athlete
where hr_max_measured_on is not null
on conflict (athlete_id, date) do nothing;
