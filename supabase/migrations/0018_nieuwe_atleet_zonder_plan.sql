-- Bij de eerste aanmelding werd hr_max en hr_zones uit `reference` gehaald. Die
-- tabel heeft sinds 0017 een eigenaar, dus die query pakt nu de rij van iemand
-- anders — of meerdere, en dan faalt hij.
--
-- Wie erbij komt krijgt daarom zijn eigen naslag: de zonebanden (percentages van
-- een maximumhartslag, geen trainingsinhoud) en de lijst bloedbepalingen. Géén
-- plan, géén mijlpalen, géén voedingsfases: dat is wat iemand anders doet.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nieuwe_id uuid;
  sjabloon  uuid;
  banden    jsonb;
  maximum   int;
begin
  -- De oudste atleet dient als sjabloon voor de generieke naslag.
  select id into sjabloon from public.athlete order by created_at limit 1;

  select coalesce((value ->> 'hr_max')::int, 188), value -> 'bands'
    into maximum, banden
    from public.reference
   where key = 'zones' and (sjabloon is null or athlete_id = sjabloon)
   limit 1;

  maximum := coalesce(maximum, 188);
  banden  := coalesce(banden, '[]'::jsonb);

  insert into public.athlete (user_id, hr_max, hr_zones)
  values (new.id, maximum, banden)
  on conflict (user_id) do nothing
  returning id into nieuwe_id;

  if nieuwe_id is null then
    select id into nieuwe_id from public.athlete where user_id = new.id;
  end if;

  -- Zones en bloedbepalingen zijn algemeen: een schaal en een lijstje namen.
  -- Mijlpalen, voedingsfases en krachtfases niet — die horen bij een plan.
  if sjabloon is not null and nieuwe_id is not null and nieuwe_id <> sjabloon then
    insert into public.reference (athlete_id, key, value)
    select nieuwe_id, key, value
      from public.reference
     where athlete_id = sjabloon and key in ('zones', 'blood_markers')
    on conflict (athlete_id, key) do nothing;
  end if;

  return new;
end $$;

revoke execute on function handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
