-- Nieuwe gebruikers kregen decay voor de dag vóór hun account bestond:
-- run_momentum_decay pakte target_day = gisteren, ook op dag één.
-- Fix: bij signup wordt vandaag als "al verwerkt" gemarkeerd, en de
-- decay-runner slaat gebruikers zonder volledige eerste dag over.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, last_decay_on)
  values (new.id, (now() at time zone 'Europe/Amsterdam')::date);
  insert into public.user_attributes (user_id, key)
  select new.id, k
  from unnest(array['vitaliteit','kracht','soepel','voeding','focus','geest']) as k;
  return new;
end;
$$;

create or replace function public.run_momentum_decay()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile record;
  v_local_date date;
  v_local_hour int;
  v_users int := 0;
begin
  for v_profile in
    select id, coalesce(timezone, 'Europe/Amsterdam') as tz,
           last_decay_on, created_at
    from public.profiles
  loop
    v_local_date := (now() at time zone v_profile.tz)::date;
    v_local_hour := extract(hour from now() at time zone v_profile.tz)::int;

    if v_local_hour >= 3
       and (v_profile.last_decay_on is null or v_profile.last_decay_on < v_local_date)
       -- Gratie: pas decayen als de te beoordelen dag (gisteren) een
       -- volledige dag ná de accountaanmaak is
       and (v_profile.created_at at time zone v_profile.tz)::date < v_local_date - 1
    then
      perform public.decay_user_attributes(v_profile.id, v_local_date - 1);
      update public.profiles set last_decay_on = v_local_date where id = v_profile.id;
      v_users := v_users + 1;
    end if;
  end loop;

  return jsonb_build_object('users', v_users);
end;
$$;
