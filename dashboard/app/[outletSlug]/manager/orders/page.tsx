import { supabaseServer } from '@/lib/supabase-server';
import { OrdersClient } from './OrdersClient';
import type { OrderRow, OrderItemRow, Table, Customer } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function OrdersPage({ params }: { params: Promise<{ outletSlug: string }> }) {
  const { outletSlug } = await params;
  const supa = await supabaseServer();

  const { data: outlet } = await supa.from('outlets').select('id, currency, cgst, sgst, service_charge').eq('slug', outletSlug).single();
  const { data: orders } = await supa.from('orders').select('*').eq('outlet_id', outlet!.id).eq('status', 'open').order('opened_at', { ascending: false });
  const orderIds = (orders ?? []).map((o: OrderRow) => o.id);
  const [{ data: items }, { data: tables }, { data: customers }] = await Promise.all([
    orderIds.length
      ? supa.from('order_items').select('*').in('order_id', orderIds).order('created_at')
      : Promise.resolve({ data: [] as OrderItemRow[] }),
    supa.from('tables').select('*').eq('outlet_id', outlet!.id),
    supa.from('customers').select('id, name, phone').eq('outlet_id', outlet!.id),
  ]);

  return (
    <OrdersClient
      outletId={outlet!.id}
      currency={outlet!.currency}
      initialOrders={(orders ?? []) as OrderRow[]}
      initialItems={(items ?? []) as OrderItemRow[]}
      tables={(tables ?? []) as Table[]}
      customers={(customers ?? []) as Customer[]}
    />
  );
}
