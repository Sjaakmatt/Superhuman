-- Een mijlpaal stond in de naslag, maar er was nergens plek voor wat eruit
-- kwam. Een trailtest, een wedstrijd, een beslissing: je wilt kunnen afvinken
-- dat het gebeurd is en opschrijven wat je zag.
--
-- De sleutel is de datum van de mijlpaal, niet een eigen id: de mijlpalen
-- staan vast in reference en verschuiven niet.

create table if not exists milestone_result (
  athlete_id uuid not null references athlete(id) on delete cascade,
  date       date not null,
  done       boolean not null default true,
  outcome    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (athlete_id, date)
);

alter table milestone_result enable row level security;

drop policy if exists milestone_result_own on milestone_result;
create policy milestone_result_own on milestone_result
  for all to authenticated
  using (athlete_id = my_athlete_id())
  with check (athlete_id = my_athlete_id());

-- De HRmax stond op een leeftijdsformule. Na de test in week 6 is hij gemeten,
-- en dat verschil moet zichtbaar blijven: een gemeten waarde vertrouw je, een
-- geschatte niet.
alter table athlete add column if not exists hr_max_measured_on date;
