-- Het gesprek met de coach. Bewust een gewone tabel achter RLS: een chat die
-- bij het herladen leeg is, is voor een coach nutteloos — je verwijst naar wat
-- je vorige week vroeg.
--
-- We bewaren alleen de tekst van beide kanten. De cijfers die bij een vraag
-- hoorden bewaren we niet: die veranderen, en een antwoord van vorige maand
-- opnieuw onderbouwen met de cijfers van vandaag zou misleidend zijn. Daarom
-- staat `asof` erbij — de dag waarop het antwoord is gegeven.

create table if not exists chat_message (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references athlete(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  asof        date not null,
  created_at  timestamptz not null default now()
);

create index if not exists chat_message_athlete_idx
  on chat_message (athlete_id, created_at);

alter table chat_message enable row level security;

drop policy if exists chat_message_self on chat_message;
create policy chat_message_self on chat_message
  for all to authenticated
  using (athlete_id = my_athlete_id())
  with check (athlete_id = my_athlete_id());
