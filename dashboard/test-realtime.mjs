// Verifies Supabase Realtime delivers INSERT/UPDATE/DELETE events to an
// authenticated client. Useful when "live updates aren't working" — run this
// to isolate whether it's a server/db config issue (this fails) or a browser/client
// issue (this passes but the dashboard doesn't update).
//
// Usage (from dashboard/):
//   SUPABASE_URL=... ANON_KEY=... SERVICE_KEY=... ADMIN_EMAIL=... ADMIN_PASS=... node test-realtime.mjs
// Or with a .env.local loaded via your shell.
import { createClient } from '@supabase/supabase-js';

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.ANON_KEY;
const SRV  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_KEY;
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASS;
for (const [k, v] of Object.entries({ URL, ANON, SRV, EMAIL, PASS })) {
  if (!v) { console.error(`Missing ${k}`); process.exit(1); }
}

const userClient = createClient(URL, ANON);
const { data: sess, error: e1 } = await userClient.auth.signInWithPassword({ email: EMAIL, password: PASS });
if (e1) { console.error('login failed', e1); process.exit(1); }
console.log('logged in:', sess.user.email);

await userClient.realtime.setAuth(sess.session.access_token);

const { data: outlet } = await userClient.from('outlets').select('id').limit(1).single();
console.log('outlet visible:', outlet);

const received = [];
const ch = userClient.channel('test-realtime-' + Date.now())
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'menu_items', filter: `outlet_id=eq.${outlet.id}` },
    p => { console.log('  ←', p.eventType, p.new?.name ?? p.old?.name ?? '?'); received.push(p); })
  .subscribe(s => console.log('channel status:', s));

await new Promise(r => setTimeout(r, 2500));
const srv = createClient(URL, SRV);
const { data: ins } = await srv.from('menu_items').insert({
  outlet_id: outlet.id, name: 'RT_TEST_' + Date.now(), price: 1, prep_time: 1,
}).select().single();
console.log('  →', 'INSERT', ins.name);

await new Promise(r => setTimeout(r, 1500));
await srv.from('menu_items').update({ name: ins.name + '_X' }).eq('id', ins.id);
console.log('  →', 'UPDATE');

await new Promise(r => setTimeout(r, 1500));
await srv.from('menu_items').delete().eq('id', ins.id);
console.log('  →', 'DELETE');

await new Promise(r => setTimeout(r, 2000));
console.log('\nReceived', received.length, '/ 3 events');
process.exit(received.length === 3 ? 0 : 1);
