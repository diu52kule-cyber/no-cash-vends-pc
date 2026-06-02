import { supabaseServer } from '@/lib/supabase-server';
import { KdsClient } from './KdsClient';
import type { Outlet, Table, OrderRow, OrderItemRow, Customer, MenuCategory, MenuItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function KdsPage({ params }: { params: Promise<{ outletSlug: string }> }) {
  const { outletSlug } = await params;
  const supa = await supabaseServer();

  const { data: outlet } = await supa.from('outlets').select('*').eq('slug', outletSlug).single();

  const [{ data: tables }, { data: orders }, { data: customers }, { data: cats }, { data: menuItems }] = await Promise.all([
    supa.from('tables').select('*').eq('outlet_id', outlet!.id).order('number'),
    supa.from('orders').select('*').eq('outlet_id', outlet!.id).eq('status', 'open'),
    supa.from('customers').select('id, name, phone').eq('outlet_id', outlet!.id),
    supa.from('menu_categories').select('id, name, station').eq('outlet_id', outlet!.id),
    supa.from('menu_items').select('id, category_id').eq('outlet_id', outlet!.id),
  ]);

  const orderIds = (orders ?? []).map((o: OrderRow) => o.id);
  const { data: items } = orderIds.length
    ? await supa.from('order_items').select('*').in('order_id', orderIds).order('created_at')
    : { data: [] as OrderItemRow[] };

  return (
    <KdsClient
      outlet={outlet as Outlet}
      initialOrders={(orders ?? []) as OrderRow[]}
      initialItems={(items ?? []) as OrderItemRow[]}
      tables={(tables ?? []) as Table[]}
      customers={(customers ?? []) as Customer[]}
      categories={(cats ?? []) as MenuCategory[]}
      menuItems={(menuItems ?? []) as Pick<MenuItem, 'id' | 'category_id'>[]}
    />
  );
}
