-- handle_new_user is een trigger-functie en mag niet via /rest/v1/rpc
-- aanroepbaar zijn. De trigger zelf draait als eigenaar en blijft werken.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
