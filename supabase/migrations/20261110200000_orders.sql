-- Order requests from the shop, and the planners' phones that get alerts.
-- Customers (not signed in) can only add a new order. Only signed-in planners can read or change them.
-- Sign-ups are switched off, so the only accounts are planners invited from the Supabase dashboard.

create extension if not exists pg_net;

create table public.orders (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'waiting' check (status in ('waiting', 'confirmed', 'offered', 'declined')),
  data jsonb not null,
  notified_at timestamptz
);

alter table public.orders enable row level security;

-- Shop visitors: insert a new waiting order only, of a sensible size, and never set notified_at.
create policy "shop can add orders" on public.orders
  for insert to anon, authenticated
  with check (status = 'waiting' and notified_at is null and octet_length(data::text) < 20000);

create policy "planners read orders" on public.orders
  for select to authenticated using (true);

create policy "planners update orders" on public.orders
  for update to authenticated using (true) with check (true);

grant insert on public.orders to anon;
grant select, insert, update on public.orders to authenticated;

-- Planner page updates live when an order arrives or another planner changes one.
alter publication supabase_realtime add table public.orders;

-- Push subscriptions: one row per planner device that turned alerts on.
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "planners manage own devices" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- New order: ask the notify-planners function to alert everyone.
-- The function only alerts once per order (it checks notified_at), so calling it twice is harmless.
create or replace function public.alert_planners() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://jeojeuqaduwefgsjyygu.supabase.co/functions/v1/notify-planners',
    body := jsonb_build_object('id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end;
$$;

create trigger orders_alert_planners
  after insert on public.orders
  for each row execute function public.alert_planners();
