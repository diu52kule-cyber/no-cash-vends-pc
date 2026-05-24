import { supabaseServer } from '@/lib/supabase-server';
import { QRClient } from './QRClient';
import type { Table } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function QRPage({ params }: { params: Promise<{ outletSlug: string }> }) {
  const { outletSlug } = await params;
  const supa = await supabaseServer();
  const { data: outlet } = await supa.from('outlets').select('id').eq('slug', outletSlug).single();
  const { data: tables } = await supa.from('tables').select('*').eq('outlet_id', outlet!.id).order('number');
  return (
    <QRClient
      outletId={outlet!.id}
      outletSlug={outletSlug}
      initialTables={(tables ?? []) as Table[]}
    />
  );
}
