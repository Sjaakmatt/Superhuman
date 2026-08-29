-- Iedereen zag "Goedenavond, Sjaak" — die naam stond hardgecodeerd in de schil.
-- Met een tweede atleet erbij klopt dat niet meer, dus krijgt de naam een plek
-- in de database, naast de atleet zelf.
--
-- Twee dingen zetten we in dezelfde beweging recht. 0018 verving
-- handle_new_user() om de naslag per atleet te kopiëren, maar liet daarbij de
-- controle uit 0010 vallen: de uitnodigingsdeur stond sindsdien open en
-- can_invite werd niet meer gezet. Die functie is hieronder weer compleet.

alter table athlete add column if not exists name text;

comment on column athlete.name is
  'Hoe je aangesproken wilt worden. Leeg = de schil groet je zonder naam.';

-- ── de deur, weer op slot ───────────────────────────────────────────────────
-- De eerste gebruiker mag altijd binnen en wordt de eigenaar. Daarna komt er
-- niemand bij zonder rij in `invitation`. Deze controle staat in de database en
-- niet in een dashboard-instelling, zodat "aanmelden toestaan" per ongeluk
-- aanzetten geen gat maakt.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eerste      boolean;
  uitgenodigd boolean;
  nieuwe_id   uuid;
  sjabloon    uuid;
  banden      jsonb;
  maximum     int;
  naam        text;
begin
  select count(*) = 0 into eerste from public.athlete;
  select exists (select 1 from public.invitation i where lower(i.email) = lower(new.email))
    into uitgenodigd;

  if not eerste and not uitgenodigd then
    raise exception 'Geen uitnodiging voor %. Voeg het adres eerst toe onder Instellingen.', new.email
      using errcode = 'check_violation';
  end if;

  -- De oudste atleet dient als sjabloon voor de generieke naslag.
  select id into sjabloon from public.athlete order by created_at limit 1;

  select coalesce((value ->> 'hr_max')::int, 188), value -> 'bands'
    into maximum, banden
    from public.reference
   where key = 'zones' and (sjabloon is null or athlete_id = sjabloon)
   limit 1;

  maximum := coalesce(maximum, 188);
  banden  := coalesce(banden, '[]'::jsonb);

  -- Een naam alleen als de uitnodiging er één meegaf; we verzinnen er geen uit
  -- het mailadres, want "sjaakterveld" is niet hoe iemand heet.
  naam := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'naam',
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    ''
  )), '');

  insert into public.athlete (user_id, name, hr_max, hr_zones, can_invite)
  values (new.id, naam, maximum, banden, eerste)
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

  update public.invitation set user_id = new.id where lower(email) = lower(new.email);
  return new;
end $$;

revoke execute on function handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── wat je van jezelf mag wijzigen ──────────────────────────────────────────
-- De policy athlete_self liet je je hele eigen rij bijwerken, can_invite
-- inbegrepen: een genodigde kon zichzelf beheerder maken met één PATCH. Lezen
-- mag alles, schrijven alleen wat de app ook echt aanbiedt. Komt er een kolom
-- bij die je zelf moet kunnen zetten, dan hoort hij in deze lijst.
revoke update on athlete from authenticated;
grant update (name, hr_max, hr_zones, hr_max_measured_on) on athlete to authenticated;
