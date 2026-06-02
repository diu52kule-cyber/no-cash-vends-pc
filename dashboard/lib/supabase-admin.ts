import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client — SERVER ONLY. Used for privileged admin actions
 * (creating logins, deleting users). Never import this into a client component.
 * Requires SUPABASE_SERVICE_ROLE_KEY in the dashboard environment.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set on the dashboard environment.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
