-- ============================================================
-- NoCashVends — Supabase schema v1
-- Paste this whole file into Supabase SQL editor and run.
-- Idempotent-ish: drop+create for first run; comment drops on subsequent migrations.
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ---------- DROPS (uncomment only on first reset) ----------
-- drop table if exists waiter_calls cascade;
-- drop table if exists order_items cascade;
-- drop table if exists orders cascade;
-- drop table if exists customers cascade;
-- drop table if exists menu_items cascade;
-- drop table if exists menu_categories cascade;
-- drop table if exists tables cascade;
-- drop table if exists staff cascade;
-- drop table if exists outlets cascade;

-- ============================================================
-- OUTLETS
-- ============================================================
create table if not exists outlets (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                 -- 'raasta'
  name text not null,                        -- 'Raasta Nagpur'
  tagline text,
  address text,
  phone text,
  email text,
  gstin text,
  cgst numeric(5,2) default 2.5,
  sgst numeric(5,2) default 2.5,
  service_charge numeric(5,2) default 0,
  currency text default '₹',
  -- theme: { primary, secondary, accent, bg, surface, text, font_display, font_body, logo_key }
  theme jsonb not null default '{}'::jsonb,
  -- per-owner feature toggles
  features jsonb not null default '{
    "waiter_call": true,
    "remarks": true,
    "service_charge": false,
    "kds": true
  }'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLES (dining tables)
-- ============================================================
create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  number int not null,
  capacity int default 4,
  zone text default 'Indoor',
  qr_uid text unique not null,               -- e.g. 'tbl-001' used in customer URL
  created_at timestamptz default now(),
  unique (outlet_id, number)
);

-- ============================================================
-- MENU
-- ============================================================
create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name text not null,
  sort int default 0
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  serving text,
  emoji text,
  prep_time int default 15,
  available boolean default true,
  is_veg boolean default true,
  sort int default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- CUSTOMERS (no auth — just name + phone)
-- ============================================================
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz default now(),
  unique (outlet_id, phone)
);

-- ============================================================
-- ORDERS  (one row = one bill = one table session)
-- Status: open → closed (waiter/manager closes when guests leave)
-- A single order can have many "submissions" of items over time.
-- ============================================================
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  bill_no text unique,                       -- e.g. 'R-1041' (set via trigger or app)
  outlet_id uuid not null references outlets(id) on delete cascade,
  table_id uuid not null references tables(id) on delete restrict,
  customer_id uuid references customers(id) on delete set null,
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  opened_at timestamptz default now(),
  closed_at timestamptz
);

create index if not exists orders_outlet_status_idx on orders (outlet_id, status);
create index if not exists orders_table_status_idx  on orders (table_id, status);

-- ============================================================
-- ORDER ITEMS
-- added_by: 'customer' (via site) or 'waiter' (via waiter dashboard for water etc.)
-- ============================================================
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name_snapshot text not null,
  price_at_order numeric(10,2) not null,
  qty int not null check (qty > 0),
  status text not null default 'pending' check (status in ('pending','preparing','delivered','cancelled')),
  remark text,
  added_by text not null default 'customer' check (added_by in ('customer','waiter')),
  created_at timestamptz default now()
);

create index if not exists order_items_order_idx on order_items (order_id);

-- ============================================================
-- WAITER CALLS
-- ============================================================
create table if not exists waiter_calls (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  table_id uuid not null references tables(id) on delete cascade,
  status text not null default 'open' check (status in ('open','answered')),
  reason text,
  created_at timestamptz default now(),
  answered_at timestamptz
);

create index if not exists waiter_calls_open_idx on waiter_calls (outlet_id, status);

-- ============================================================
-- STAFF (links to Supabase auth.users)
-- ============================================================
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  role text not null check (role in ('admin','manager','waiter','chef')),
  phone text,
  email text,
  active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- BILL NO TRIGGER (simple per-outlet incrementing counter)
-- ============================================================
create table if not exists outlet_counters (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  next_bill int not null default 1001
);

create or replace function assign_bill_no()
returns trigger language plpgsql as $$
declare
  n int;
  prefix text;
begin
  insert into outlet_counters(outlet_id) values (NEW.outlet_id)
    on conflict (outlet_id) do nothing;
  update outlet_counters set next_bill = next_bill + 1
    where outlet_id = NEW.outlet_id
    returning next_bill - 1 into n;
  select upper(substr(slug,1,1)) into prefix from outlets where id = NEW.outlet_id;
  NEW.bill_no := coalesce(prefix,'B') || '-' || n::text;
  return NEW;
end $$;

drop trigger if exists trg_assign_bill_no on orders;
create trigger trg_assign_bill_no
  before insert on orders
  for each row when (NEW.bill_no is null)
  execute function assign_bill_no();

-- ============================================================
-- RLS HELPER: returns the outlet_id for the currently authenticated staff user.
-- SECURITY DEFINER lets the function read `staff` without re-triggering RLS,
-- so the policies that depend on this don't recurse.
-- ============================================================
create or replace function public.auth_user_outlet_id()
returns uuid language sql security definer stable
set search_path = public, pg_temp as $$
  select outlet_id from public.staff where auth_user_id = auth.uid() limit 1
$$;
revoke all on function public.auth_user_outlet_id() from public;
grant execute on function public.auth_user_outlet_id() to authenticated, anon, service_role;

-- ============================================================
-- RLS: lock everything down. Customer reads/writes go through backend
-- (service-role key bypasses RLS). Staff dashboards use anon key + auth.
-- ============================================================
alter table outlets          enable row level security;
alter table tables           enable row level security;
alter table menu_categories  enable row level security;
alter table menu_items       enable row level security;
alter table customers        enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table waiter_calls     enable row level security;
alter table staff            enable row level security;

-- Outlets: staff sees their own outlet
create policy "outlets_select_own" on outlets for select to authenticated
  using (id = public.auth_user_outlet_id());

-- Staff: see + modify staff in own outlet (helper makes this non-recursive)
create policy "staff_all_own_outlet" on staff for all to authenticated
  using (outlet_id = public.auth_user_outlet_id())
  with check (outlet_id = public.auth_user_outlet_id());

-- Generic per-outlet policies for tables with an outlet_id column
do $$ declare t text;
begin
  foreach t in array array['tables','menu_categories','menu_items','customers','orders','waiter_calls']
  loop
    execute format($f$
      create policy "%1$s_all_own_outlet" on %1$s for all to authenticated
        using (outlet_id = public.auth_user_outlet_id())
        with check (outlet_id = public.auth_user_outlet_id());
    $f$, t);
  end loop;
exception when duplicate_object then null;
end $$;

-- order_items: scoped via parent order's outlet_id
do $$
begin
  create policy "order_items_all_own_outlet" on order_items for all to authenticated
    using (exists (
      select 1 from orders o where o.id = order_items.order_id
        and o.outlet_id = public.auth_user_outlet_id()
    ))
    with check (exists (
      select 1 from orders o where o.id = order_items.order_id
        and o.outlet_id = public.auth_user_outlet_id()
    ));
exception when duplicate_object then null;
end $$;

-- ============================================================
-- GRANTS: restore privileges (needed if you ran `drop schema public cascade`)
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ============================================================
-- SEED: Raasta Nagpur
-- ============================================================
insert into outlets (slug, name, tagline, address, phone, email, gstin, theme, features)
values (
  'raasta',
  'Raasta Nagpur',
  'Caribbean Rooftop Lounge · Dharampeth',
  '20th Floor, Ved Solitaire, 5th Cross B St, Dharampeth Extension, Nagpur',
  '+91 99999 00000',
  'hello@raastanagpur.com',
  '27AABCR0000A1Z0',
  jsonb_build_object(
    'primary',   '#E63946',
    'secondary', '#F4C430',
    'accent',    '#2A9D4A',
    'bg',        '#0B1F1A',
    'surface',   '#14302A',
    'surface2',  '#1B3D35',
    'text',      '#FFF8EC',
    'text_dim',  '#C9D6CF',
    'font_display','Fraunces',
    'font_body', 'Inter',
    'logo_key',  'raasta'
  ),
  jsonb_build_object('waiter_call', true, 'remarks', true, 'service_charge', false, 'kds', true)
)
on conflict (slug) do update set name = excluded.name, theme = excluded.theme;

-- Tables 1-12
insert into tables (outlet_id, number, capacity, zone, qr_uid)
select o.id, n, case when n <= 4 then 2 when n <= 8 then 4 else 6 end,
       case when n <= 6 then 'Rooftop' else 'Lounge' end,
       'tbl-' || lpad(n::text, 3, '0')
from outlets o, generate_series(1, 12) n
where o.slug = 'raasta'
on conflict (qr_uid) do nothing;

-- Categories
with o as (select id from outlets where slug='raasta')
insert into menu_categories (outlet_id, name, sort)
select o.id, c.name, c.sort from o,
(values ('Small Plates',1),('Mains',2),('Caribbean Specials',3),('Breads & Sides',4),('Cocktails',5),('Mocktails',6),('Desserts',7)) as c(name, sort)
on conflict do nothing;

-- Menu items
with o as (select id from outlets where slug='raasta'),
cats as (select id, name from menu_categories where outlet_id=(select id from o))
insert into menu_items (outlet_id, category_id, name, description, price, serving, emoji, prep_time, is_veg, sort)
select (select id from o), (select id from cats where name=ci.cat), ci.name, ci.descr, ci.price, ci.serving, ci.emoji, ci.prep, ci.veg, ci.sort
from (values
  ('Small Plates', 'Jerk Chicken Wings',   'Smoky jerk-rub chicken with cooling mint dip',           420, '6 pcs',      '🍗', 18, false, 1),
  ('Small Plates', 'Plantain Chips',       'Crisp green-plantain chips with tamarind chutney',       240, 'Basket',     '🍌', 8,  true,  2),
  ('Small Plates', 'Reggae Paneer Skewers','Tandoor paneer with pineapple & bell pepper',            340, '4 skewers',  '🧀', 15, true,  3),
  ('Mains',        'Caribbean Curry Bowl', 'Coconut-curry vegetables over jasmine rice',             380, 'Bowl',       '🍛', 18, true,  1),
  ('Mains',        'Island Butter Chicken','Slow-cooked tomato-cream chicken, Raasta-style',         420, 'Full plate', '🍛', 22, false, 2),
  ('Mains',        'Rasta Pasta',          'Penne in jerk-spiced rose sauce with grilled veg',       360, 'Full plate', '🍝', 15, true,  3),
  ('Caribbean Specials','Trinidad Doubles','Curried chickpeas in soft fried flatbread',              280, '2 pcs',      '🫓', 12, true,  1),
  ('Caribbean Specials','Jamaican Beef Patty','Flaky golden pastry, spiced minced beef',              320, '2 pcs',      '🥟', 14, false, 2),
  ('Breads & Sides','Garlic Naan',         'Tandoor naan brushed with garlic butter',                 80,  '1 pc',       '🫓', 7,  true,  1),
  ('Breads & Sides','Coconut Rice',        'Steamed jasmine rice cooked in coconut milk',             160, 'Bowl',       '🍚', 10, true,  2),
  ('Cocktails',    'Kingston Mule',        'Rum, ginger beer, lime, fresh mint',                      390, '300 ml',     '🍹', 5,  true,  1),
  ('Cocktails',    'Sunset Daiquiri',      'White rum, fresh strawberry, lime',                       420, '250 ml',     '🍓', 5,  true,  2),
  ('Mocktails',    'Virgin Pina Colada',   'Pineapple, coconut cream, crushed ice',                   220, '300 ml',     '🍍', 4,  true,  1),
  ('Mocktails',    'Tropical Punch',       'Mango, passion fruit, orange, lime',                      200, '300 ml',     '🥭', 4,  true,  2),
  ('Desserts',     'Coconut Tres Leches',  'Sponge cake soaked in three milks & toasted coconut',     220, '1 slice',    '🥥', 6,  true,  1),
  ('Desserts',     'Rum & Raisin Kulfi',   'Indian kulfi with island rum-soaked raisins',             180, '1 pc',       '🍨', 4,  true,  2)
) as ci(cat, name, descr, price, serving, emoji, prep, veg, sort)
on conflict do nothing;
