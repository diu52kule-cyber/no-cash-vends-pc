// Realtime connection soak test for the STAFF path (dashboard/waiter/KDS use
// Supabase Realtime). Opens N authenticated channels and reports how many
// successfully subscribe — this is how you find your concurrent-staff ceiling.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... OUTLET_ID=... \
//   STAFF_EMAIL=vishwesh@nocashvends.com STAFF_PASSWORD=... CONN=100 \
//   node loadtest/realtime-soak.mjs
//
// Needs @supabase/supabase-js available (run from the dashboard/ folder, or
//   npm i @supabase/supabase-js in loadtest/).
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const OUTLET_ID = process.env.OUTLET_ID;
const N = Number(process.env.CONN || 50);

if (!URL || !ANON || !OUTLET_ID) { console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, OUTLET_ID'); process.exit(1); }

const auth = createClient(URL, ANON);
const { data, error } = await auth.auth.signInWithPassword({
  email: process.env.STAFF_EMAIL, password: process.env.STAFF_PASSWORD,
});
if (error) { console.error('login failed:', error.message); process.exit(1); }
const token = data.session.access_token;

let ok = 0, fail = 0;
const t0 = Date.now();

for (let i = 0; i < N; i++) {
  const c = createClient(URL, ANON);
  await c.realtime.setAuth(token);
  c.channel(`soak-${i}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${OUTLET_ID}` }, () => {})
    .subscribe((s) => {
      if (s === 'SUBSCRIBED') ok++;
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') fail++;
    });
  await new Promise((r) => setTimeout(r, 40)); // stagger so you don't get rate-limited on the handshake
}

setInterval(() => {
  console.log(`t=${((Date.now() - t0) / 1000).toFixed(0)}s  subscribed=${ok}  failed=${fail}  target=${N}`);
}, 2000);
