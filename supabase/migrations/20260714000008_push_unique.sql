-- Eén subscription-rij per browser-endpoint per gebruiker,
-- zodat opnieuw inschakelen geen duplicaten oplevert.
create unique index if not exists push_subscriptions_user_endpoint_idx
  on public.push_subscriptions (user_id, (subscription->>'endpoint'));
