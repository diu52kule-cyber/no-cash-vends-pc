import { supabaseServer } from '@/lib/supabase-server';
import { MenuClient } from './MenuClient';
import type { MenuCategory, MenuItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MenuPage({ params }: { params: Promise<{ outletSlug: string }> }) {
  const { outletSlug } = await params;
  const supa = await supabaseServer();
  const { data: outlet } = await supa.from('outlets').select('id, currency').eq('slug', outletSlug).single();
  const [{ data: cats }, { data: items }] = await Promise.all([
    supa.from('menu_categories').select('*').eq('outlet_id', outlet!.id).order('sort'),
    supa.from('menu_items').select('*').eq('outlet_id', outlet!.id).order('sort'),
  ]);

  return (
    <MenuClient
      outletId={outlet!.id}
      currency={outlet!.currency}
      initialCategories={(cats ?? []) as MenuCategory[]}
      initialItems={(items ?? []) as MenuItem[]}
    />
  );
}
