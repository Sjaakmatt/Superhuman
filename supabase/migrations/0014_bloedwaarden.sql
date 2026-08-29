-- Zeven vaste kolommen bleken te weinig. Een gewoon huisartspanel geeft er
-- twintig terug — bezinking, hematocriet, MCV, kreatinine, eGFR, ALAT,
-- foliumzuur — en die hoorden nergens. Een volgend lab geeft weer iets anders,
-- dus de bepalingen worden rijen in plaats van kolommen. Welke er bestaan en
-- hoe ze heten staat in reference.blood_markers, bij de rest van de naslag.
--
-- blood_panel blijft de kop van een prikdag: de datum en je notitie. De
-- regel blood-due kijkt daar naar, en dat blijft zo werken.

create table if not exists blood_value (
  athlete_id uuid not null references athlete(id) on delete cascade,
  date       date not null,
  code       text not null,
  value      numeric not null,
  primary key (athlete_id, date, code)
);

create index if not exists blood_value_code_idx on blood_value (athlete_id, code, date);

alter table blood_value enable row level security;

drop policy if exists blood_value_own on blood_value;
create policy blood_value_own on blood_value
  for all to authenticated
  using (athlete_id = my_athlete_id())
  with check (athlete_id = my_athlete_id());

-- Wat er in de oude kolommen stond verhuist mee, zodat niets verdwijnt.
insert into blood_value (athlete_id, date, code, value)
select athlete_id, date, k.code, k.waarde
from blood_panel p
cross join lateral (values
  ('ferritin', p.ferritin), ('tsat', p.tsat), ('hb', p.hb),
  ('crp', p.crp), ('b12', p.b12), ('vit_d', p.vit_d), ('tsh', p.tsh)
) as k(code, waarde)
where k.waarde is not null
on conflict (athlete_id, date, code) do nothing;

alter table blood_panel
  drop column if exists ferritin,
  drop column if exists tsat,
  drop column if exists hb,
  drop column if exists crp,
  drop column if exists b12,
  drop column if exists vit_d,
  drop column if exists tsh;
