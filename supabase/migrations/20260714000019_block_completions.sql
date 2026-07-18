-- Nu-motor: elk dagritme-blok per dag afvinkbaar (ook maaltijden/water die
-- geen eigen "gedaan"-actie hebben). Zo verdwijnt "Diner" van de Nu-kaart
-- zodra je 'm afvinkt, i.p.v. z'n hele venster te blijven hangen.

create table if not exists public.block_completions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  block_id bigint not null references public.schedule_blocks (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, block_id, date)
);

alter table public.block_completions enable row level security;

create policy "own block_completions"
  on public.block_completions
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create index if not exists block_completions_user_date_idx
  on public.block_completions (user_id, date);

-- Afvinken/ontvinken voor vandaag (profiel-tijdzone).
create or replace function public.set_block_done(
  p_block_id bigint,
  p_done boolean
) returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_today date := public.user_today();
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;
  if not exists (
    select 1 from public.schedule_blocks
    where id = p_block_id and user_id = v_user
  ) then
    raise exception 'Onbekend blok';
  end if;

  if p_done then
    insert into public.block_completions (user_id, block_id, date)
    values (v_user, p_block_id, v_today)
    on conflict (user_id, block_id, date) do nothing;
  else
    delete from public.block_completions
    where user_id = v_user and block_id = p_block_id and date = v_today;
  end if;

  return jsonb_build_object('block_id', p_block_id, 'done', p_done);
end;
$function$;

grant execute on function public.set_block_done(bigint, boolean) to authenticated;
