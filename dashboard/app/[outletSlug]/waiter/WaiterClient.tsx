'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { AddItemsModal } from './AddItemsModal';
import type { Outlet, Staff, Table, OrderRow, OrderItemRow, MenuItem, MenuCategory, Customer } from '@/lib/types';

type WaiterCall = { id: string; outlet_id: string; table_id: string; status: 'open' | 'answered'; reason: string | null; created_at: string };

const STATUS_CYCLE: Record<OrderItemRow['status'], OrderItemRow['status']> = {
  pending: 'preparing', preparing: 'ready', ready: 'served', served: 'pending', cancelled: 'pending',
};
const STATUS_LABEL: Record<OrderItemRow['status'], string> = {
  pending: 'Pending', preparing: 'Preparing', ready: 'Ready', served: 'Served', cancelled: 'Cancelled',
};

type Filter = 'all' | 'occupied' | 'called' | 'free';

export function WaiterClient({
  outlet, staff, initialTables, initialOrders, initialItems, menuItems, menuCategories, customers, initialCalls,
}: {
  outlet: Outlet; staff: Staff;
  initialTables: Table[]; initialOrders: OrderRow[]; initialItems: OrderItemRow[];
  menuItems: MenuItem[]; menuCategories: MenuCategory[]; customers: Customer[];
  initialCalls: WaiterCall[];
}) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [items, setItems] = useState<OrderItemRow[]>(initialItems);
  const [calls, setCalls] = useState<WaiterCall[]>(initialCalls);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Detect viewport — keeps grid-on-mobile-only-when-no-table-selected logic
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Hardware back on Android → return to grid view (don't exit the page)
  useEffect(() => {
    if (!isMobile || !selectedTableId) return;
    window.history.pushState({ waiterDetail: true }, '');
    const onPop = () => setSelectedTableId(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isMobile, selectedTableId]);

  // On desktop default to first table; on mobile start at grid (no selection)
  useEffect(() => {
    if (!isMobile && !selectedTableId && initialTables[0]) {
      setSelectedTableId(initialTables[0].id);
    }
  }, [isMobile, selectedTableId, initialTables]);

  const tableMap = useMemo(() => new Map(initialTables.map(t => [t.id, t])), [initialTables]);
  const custMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
  const orderByTable = useMemo(() => {
    const m = new Map<string, OrderRow>();
    orders.forEach(o => { if (o.status === 'open') m.set(o.table_id, o); });
    return m;
  }, [orders]);
  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItemRow[]>();
    items.forEach(i => { const arr = m.get(i.order_id) ?? []; arr.push(i); m.set(i.order_id, arr); });
    return m;
  }, [items]);
  const callsByTable = useMemo(() => {
    const m = new Map<string, WaiterCall>();
    calls.forEach(c => { if (c.status === 'open') m.set(c.table_id, c); });
    return m;
  }, [calls]);

  const filteredTables = useMemo(() => {
    return initialTables.filter(t => {
      const hasOrder = orderByTable.has(t.id);
      const hasCall = callsByTable.has(t.id);
      if (filter === 'occupied') return hasOrder;
      if (filter === 'free') return !hasOrder;
      if (filter === 'called') return hasCall;
      return true;
    });
  }, [initialTables, orderByTable, callsByTable, filter]);

  const selectedTable = selectedTableId ? tableMap.get(selectedTableId) : null;
  const selectedOrder = selectedTable ? orderByTable.get(selectedTable.id) : null;
  const selectedItems = selectedOrder ? (itemsByOrder.get(selectedOrder.id) ?? []) : [];
  const selectedCust = selectedOrder?.customer_id ? custMap.get(selectedOrder.customer_id) : null;
  const selectedCall = selectedTable ? callsByTable.get(selectedTable.id) : null;
  const selectedTotal = selectedItems.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.price_at_order * i.qty, 0);

  // Refetch helper
  const refetch = useCallback(async () => {
    const supa = supabaseBrowser();
    const [{ data: ords }, { data: cls }] = await Promise.all([
      supa.from('orders').select('*').eq('outlet_id', outlet.id).eq('status', 'open'),
      supa.from('waiter_calls').select('*').eq('outlet_id', outlet.id).eq('status', 'open'),
    ]);
    setOrders(ords ?? []);
    setCalls((cls ?? []) as WaiterCall[]);
    const ids = (ords ?? []).map(o => o.id);
    if (ids.length) {
      const { data: its } = await supa.from('order_items').select('*').in('order_id', ids).order('created_at');
      setItems(its ?? []);
    } else setItems([]);
  }, [outlet.id]);

  // Realtime
  useEffect(() => {
    const supa = supabaseBrowser();
    let cancelled = false;
    let ch: ReturnType<typeof supa.channel> | null = null;
    let connected = false;

    (async () => {
      const { data: { session } } = await supa.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) await supa.realtime.setAuth(session.access_token);

      ch = supa.channel(`waiter-${outlet.id}-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${outlet.id}` }, (p) => {
          const n = p.new as OrderRow, o = p.old as OrderRow;
          if (p.eventType === 'INSERT' && n.status === 'open') setOrders(arr => arr.some(x => x.id === n.id) ? arr : [n, ...arr]);
          else if (p.eventType === 'UPDATE') setOrders(arr => arr.map(x => x.id === n.id ? n : x).filter(x => x.status === 'open'));
          else if (p.eventType === 'DELETE') setOrders(arr => arr.filter(x => x.id !== o.id));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (p) => {
          const n = p.new as OrderItemRow, o = p.old as OrderItemRow;
          if (p.eventType === 'INSERT') setItems(arr => arr.some(i => i.id === n.id) ? arr : [...arr, n]);
          else if (p.eventType === 'UPDATE') setItems(arr => arr.map(i => i.id === n.id ? n : i));
          else if (p.eventType === 'DELETE') setItems(arr => arr.filter(i => i.id !== o.id));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls', filter: `outlet_id=eq.${outlet.id}` }, (p) => {
          const n = p.new as WaiterCall, o = p.old as WaiterCall;
          if (p.eventType === 'INSERT' && n.status === 'open') {
            setCalls(arr => arr.some(c => c.id === n.id) ? arr : [n, ...arr]);
            try { audioRef.current?.play().catch(() => {}); } catch {}
          } else if (p.eventType === 'UPDATE') {
            setCalls(arr => arr.map(c => c.id === n.id ? n : c).filter(c => c.status === 'open'));
          } else if (p.eventType === 'DELETE') {
            setCalls(arr => arr.filter(c => c.id !== o.id));
          }
        })
        .subscribe((s) => { connected = s === 'SUBSCRIBED'; if (s === 'SUBSCRIBED') refetch(); });
    })();

    const onFocus = () => { if (document.visibilityState === 'visible') refetch(); };
    document.addEventListener('visibilitychange', onFocus);
    const poll = setInterval(() => { if (!connected) refetch(); }, 8000);

    return () => { cancelled = true; if (ch) supa.removeChannel(ch); document.removeEventListener('visibilitychange', onFocus); clearInterval(poll); };
  }, [outlet.id, refetch]);

  async function cycleStatus(itemId: string, current: OrderItemRow['status']) {
    const next = STATUS_CYCLE[current];
    setItems(arr => arr.map(i => i.id === itemId ? { ...i, status: next } : i));
    await supabaseBrowser().from('order_items').update({ status: next }).eq('id', itemId);
  }
  async function markAllServed() {
    if (!selectedOrder) return;
    const supa = supabaseBrowser();
    const ids = selectedItems.filter(i => i.status !== 'served' && i.status !== 'cancelled').map(i => i.id);
    if (!ids.length) return;
    setItems(arr => arr.map(i => ids.includes(i.id) ? { ...i, status: 'served' as const } : i));
    await supa.from('order_items').update({ status: 'served' }).in('id', ids);
  }
  async function ackCall() {
    if (!selectedCall) return;
    setCalls(arr => arr.filter(c => c.id !== selectedCall.id));
    await supabaseBrowser().from('waiter_calls').update({ status: 'answered', answered_at: new Date().toISOString() }).eq('id', selectedCall.id);
  }
  async function closeOrder() {
    if (!selectedOrder) return;
    if (!confirm(`Close bill for Table ${selectedTable!.number}? Guests have left.`)) return;
    const supa = supabaseBrowser();
    setOrders(arr => arr.filter(o => o.id !== selectedOrder.id));
    await supa.from('orders').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', selectedOrder.id);
  }
  async function addWaiterItems(picks: { menuItemId: string; qty: number }[]) {
    if (!selectedTable) return;
    const supa = supabaseBrowser();

    // Ensure order exists; create if not
    let order = selectedOrder;
    if (!order) {
      const { data: created, error } = await supa.from('orders').insert({
        outlet_id: outlet.id, table_id: selectedTable.id, customer_id: null,
      }).select('*').single();
      if (error) { alert(error.message); return; }
      order = created as OrderRow;
      setOrders(arr => [order!, ...arr]);
    }

    const byId = new Map(menuItems.map(m => [m.id, m]));
    const rows = picks.map(p => {
      const m = byId.get(p.menuItemId)!;
      return {
        order_id: order!.id, menu_item_id: m.id, name_snapshot: m.name,
        price_at_order: m.price, qty: p.qty, added_by: 'waiter' as const,
      };
    });
    const { data: inserted, error } = await supa.from('order_items').insert(rows).select('*');
    if (error) { alert(error.message); return; }
    setItems(arr => [...arr, ...(inserted ?? []) as OrderItemRow[]]);
    setShowAdd(false);
  }

  // On mobile: hide grid once a table is picked (slide-in detail view)
  const mobileView: 'grid' | 'detail' = isMobile && selectedTableId ? 'detail' : 'grid';

  return (
    <div className="w-shell" data-mobile-view={mobileView}>
      <audio ref={audioRef} preload="auto" src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=" />

      {/* TOP BAR — full on desktop, compact on mobile-grid, hidden on mobile-detail */}
      <header className="w-top">
        <div className="w-brand">
          <div className="w-logo">{outlet.name.charAt(0)}</div>
          <div className="w-brand-text">
            <div className="w-outlet">{outlet.name}</div>
            <div className="w-role">Waiter · {staff.name}</div>
          </div>
        </div>
        <div className="w-top-stats">
          <div className="w-pill">{orders.length} open</div>
          {calls.length > 0 && <div className="w-pill w-pill-call">🔔 {calls.length} calling</div>}
        </div>
        <form action="/auth/signout" method="post"><button className="w-logout" aria-label="Sign out"><span className="w-logout-text">Sign out</span><span className="w-logout-icon">⎋</span></button></form>
      </header>

      <div className="w-body">
        {/* TABLE GRID */}
        <aside className="w-tables">
          <div className="w-filters">
            {(['all', 'occupied', 'called', 'free'] as Filter[]).map(f => (
              <button key={f} className={`w-filter ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="w-tgrid">
            {filteredTables.map(t => {
              const order = orderByTable.get(t.id);
              const its = order ? (itemsByOrder.get(order.id) ?? []) : [];
              const pending = its.filter(i => i.status === 'pending' || i.status === 'preparing').length;
              const total = its.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.price_at_order * i.qty, 0);
              const called = callsByTable.has(t.id);
              const active = selectedTableId === t.id;
              const cls = [
                'w-tbl',
                order ? 'w-tbl-busy' : 'w-tbl-free',
                called ? 'w-tbl-call' : '',
                active ? 'w-tbl-active' : '',
              ].filter(Boolean).join(' ');
              return (
                <button key={t.id} className={cls} onClick={() => setSelectedTableId(t.id)}>
                  <div className="w-tnum">T{t.number}</div>
                  <div className="w-tzone">{t.zone}</div>
                  {order ? (
                    <div className="w-tmeta">
                      <span>{outlet.currency}{total.toFixed(0)}</span>
                      {pending > 0 && <span className="w-tpend">{pending}p</span>}
                    </div>
                  ) : (
                    <div className="w-tmeta w-tfree">free</div>
                  )}
                  {called && <div className="w-tring">🔔</div>}
                </button>
              );
            })}
            {filteredTables.length === 0 && <div style={{ gridColumn: '1/-1', color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 30 }}>No tables in this filter</div>}
          </div>
        </aside>

        {/* DETAIL PANEL */}
        <main className="w-detail">
          {!selectedTable ? (
            <div className="w-empty">Pick a table to start</div>
          ) : (
            <>
              <div className="w-detail-head">
                {isMobile && (
                  <button className="w-back" onClick={() => setSelectedTableId(null)} aria-label="Back to tables">←</button>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="w-detail-title">Table {selectedTable.number} <span className="w-detail-zone">· {selectedTable.zone} · seats {selectedTable.capacity}</span></div>
                  {selectedOrder && <div className="w-detail-sub">{selectedOrder.bill_no} {selectedCust ? `· ${selectedCust.name}` : ''}</div>}
                </div>
                {selectedCall && (
                  <button className="w-ack" onClick={ackCall}>
                    🔔 <span className="w-ack-text">Acknowledge</span>
                  </button>
                )}
              </div>

              {selectedOrder ? (
                <>
                  <div className="w-items">
                    {selectedItems.length === 0 ? (
                      <div className="w-empty-items">No items yet — use "Add items" below</div>
                    ) : selectedItems.map(i => (
                      <div key={i.id} className={`w-item w-item-${i.status}`}>
                        <div className="w-item-main">
                          <div className="w-item-name">{i.name_snapshot} <span className="w-item-qty">× {i.qty}</span></div>
                          <div className="w-item-meta">{outlet.currency}{(i.price_at_order * i.qty).toFixed(0)}{i.added_by === 'waiter' ? ' · waiter add' : ''}</div>
                          {i.remark && <div className="w-item-remark">↳ {i.remark}</div>}
                        </div>
                        <button className={`w-status w-status-${i.status}`} onClick={() => cycleStatus(i.id, i.status)}>
                          {STATUS_LABEL[i.status]}
                        </button>
                      </div>
                    ))}
                  </div>

                  <footer className="w-foot">
                    <div className="w-total">
                      <div className="w-total-l">Subtotal</div>
                      <div className="w-total-v">{outlet.currency}{selectedTotal.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="w-actions">
                      <button className="w-btn w-btn-primary" onClick={() => setShowAdd(true)}>+ Add items</button>
                      <button className="w-btn w-btn-ghost" onClick={markAllServed}>All served</button>
                      <button className="w-btn w-btn-danger" onClick={closeOrder}>Close bill</button>
                    </div>
                  </footer>
                </>
              ) : (
                <div className="w-no-order">
                  <p>This table doesn't have an open bill yet.</p>
                  <button className="w-btn w-btn-primary w-btn-lg" onClick={() => setShowAdd(true)}>+ Start an order</button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {showAdd && selectedTable && (
        <AddItemsModal
          currency={outlet.currency}
          categories={menuCategories}
          items={menuItems}
          onCancel={() => setShowAdd(false)}
          onConfirm={addWaiterItems}
        />
      )}

      <style>{waiterCss}</style>
    </div>
  );
}

const waiterCss = `
.w-shell { height: 100dvh; display: flex; flex-direction: column; background: var(--bg0); overflow: hidden; }

/* TOP BAR */
.w-top { display: flex; align-items: center; gap: 16px; padding: 12px 20px; background: var(--bg1); border-bottom: 1px solid var(--border); flex-shrink: 0; padding-top: max(12px, env(safe-area-inset-top)); }
.w-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.w-logo { width: 40px; height: 40px; border-radius: 10px; background: var(--brand); color: var(--bg1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; font-family: 'Fraunces', serif; flex-shrink: 0; }
.w-brand-text { min-width: 0; }
.w-outlet { font-weight: 600; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-role { font-size: 11px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em; }
.w-top-stats { display: flex; gap: 8px; margin-left: auto; flex-shrink: 0; }
.w-pill { padding: 6px 12px; border-radius: 999px; background: var(--bg3); font-size: 12px; color: var(--text2); font-weight: 500; white-space: nowrap; }
.w-pill-call { background: var(--red); color: white; animation: callPulse 1.5s ease-in-out infinite; }
@keyframes callPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(232,90,90,0.6); } 50% { box-shadow: 0 0 0 8px rgba(232,90,90,0); } }
.w-logout { padding: 9px 16px; border-radius: 9px; background: var(--bg3); color: var(--text2); font-size: 13px; border: 1px solid var(--border); transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
.w-logout:hover { background: var(--red-dim); color: var(--red); border-color: var(--red); }
.w-logout-icon { display: none; font-size: 18px; }

/* BODY SPLIT */
.w-body { display: grid; grid-template-columns: minmax(360px, 420px) 1fr; flex: 1; overflow: hidden; gap: 0; }
.w-back { width: 44px; height: 44px; border-radius: 12px; background: var(--bg3); font-size: 22px; color: var(--text1); display: none; align-items: center; justify-content: center; flex-shrink: 0; }
.w-back:active { background: var(--bg4); transform: scale(0.95); }

/* TABLES PANE */
.w-tables { padding: 16px; background: var(--bg1); border-right: 1px solid var(--border); overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.w-filters { display: flex; gap: 6px; }
.w-filter { flex: 1; padding: 10px 8px; border-radius: 10px; background: var(--bg3); font-size: 12px; font-weight: 500; color: var(--text3); border: 1.5px solid transparent; transition: all 0.15s; }
.w-filter.on { background: var(--brand-dim); color: var(--brand); border-color: var(--brand); }

.w-tgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.w-tbl {
  aspect-ratio: 1.05;
  border-radius: 14px;
  padding: 12px 10px 10px;
  display: flex; flex-direction: column; gap: 4px; align-items: stretch;
  text-align: left; position: relative; transition: all 0.2s ease;
  border: 1.5px solid transparent;
  font-family: inherit;
}
.w-tbl-free { background: var(--bg3); color: var(--text3); }
.w-tbl-busy { background: linear-gradient(135deg, var(--brand-dim), rgba(200,169,110,0.06)); color: var(--brand); border-color: rgba(200,169,110,0.25); }
.w-tbl-call { background: var(--red); color: white !important; border-color: var(--red); animation: callPulse 1.5s ease-in-out infinite; }
.w-tbl-active { box-shadow: 0 0 0 3px var(--brand); transform: scale(1.02); }
.w-tbl:active { transform: scale(0.97); }
.w-tnum { font-size: 26px; font-weight: 700; font-family: 'Fraunces', serif; line-height: 1; }
.w-tzone { font-size: 10px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em; }
.w-tmeta { margin-top: auto; display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 600; }
.w-tfree { opacity: 0.5; font-weight: 400; }
.w-tpend { background: var(--amber); color: var(--bg1); padding: 1px 6px; border-radius: 4px; font-size: 10px; }
.w-tring { position: absolute; top: 6px; right: 6px; font-size: 14px; }

/* DETAIL PANE */
.w-detail { display: flex; flex-direction: column; padding: 20px 24px; overflow: hidden; background: var(--bg0); }
.w-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text3); font-size: 16px; }
.w-detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 16px; flex-shrink: 0; }
.w-detail-title { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 500; }
.w-detail-zone { font-family: 'Inter'; font-weight: 400; color: var(--text3); font-size: 14px; }
.w-detail-sub { font-size: 12px; color: var(--brand); margin-top: 3px; }
.w-ack {
  padding: 12px 20px; border-radius: 12px;
  background: var(--red); color: white; font-size: 14px; font-weight: 600;
  box-shadow: 0 6px 20px rgba(232,90,90,0.4);
  animation: callPulse 1.5s ease-in-out infinite;
}

.w-items { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px; }
.w-item {
  display: grid; grid-template-columns: 1fr auto; gap: 12px;
  padding: 14px 16px; border-radius: 12px;
  background: var(--bg2); border: 1px solid var(--border);
  align-items: center;
}
.w-item-cancelled { opacity: 0.5; text-decoration: line-through; }
.w-item-ready { background: rgba(91,141,239,0.06); border-color: rgba(91,141,239,0.22); }
.w-item-served { background: rgba(76,175,125,0.05); border-color: rgba(76,175,125,0.18); }
.w-item-main { min-width: 0; }
.w-item-name { font-size: 15px; font-weight: 500; }
.w-item-qty { color: var(--text3); font-weight: 400; margin-left: 4px; }
.w-item-meta { font-size: 12px; color: var(--text3); margin-top: 3px; }
.w-item-remark { font-size: 12px; color: var(--amber); font-style: italic; margin-top: 4px; }
.w-status {
  padding: 10px 16px; border-radius: 10px;
  font-size: 12px; font-weight: 600; min-width: 100px;
  transition: all 0.15s; border: 1.5px solid;
}
.w-status:active { transform: scale(0.95); }
.w-status-pending   { background: var(--red-dim);    color: var(--red);    border-color: rgba(232,90,90,0.3); }
.w-status-preparing { background: var(--amber-dim);  color: var(--amber);  border-color: rgba(232,160,48,0.3); }
.w-status-ready     { background: var(--accent-dim); color: var(--accent); border-color: rgba(91,141,239,0.3); }
.w-status-served    { background: var(--green-dim);  color: var(--green);  border-color: rgba(76,175,125,0.3); }
.w-status-cancelled { background: var(--bg3);        color: var(--text4);  border-color: var(--border); }

.w-empty-items { color: var(--text3); padding: 40px; text-align: center; font-size: 14px; }

.w-foot { flex-shrink: 0; padding-top: 16px; margin-top: 14px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 12px; }
.w-total { display: flex; justify-content: space-between; align-items: baseline; padding: 4px 4px; }
.w-total-l { color: var(--text3); font-size: 14px; }
.w-total-v { font-size: 24px; font-weight: 700; color: var(--brand); font-variant-numeric: tabular-nums; }
.w-actions { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; }
.w-btn { padding: 16px; border-radius: 12px; font-size: 14px; font-weight: 600; transition: all 0.15s; }
.w-btn:active { transform: scale(0.97); }
.w-btn-primary { background: var(--brand); color: var(--bg1); box-shadow: 0 4px 16px rgba(200,169,110,0.3); }
.w-btn-ghost { background: var(--bg3); color: var(--text1); border: 1px solid var(--border); }
.w-btn-danger { background: var(--red-dim); color: var(--red); border: 1px solid rgba(232,90,90,0.3); }
.w-btn-lg { padding: 22px 28px; font-size: 16px; }

.w-no-order { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; flex: 1; color: var(--text3); }

/* ─────────────── MOBILE (≤ 768px) ─────────────── */
@media (max-width: 768px) {
  /* Compact top bar — text becomes icon-only */
  .w-top { padding: 10px 14px; padding-top: max(10px, env(safe-area-inset-top)); gap: 10px; }
  .w-brand-text .w-role { display: none; }
  .w-brand-text .w-outlet { font-size: 14px; }
  .w-logo { width: 34px; height: 34px; font-size: 17px; }
  .w-pill { padding: 5px 10px; font-size: 11px; }
  .w-logout-text { display: none; }
  .w-logout-icon { display: block; }
  .w-logout { padding: 0; width: 36px; height: 36px; justify-content: center; }

  /* Stack as two screens */
  .w-body { grid-template-columns: 1fr; position: relative; }
  .w-tables, .w-detail { position: absolute; inset: 0; width: 100%; transition: transform 0.3s cubic-bezier(0.34, 1.06, 0.64, 1); }
  .w-shell[data-mobile-view='grid']   .w-tables { transform: translateX(0); }
  .w-shell[data-mobile-view='grid']   .w-detail { transform: translateX(100%); pointer-events: none; }
  .w-shell[data-mobile-view='detail'] .w-tables { transform: translateX(-100%); pointer-events: none; }
  .w-shell[data-mobile-view='detail'] .w-detail { transform: translateX(0); }

  /* Bigger grid tiles, 2 cols */
  .w-tables { padding: 14px; border-right: none; gap: 14px; }
  .w-tgrid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .w-tbl { aspect-ratio: 1.15; padding: 16px 14px 14px; }
  .w-tnum { font-size: 32px; }
  .w-tzone { font-size: 11px; }
  .w-tmeta { font-size: 14px; }
  .w-filter { padding: 12px 6px; font-size: 13px; }

  /* Detail pane spacing */
  .w-detail { padding: 14px 16px 0; }
  .w-detail-head { gap: 10px; align-items: center; margin-bottom: 14px; }
  .w-back { display: flex; }
  .w-detail-title { font-size: 20px; }
  .w-detail-zone { display: none; }
  .w-detail-sub { font-size: 11px; }

  /* Ack button shrinks to icon + short text */
  .w-ack { padding: 12px 14px; font-size: 13px; }
  .w-ack-text { display: none; }

  /* Larger items list with breathing room */
  .w-items { gap: 10px; padding-right: 2px; padding-bottom: 6px; }
  .w-item { padding: 14px; grid-template-columns: 1fr auto; gap: 10px; }
  .w-item-name { font-size: 15px; }
  .w-status { padding: 12px 14px; font-size: 13px; min-width: 96px; min-height: 48px; }

  /* Sticky footer with safe-area padding */
  .w-foot {
    position: sticky; bottom: 0; left: 0; right: 0;
    background: linear-gradient(180deg, transparent 0%, var(--bg0) 28%);
    padding: 20px 0 max(16px, env(safe-area-inset-bottom));
    margin-top: 10px;
  }
  .w-total { padding: 0 4px 4px; }
  .w-total-v { font-size: 22px; }
  .w-actions { grid-template-columns: 1fr; gap: 8px; }
  .w-btn { padding: 18px; font-size: 15px; min-height: 56px; }
  .w-btn-lg { padding: 22px; font-size: 16px; }
}

/* Very small phones */
@media (max-width: 360px) {
  .w-tgrid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .w-tnum { font-size: 28px; }
}
`;
