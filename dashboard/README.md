# NoCashVends — Manager Dashboard

Next.js 15 (App Router) + Supabase (SSR auth + RLS + Realtime). Multi-outlet from day 1.

## Pages
- `/login` — email/password sign-in
- `/[outletSlug]/manager/orders` — live bills, status cycle, print, close
- `/[outletSlug]/manager/menu` — full CRUD, availability toggle
- `/[outletSlug]/manager/qr` — per-table QR generator pointing at customer site
- `/[outletSlug]/manager/settings` — outlet, tax, features

## First-time admin setup (per outlet)
1. **Create the auth user** in Supabase Dashboard → Authentication → Users → "Add user" → email + password (mark "Auto Confirm User").
2. **Link the user to staff** — open the SQL editor and run, replacing the placeholders:
   ```sql
   insert into staff (outlet_id, auth_user_id, name, role, email)
   select o.id, u.id, 'Your Name', 'admin', u.email
   from outlets o, auth.users u
   where o.slug = 'raasta' and u.email = 'YOU@example.com';
   ```
3. Open `/login`, sign in. You'll land on `/raasta/manager/orders`.

## Env vars (set in Railway when deploying)
| Var | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from same panel (the `anon` / publishable key) |
| `NEXT_PUBLIC_CUSTOMER_SITE_URL` | https://beneficial-charm-production-d3c1.up.railway.app |

## How the data layer works
- The dashboard talks **directly to Supabase** with the user's JWT.
- RLS policies (in `supabase/schema.sql`) scope every read/write to rows where `outlet_id` matches the logged-in staff member's outlet.
- Realtime subscriptions (in `OrdersClient.tsx`) listen to `orders` and `order_items` so new customer orders appear instantly with a pulse + ding.

## Build locally
```powershell
cp .env.example .env.local
# edit .env.local
npm install
npm run dev
```
