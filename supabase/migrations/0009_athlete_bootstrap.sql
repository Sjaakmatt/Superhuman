-- Zonder rij in `athlete` mislukt elke invoer, want alles hangt eraan. Die rij
-- kan pas bestaan zodra er een gebruiker is (user_id verwijst naar auth.users),
-- dus maken we hem op het moment dat je je voor het eerst aanmeldt.
--
-- hr_max en hr_zones komen uit reference.zones — niet uit code, en niet uit een
-- default die stilletjes iets anders zegt dan het plan.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.athlete (user_id, hr_max, hr_zones)
  values (
    new.id,
    coalesce((select (value ->> 'hr_max')::int from public.reference where key = 'zones'), 188),
    coalesce((select value -> 'bands' from public.reference where key = 'zones'), '[]'::jsonb)
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

-- Alleen de trigger roept hem aan; via /rest/v1/rpc/ heeft niemand er iets te zoeken.
revoke execute on function handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Wie al bestond toen deze migratie draaide, krijgt zijn rij alsnog.
insert into athlete (user_id, hr_max, hr_zones)
select u.id,
       coalesce((select (value ->> 'hr_max')::int from reference where key = 'zones'), 188),
       coalesce((select value -> 'bands' from reference where key = 'zones'), '[]'::jsonb)
from auth.users u
where not exists (select 1 from athlete a where a.user_id = u.id)
on conflict (user_id) do nothing;
