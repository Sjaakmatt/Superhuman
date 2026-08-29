-- De sync draaide alleen 's nachts, aangeroepen door de cron. Wie na een
-- training meteen zijn cijfers wil zien moest tot de volgende ochtend wachten.
-- Nu kun je hem zelf starten, en dan wil je twee dingen weten: wanneer hij voor
-- het laatst liep, en of je niet net al op de knop drukte.

alter table strava_token add column if not exists synced_at timestamptz;
