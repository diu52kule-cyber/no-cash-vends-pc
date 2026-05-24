'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// Singleton — multiple instances would compete for auth, websocket, channels.
let _client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (_client) return _client;
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        params: { eventsPerSecond: 20 },
      },
    }
  );
  // Push the session JWT into the realtime socket whenever auth changes.
  // Without this, postgres_changes events RLS-filter as anonymous and silently drop.
  _client.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) _client!.realtime.setAuth(session.access_token);
  });
  // Also set immediately for the current session
  _client.auth.getSession().then(({ data }) => {
    if (data.session?.access_token) _client!.realtime.setAuth(data.session.access_token);
  });
  return _client;
}
