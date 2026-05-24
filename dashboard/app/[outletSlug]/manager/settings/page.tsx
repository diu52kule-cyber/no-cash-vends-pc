import { supabaseServer } from '@/lib/supabase-server';
import { SettingsClient } from './SettingsClient';
import type { Outlet } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ params }: { params: Promise<{ outletSlug: string }> }) {
  const { outletSlug } = await params;
  const supa = await supabaseServer();
  const { data: outlet } = await supa.from('outlets').select('*').eq('slug', outletSlug).single();
  return <SettingsClient initialOutlet={outlet as Outlet} />;
}
