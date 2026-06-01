import { supabaseServer } from '@/lib/supabase-server';
import { TablesClient } from './TablesClient';
import type { OrderRow, OrderItemRow, Table, Customer, WaiterCall } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TablesPage({ params }: { params: Promise<{ outletSlug: string }> }) {
  const { outletSlug } = await params;
  const supa = await supabaseServer();

  const { data: outlet } = await supa.from('outlets').select('id, currency').eq('slug', outletSlug).single();

  const [{ data: tables }, { data: orders }, { data: customers }, { data: calls }] = await Promise.all([
    supa.from('tables').select('*').eq('outlet_id', outlet!.id).order('number'),
    supa.from('orders').select('*').eq('outlet_id', outlet!.id).eq('status', 'open'),
    supa.from('customers').select('id, name, phone').eq('outlet_id', outlet!.id),
    supa.from('waiter_calls').select('*').eq('outlet_id', outlet!.id).eq('status', 'open'),
  ]);

  const orderIds = (orders ?? []).map((o: OrderRow) => o.id);
  const { data: items } = orderIds.length
    ? await supa.from('order_items').select('*').in('order_id', orderIds)
    : { data: [] as OrderItemRow[] };

  return (
    <TablesClient
      outletId={outlet!.id}
      currency={outlet!.currency}
      tables={(tables ?? []) as Table[]}
      initialOrders={(orders ?? []) as OrderRow[]}
      initialItems={(items ?? []) as OrderItemRow[]}
      customers={(customers ?? []) as Customer[]}
      initialCalls={(calls ?? []) as WaiterCall[]}
    />
  );
}
