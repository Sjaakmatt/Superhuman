-- Views draaien in Postgres standaard met de rechten van hun eigenaar, niet van
-- de bevrager. Daarmee omzeilen v_week_actual en v_intensity_28d de RLS op
-- activity en strength_session — precies wat we met RLS wilden voorkomen.
-- security_invoker zet dat recht: de view ziet wat jij mag zien.
alter view v_week_actual set (security_invoker = on);
alter view v_intensity_28d set (security_invoker = on);

-- my_athlete_id() hoort alleen bij het evalueren van de RLS-policies, en die
-- draaien als `authenticated`. Uitgelogde bezoekers hebben er niets te zoeken;
-- via /rest/v1/rpc/ was hij anders gewoon aan te roepen.
revoke execute on function my_athlete_id() from public, anon;
grant execute on function my_athlete_id() to authenticated;
