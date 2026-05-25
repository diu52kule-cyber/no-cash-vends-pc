import { supabaseServer } from '@/lib/supabase-server';
import { AnalyticsClient } from './AnalyticsClient';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ params }: { params: Promise<{ outletSlug: string }> }) {
  const { outletSlug } = await params;
  const supa = await supabaseServer();
  const { data: outlet } = await supa.from('outlets').select('id, currency, name').eq('slug', outletSlug).single();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await supa.from('orders')
    .select('id, bill_no, opened_at, closed_at, status, table_id')
    .eq('outlet_id', outlet!.id)
    .gte('opened_at', since)
    .order('opened_at', { ascending: true });

  const orderIds = (orders ?? []).map(o => o.id);
  const { data: items } = orderIds.length
    ? await supa.from('order_items')
        .select('order_id, name_snapshot, price_at_order, qty, status, created_at, menu_item_id')
        .in('order_id', orderIds)
    : { data: [] };

  const { data: menuItems } = await supa.from('menu_items')
    .select('id, name, category_id').eq('outlet_id', outlet!.id);
  const { data: categories } = await supa.from('menu_categories')
    .select('id, name').eq('outlet_id', outlet!.id);

  return (
    <AnalyticsClient
      outletName={outlet!.name}
      currency={outlet!.currency}
      orders={orders ?? []}
      items={items ?? []}
      menuItems={menuItems ?? []}
      categories={categories ?? []}
    />
  );
}
