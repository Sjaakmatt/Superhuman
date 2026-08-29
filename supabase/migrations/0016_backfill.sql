-- De sync haalde alles op vanaf de laatste opgeslagen activiteit min een dag.
-- Prima om bij te blijven, maar daarmee kun je nooit meer naar achteren: zet je
-- de ondergrens later terug, dan komt die oudere periode niet alsnog binnen.
--
-- We onthouden daarom tot hoe ver terug we al geweest zijn. Ligt dat later dan
-- de gewenste ondergrens, dan doet de eerstvolgende sync eenmalig een volle
-- haal en zet dit veld bij.

alter table strava_token add column if not exists backfilled_from date;
