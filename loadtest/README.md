# Load testing NoCashVends

Two independent ceilings — test them separately.

## 1. Diner throughput (HTTP → backend → Supabase PostgREST)

Install [k6](https://k6.io/docs/get-started/installation/), then ramp up until
errors climb or p95 latency blows past your threshold:

```bash
# read-only (safe): 200 simulated diners
k6 run -e BASE_URL=https://YOUR-BACKEND.up.railway.app -e VUS=200 loadtest/customer-load.js

# include order writes (creates real rows — clean up after)
k6 run -e BASE_URL=... -e VUS=200 -e DO_ORDERS=1 loadtest/customer-load.js
```

Re-run with `-e VUS=` 100 → 300 → 600 → 1000. **Your capacity = the VUS level
where `http_req_failed` stays < 1% and `p95 < 800ms`.** The single dominant
sustained cost is the `/orders/active` poll every 12s, so steady RPS ≈ VUS / 12.

Watch while it runs:
- **Supabase → Reports**: database CPU, then **Settings → Database → connection
  pooler** usage. PostgREST pools connections, so CPU saturates before
  connections do — CPU near 100% is your wall → bump the compute add-on.
- **Railway → backend service → Metrics**: CPU/RAM. If the backend pegs CPU
  before Supabase does, add a replica / bigger instance.

## 2. Concurrent staff screens (Supabase Realtime websockets)

Only manager/waiter/KDS use realtime (diners poll). Find the websocket ceiling:

```bash
cd dashboard   # so @supabase/supabase-js resolves
SUPABASE_URL=https://rihchcpiokogkyuofgck.supabase.co \
SUPABASE_ANON_KEY=<anon key> \
OUTLET_ID=<raasta outlet id> \
STAFF_EMAIL=vishwesh@nocashvends.com STAFF_PASSWORD=<pwd> \
CONN=100 node ../loadtest/realtime-soak.mjs
```

Raise `CONN` until `failed` starts growing — that's your realtime cap (a plan
limit, not a code limit). Free tier ≈ 200 concurrent; Pro ≈ 500 and raisable.
One real outlet uses maybe 5–15, so this scales with **number of outlets**, not diners.

## Safety
- Point tests at a **dedicated test table** (make a throwaway QR/table in
  Manager → QR Codes) so you don't pollute a live floor.
- Writes fan out to every staff realtime sub — don't run `DO_ORDERS=1` at high
  VUS while real staff are working.
- These run against your **live Railway + Supabase**, so you're testing the
  real stack but also burning real compute/quota. Watch the Supabase usage page.

## Cleanup after write tests
Edit `TEST_TABLE_ID`, review, then run in the Supabase SQL editor:
see `cleanup.sql`.
