'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { OrderRow, OrderItemRow, Table, Customer, WaiterCall } from '@/lib/types';

type Props = {
  outletId: string;
  currency: string;
  tables: Table[];
  initialOrders: OrderRow[];
  initialItems: OrderItemRow[];
  customers: Customer[];
  initialCalls: WaiterCall[];
};

function since(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function TablesClient({ outletId, currency, tables, initialOrders, initialItems, customers, initialCalls }: Props) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [items, setItems] = useState<OrderItemRow[]>(initialItems);
  const [calls, setCalls] = useState<WaiterCall[]>(initialCalls);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<'all' | 'empty' | 'occupied' | 'called'>('all');

  // tick the "open for X min" labels
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const custMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
  const orderByTable = useMemo(() => {
    const m = new Map<string, OrderRow>();
    orders.forEach(o => { if (o.status === 'open') m.set(o.table_id, o); });
    return m;
  }, [orders]);
  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItemRow[]>();
    items.forEach(i => { const a = m.get(i.order_id) ?? []; a.push(i); m.set(i.order_id, a); });
    return m;
  }, [items]);
  const callsByTable = useMemo(() => {
    const m = new Map<string, WaiterCall>();
    calls.forEach(c => { if (c.status === 'open') m.set(c.table_id, c); });
    return m;
  }, [calls]);

  const refetch = useCallback(async () => {
    const supa = supabaseBrowser();
    const [{ data: ords }, { data: cls }] = await Promise.all([
      supa.from('orders').select('*').eq('outlet_id', outletId).eq('status', 'open'),
      supa.from('waiter_calls').select('*').eq('outlet_id', outletId).eq('status', 'open'),
    ]);
    setOrders(ords ?? []);
    setCalls(cls ?? []);
    const ids = (ords ?? []).map(o => o.id);
    if (ids.length) {
      const { data: its } = await supa.from('order_items').select('*').in('order_id', ids);
      setItems(its ?? []);
    } else {
      setItems([]);
    }
  }, [outletId]);

  // Realtime: orders + order_items + waiter_calls for this outlet
  useEffect(() => {
    const supa = supabaseBrowser();
    let connected = false;
    let cancelled = false;
    let ch: ReturnType<typeof supa.channel> | null = null;

    (async () => {
      const { data: { session } } = await supa.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) await supa.realtime.setAuth(session.access_token);

      ch = supa.channel(`tables-${outletId}-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${outletId}` }, () => refetch())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => refetch())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls', filter: `outlet_id=eq.${outletId}` }, () => refetch())
        .subscribe((status) => {
          connected = status === 'SUBSCRIBED';
          if (status === 'SUBSCRIBED') refetch();
        });
    })();

    const onFocus = () => { if (document.visibilityState === 'visible') refetch(); };
    document.addEventListener('visibilitychange', onFocus);
    const poll = setInterval(() => { if (!connected) refetch(); }, 8000);

    return () => {
      cancelled = true;
      if (ch) supa.removeChannel(ch);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(poll);
    };
  }, [outletId, refetch]);

  async function answerCall(callId: string) {
    const supa = supabaseBrowser();
    setCalls(cs => cs.filter(c => c.id !== callId)); // optimistic
    await supa.from('waiter_calls').update({ status: 'answered', answered_at: new Date().toISOString() }).eq('id', callId);
  }

  const zones = useMemo(() => {
    const g = new Map<string, Table[]>();
    tables.forEach(t => { const z = t.zone || 'Floor'; const a = g.get(z) ?? []; a.push(t); g.set(z, a); });
    return [...g.entries()];
  }, [tables]);

  const occupied = tables.filter(t => orderByTable.has(t.id)).length;
  const empty = tables.length - occupied;
  const openCalls = calls.filter(c => c.status === 'open').length;

  const tableMatches = useCallback((t: Table) => {
    const occ = orderByTable.has(t.id);
    const called = callsByTable.has(t.id);
    if (filter === 'empty') return !occ;
    if (filter === 'occupied') return occ;
    if (filter === 'called') return called;
    return true;
  }, [filter, orderByTable, callsByTable]);

  const filterLabel = filter === 'all' ? '' :
    filter === 'empty' ? ' · showing empty' :
    filter === 'occupied' ? ' · showing occupied' : ' · showing waiter calls';

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Tables</h1>
          <p>{empty} empty · {occupied} occupied · {tables.length} total{filterLabel}</p>
        </div>
      </div>

      <div className="stat-grid">
        <button className={`stat stat-btn ${filter === 'empty' ? 'active' : ''}`} onClick={() => setFilter(f => f === 'empty' ? 'all' : 'empty')}>
          <div className="lbl">Empty tables</div><div className="val gold">{empty}</div>
        </button>
        <button className={`stat stat-btn ${filter === 'occupied' ? 'active' : ''}`} onClick={() => setFilter(f => f === 'occupied' ? 'all' : 'occupied')}>
          <div className="lbl">Occupied</div><div className="val">{occupied}</div>
        </button>
        <button className={`stat stat-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          <div className="lbl">Total tables</div><div className="val">{tables.length}</div>
        </button>
        <button className={`stat stat-btn ${filter === 'called' ? 'active' : ''}`} onClick={() => setFilter(f => f === 'called' ? 'all' : 'called')}>
          <div className="lbl">Waiter calls</div><div className="val" style={openCalls ? { color: 'var(--red)' } : undefined}>{openCalls}</div>
        </button>
      </div>

      {tables.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          No tables yet. Add tables in QR Codes to see them here.
        </div>
      )}

      {tables.length > 0 && zones.every(([, zts]) => zts.filter(tableMatches).length === 0) && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          No tables match this filter.
        </div>
      )}

      {zones.map(([zone, zts]) => {
        const shown = zts.filter(tableMatches);
        if (shown.length === 0) return null;
        return (
        <div key={zone} style={{ marginBottom: 26 }}>
          <div className="nav-head" style={{ padding: '0 0 10px' }}>{zone}</div>
          <div className="floor-grid">
            {shown.map(t => {
              const order = orderByTable.get(t.id);
              const its = order ? (itemsByOrder.get(order.id) ?? []).filter(i => i.status !== 'cancelled') : [];
              const total = its.reduce((s, i) => s + i.price_at_order * i.qty, 0);
              const cust = order?.customer_id ? custMap.get(order.customer_id) : null;
              const call = callsByTable.get(t.id);
              const occ = !!order;
              return (
                <div key={t.id} className={`tcard ${occ ? 'occ' : 'empty'} ${call ? 'calling' : ''}`}>
                  <div className="tc-top">
                    <div className="tc-num">{t.number}</div>
                    <div className={`tc-state ${occ ? 'occ' : 'empty'}`}>{occ ? 'Occupied' : 'Empty'}</div>
                  </div>

                  {occ ? (
                    <>
                      <div className="tc-meta">
                        {cust ? cust.name : 'Guest'} · {its.length} item{its.length === 1 ? '' : 's'}
                      </div>
                      <div className="tc-row">
                        <span className="tc-total">{currency}{total.toLocaleString('en-IN')}</span>
                        <span className="tc-time">{since(order!.opened_at, now)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="tc-meta empty">Seats {t.capacity} · ready</div>
                  )}

                  {call && (
                    <button className="tc-call" onClick={() => answerCall(call.id)} title="Mark as answered">
                      🛎 Calling — Answer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </>
  );
}
