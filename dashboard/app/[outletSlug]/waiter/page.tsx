import { supabaseServer } from '@/lib/supabase-server';
import { WaiterClient } from './WaiterClient';
import type { Outlet, Table, OrderRow, OrderItemRow, MenuItem, MenuCategory, Customer, Staff } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function WaiterPage({ params }: { params: Promise<{ outletSlug: string }> }) {
  const { outletSlug } = await params;
  const supa = await supabaseServer();
  const { data: { user } } = await supa.auth.getUser();

  const { data: outlet } = await supa.from('outlets').select('*').eq('slug', outletSlug).single();
  const { data: staff } = await supa.from('staff').select('*').eq('auth_user_id', user!.id).eq('outlet_id', outlet!.id).single();

  const [{ data: tables }, { data: orders }, { data: menuCats }, { data: menuItems }, { data: customers }, { data: waiterCalls }] = await Promise.all([
    supa.from('tables').select('*').eq('outlet_id', outlet!.id).order('number'),
    supa.from('orders').select('*').eq('outlet_id', outlet!.id).eq('status', 'open'),
    supa.from('menu_categories').select('*').eq('outlet_id', outlet!.id).order('sort'),
    supa.from('menu_items').select('*').eq('outlet_id', outlet!.id).eq('available', true).order('sort'),
    supa.from('customers').select('id, name, phone').eq('outlet_id', outlet!.id),
    supa.from('waiter_calls').select('*').eq('outlet_id', outlet!.id).eq('status', 'open'),
  ]);

  const orderIds = (orders ?? []).map(o => o.id);
  const { data: items } = orderIds.length
    ? await supa.from('order_items').select('*').in('order_id', orderIds).order('created_at')
    : { data: [] };

  return (
    <WaiterClient
      outlet={outlet as Outlet}
      staff={staff as Staff}
      initialTables={(tables ?? []) as Table[]}
      initialOrders={(orders ?? []) as OrderRow[]}
      initialItems={(items ?? []) as OrderItemRow[]}
      menuItems={(menuItems ?? []) as MenuItem[]}
      menuCategories={(menuCats ?? []) as MenuCategory[]}
      customers={(customers ?? []) as Customer[]}
      initialCalls={(waiterCalls ?? []) as any[]}
    />
  );
}
