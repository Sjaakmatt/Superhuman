-- Historische gegevens uit een Samsung Health-export.
--
-- Geen koppeling: een eenmalige import van wat er op de telefoon stond, met
-- scripts/import-samsung.ts. Daarom een derde bron naast strava en manual —
-- zo blijft zichtbaar waar een activiteit vandaan komt, en botst een
-- Samsung-sessie nooit met een Strava-sessie in (athlete_id, source,
-- external_id). Wie dezelfde training in beide bronnen heeft staan, ziet hem
-- twee keer; dat is een keuze die de eigenaar maakt, niet de import.

alter table activity drop constraint if exists activity_source_check;
alter table activity add constraint activity_source_check
  check (source in ('strava', 'manual', 'samsung'));
