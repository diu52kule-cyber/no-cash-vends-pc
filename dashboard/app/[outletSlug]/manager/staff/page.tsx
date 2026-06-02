import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import { StaffClient } from './StaffClient';
import type { Staff } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function StaffPage({ params }: { params: Promise<{ outletSlug: string }> }) {
  const { outletSlug } = await params;
  const supa = await supabaseServer();
  const { data: { user } } = await supa.auth.getUser();

  const { data: outlet } = await supa.from('outlets').select('id, name').eq('slug', outletSlug).single();
  const { data: me } = await supa.from('staff')
    .select('role').eq('auth_user_id', user!.id).eq('outlet_id', outlet!.id).maybeSingle();

  // page is admin-only
  if (me?.role !== 'admin') redirect(`/${outletSlug}/manager/orders`);

  const { data: staff } = await supa.from('staff')
    .select('*').eq('outlet_id', outlet!.id).order('role').order('name');

  return (
    <StaffClient
      outletSlug={outletSlug}
      currentUserId={user!.id}
      staff={(staff ?? []) as Staff[]}
    />
  );
}
