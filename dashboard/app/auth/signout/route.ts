import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supa = await supabaseServer();
  await supa.auth.signOut();

  // Behind Railway's proxy req.url == http://localhost:3000/...
  // Always rebuild the public URL from forwarded headers.
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost';
  const res = NextResponse.redirect(`${proto}://${host}/login`, { status: 303 });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.headers.set('Pragma', 'no-cache');
  return res;
}

export const GET = POST;
