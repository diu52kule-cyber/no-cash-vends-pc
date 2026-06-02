'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { Outlet, Table, OrderRow, OrderItemRow, Customer } from '@/lib/types';

type View = 'order' | 'table';
type Col = 'pending' | 'preparing' | 'delivered';

const COLS: { key: Col; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'delivered', label: 'Delivered' },
];
const NEXT: Record<Col, Col> = { pending: 'preparing', preparing: 'delivered', delivered: 'delivered' };
const PREV: Record<Col, Col> = { pending: 'pending', preparing: 'pending', delivered: 'preparing' };

export function KdsClient({
  outlet, initialOrders, initialItems, tables, customers,
}: {
  outlet: Outlet;
  initialOrders: OrderRow[];
  initialItems: OrderItemRow[];
  tables: Table[];
  customers: Customer[];
}) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [items, setItems] = useState<OrderItemRow[]>(initialItems);
  const [view, setView] = useState<View>('order');
  const [now, setNow] = useState(() => Date.now());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try { setView((localStorage.getItem('kds:view') as View) || 'order'); } catch {}
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);

  const orderMap = useMemo(() => new Map(orders.map(o => [o.id, o])), [orders]);
  const tableMap = useMemo(() => new Map(tables.map(t => [t.id, t])), [tables]);
  const custMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

  const liveItems = useMemo(() => {
    const open = new Set(orders.filter(o => o.status === 'open').map(o => o.id));
    return items.filter(i => open.has(i.order_id) && i.status !== 'cancelled');
  }, [items, orders]);

  const tickets = useMemo(() => {
    const build = (status: Col) => {
      const its = liveItems.filter(i => i.status === status);
      const groups = new Map<string, OrderItemRow[]>();
      its.forEach(i => {
        const order = orderMap.get(i.order_id);
        const key = view === 'order' ? i.order_id : (order?.table_id ?? i.order_id);
        const a = groups.get(key) ?? []; a.push(i); groups.set(key, a);
      });
      const list = [...groups.entries()].map(([key, gitems]) => {
        const sorted = [...gitems].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        const order = orderMap.get(sorted[0].order_id);
        const table = order ? tableMap.get(order.table_id) : null;
        const cust = order?.customer_id ? custMap.get(order.customer_id) : null;
        const oldest = Math.min(...sorted.map(i => +new Date(i.created_at)));
        const title = view === 'order' ? (order?.bill_no ?? 'Order') : `Table ${table?.number ?? '?'}`;
        const subtitle = view === 'order'
          ? `Table ${table?.number ?? '?'}${cust ? ` · ${cust.name}` : ''}`
          : `${order?.bill_no ?? ''}${cust ? ` · ${cust.name}` : ''}`;
        return { key, title, subtitle, items: sorted, oldest };
      });
      list.sort((a, b) => a.oldest - b.oldest);
      return list;
    };
    return { pending: build('pending'), preparing: build('preparing'), delivered: build('delivered') };
  }, [liveItems, view, orderMap, tableMap, custMap]);

  const counts = {
    pending: liveItems.filter(i => i.status === 'pending').length,
    preparing: liveItems.filter(i => i.status === 'preparing').length,
    delivered: liveItems.filter(i => i.status === 'delivered').length,
  };

  // ── data refresh + realtime ──────────────────────────────────────
  const refetch = useCallback(async () => {
    const supa = supabaseBrowser();
    const { data: ords } = await supa.from('orders').select('*').eq('outlet_id', outlet.id).eq('status', 'open');
    setOrders(ords ?? []);
    const ids = (ords ?? []).map(o => o.id);
    if (ids.length) {
      const { data: its } = await supa.from('order_items').select('*').in('order_id', ids).order('created_at');
      setItems(its ?? []);
    } else setItems([]);
  }, [outlet.id]);

  useEffect(() => {
    const supa = supabaseBrowser();
    let cancelled = false, connected = false;
    let ch: ReturnType<typeof supa.channel> | null = null;

    (async () => {
      const { data: { session } } = await supa.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) await supa.realtime.setAuth(session.access_token);

      ch = supa.channel(`kds-${outlet.id}-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${outlet.id}` }, (p) => {
          const n = p.new as OrderRow, o = p.old as OrderRow;
          if (p.eventType === 'INSERT' && n.status === 'open') setOrders(a => a.some(x => x.id === n.id) ? a : [n, ...a]);
          else if (p.eventType === 'UPDATE') setOrders(a => a.map(x => x.id === n.id ? n : x).filter(x => x.status === 'open'));
          else if (p.eventType === 'DELETE') setOrders(a => a.filter(x => x.id !== o.id));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (p) => {
          const n = p.new as OrderItemRow, o = p.old as OrderItemRow;
          if (p.eventType === 'INSERT') {
            setItems(a => a.some(i => i.id === n.id) ? a : [...a, n]);
            try { audioRef.current?.play().catch(() => {}); } catch {}
          } else if (p.eventType === 'UPDATE') setItems(a => a.map(i => i.id === n.id ? n : i));
          else if (p.eventType === 'DELETE') setItems(a => a.filter(i => i.id !== o.id));
        })
        .subscribe((s) => { connected = s === 'SUBSCRIBED'; if (s === 'SUBSCRIBED') refetch(); });
    })();

    const onFocus = () => { if (document.visibilityState === 'visible') refetch(); };
    document.addEventListener('visibilitychange', onFocus);
    const poll = setInterval(() => { if (!connected) refetch(); }, 8000);
    return () => { cancelled = true; if (ch) supa.removeChannel(ch); document.removeEventListener('visibilitychange', onFocus); clearInterval(poll); };
  }, [outlet.id, refetch]);

  // ── status actions ───────────────────────────────────────────────
  async function setStatus(ids: string[], status: Col) {
    if (!ids.length) return;
    setItems(a => a.map(i => ids.includes(i.id) ? { ...i, status } : i)); // optimistic
    await supabaseBrowser().from('order_items').update({ status }).in('id', ids);
  }
  const advance = (i: OrderItemRow) => setStatus([i.id], NEXT[i.status as Col]);
  const back = (i: OrderItemRow) => setStatus([i.id], PREV[i.status as Col]);
  const bump = (its: OrderItemRow[], col: Col) => setStatus(its.map(i => i.id), NEXT[col]);

  function changeView(v: View) { setView(v); try { localStorage.setItem('kds:view', v); } catch {} }

  return (
    <div className="kx-shell">
      <audio ref={audioRef} preload="auto" src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=" />

      <header className="kx-top">
        <div className="kx-brand">
          <div className="kx-logo">{outlet.name.charAt(0)}</div>
          <div>
            <div className="kx-outlet">{outlet.name}</div>
            <div className="kx-role">Kitchen Display</div>
          </div>
        </div>

        <div className="kx-toggle" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === 'order'} data-on={view === 'order'} onClick={() => changeView('order')}>Order-wise</button>
          <button role="tab" aria-selected={view === 'table'} data-on={view === 'table'} onClick={() => changeView('table')}>Table-wise</button>
        </div>

        <div className="kx-stats">
          <div className="kx-pill kx-pill-pending">{counts.pending} pending</div>
          <div className="kx-pill kx-pill-prep">{counts.preparing} preparing</div>
        </div>

        <form action="/auth/signout" method="post"><button className="kx-out" aria-label="Sign out">⎋</button></form>
      </header>

      <div className="kx-cols">
        {COLS.map(({ key, label }) => (
          <section key={key} className={`kx-col kx-col-${key}`}>
            <header className="kx-colhead">
              <span>{label}</span>
              <span className="kx-count">{counts[key]}</span>
            </header>
            <div className="kx-tickets">
              {tickets[key].length === 0 && <div className="kx-empty">Nothing here</div>}
              {tickets[key].map(t => {
                const age = Math.max(0, Math.round((now - t.oldest) / 60000));
                return (
                  <div key={t.key} className="kx-ticket">
                    <div className="kx-thead">
                      <div className="kx-tinfo">
                        <div className="kx-ttitle">{t.title}</div>
                        <div className="kx-tsub">{t.subtitle}</div>
                      </div>
                      <div className="kx-tage" data-old={age >= 12}>{age}m</div>
                    </div>

                    <div className="kx-items">
                      {t.items.map(i => (
                        <div key={i.id} className="kx-item">
                          <div className="kx-itop">
                            <span className="kx-qty">{i.qty}×</span>
                            <span className="kx-name">{i.name_snapshot}</span>
                          </div>
                          {i.remark && <div className="kx-note">🗒 {i.remark}</div>}
                          <div className="kx-acts">
                            {key !== 'pending' && (
                              <button className="kx-back" onClick={() => back(i)}>‹ {key === 'delivered' ? 'Recall' : 'Back'}</button>
                            )}
                            {key !== 'delivered' && (
                              <button className="kx-adv" onClick={() => advance(i)}>
                                {key === 'pending' ? 'Start' : 'Ready'} ›
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {key !== 'delivered' && t.items.length > 1 && (
                      <button className="kx-bump" onClick={() => bump(t.items, key)}>
                        {key === 'pending' ? 'Start all' : 'All ready'} ⤼
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <style>{kdsCss}</style>
    </div>
  );
}

const kdsCss = `
.kx-shell { height: 100dvh; display: flex; flex-direction: column; background: var(--bg0); overflow: hidden; -webkit-tap-highlight-color: transparent; }

/* top bar */
.kx-top { display: flex; align-items: center; gap: 16px; padding: 12px 18px; background: var(--bg1); border-bottom: 1px solid var(--border); flex-shrink: 0; padding-top: max(12px, env(safe-area-inset-top)); }
.kx-brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
.kx-logo { width: 38px; height: 38px; border-radius: 10px; background: var(--brand); color: var(--bg1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 19px; font-family: 'Fraunces', serif; flex-shrink: 0; }
.kx-outlet { font-weight: 600; font-size: 15px; white-space: nowrap; }
.kx-role { font-size: 10px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; }

.kx-toggle { display: flex; gap: 4px; padding: 4px; background: var(--bg3); border-radius: 12px; }
.kx-toggle button { padding: 9px 18px; border-radius: 9px; font-size: 13px; font-weight: 600; color: var(--text3); transition: all 0.15s; white-space: nowrap; }
.kx-toggle button[data-on='true'] { background: var(--brand); color: var(--bg1); }

.kx-stats { display: flex; gap: 8px; margin-left: auto; }
.kx-pill { padding: 7px 13px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.kx-pill-pending { background: var(--red-dim); color: var(--red); }
.kx-pill-prep { background: var(--amber-dim); color: var(--amber); }
.kx-out { width: 40px; height: 40px; border-radius: 10px; background: var(--bg3); color: var(--text2); font-size: 18px; border: 1px solid var(--border); transition: all 0.15s; }
.kx-out:hover { background: var(--red-dim); color: var(--red); border-color: var(--red); }

/* columns */
.kx-cols { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 12px; overflow: hidden; min-height: 0; }
.kx-col { display: flex; flex-direction: column; background: var(--bg1); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; min-height: 0; }
.kx-colhead { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; font-size: 14px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; border-bottom: 2px solid var(--border); flex-shrink: 0; }
.kx-count { font-size: 13px; padding: 2px 10px; border-radius: 999px; background: var(--bg3); color: var(--text2); }
.kx-col-pending .kx-colhead { color: var(--red); border-bottom-color: rgba(232,90,90,0.35); }
.kx-col-preparing .kx-colhead { color: var(--amber); border-bottom-color: rgba(232,160,48,0.35); }
.kx-col-delivered .kx-colhead { color: var(--green); border-bottom-color: rgba(76,175,125,0.35); }

.kx-tickets { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px; }
.kx-empty { color: var(--text4); font-size: 13px; text-align: center; padding: 26px 10px; }

/* ticket */
.kx-ticket { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.kx-thead { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 11px 13px; background: var(--bg3); border-bottom: 1px solid var(--border); }
.kx-ttitle { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 600; line-height: 1.1; }
.kx-tsub { font-size: 11.5px; color: var(--text3); margin-top: 3px; }
.kx-tage { font-size: 12px; font-weight: 700; color: var(--text3); font-variant-numeric: tabular-nums; flex-shrink: 0; padding: 2px 8px; border-radius: 999px; background: var(--bg1); }
.kx-tage[data-old='true'] { color: white; background: var(--red); animation: kxpulse 1.6s ease-in-out infinite; }
@keyframes kxpulse { 0%,100% { box-shadow: 0 0 0 0 rgba(232,90,90,0.5);} 50% { box-shadow: 0 0 0 6px rgba(232,90,90,0);} }

.kx-items { display: flex; flex-direction: column; }
.kx-item { padding: 11px 13px; border-bottom: 1px solid var(--border); }
.kx-item:last-child { border-bottom: none; }
.kx-itop { display: flex; gap: 8px; align-items: baseline; }
.kx-qty { font-weight: 800; color: var(--brand); font-size: 16px; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.kx-name { font-size: 15.5px; font-weight: 500; line-height: 1.25; }

/* customer note — catchy */
.kx-note {
  margin-top: 7px; padding: 6px 10px; border-radius: 8px;
  background: linear-gradient(135deg, #ffd23f, #ff8a3d); color: #2a1700;
  font-size: 13px; font-weight: 700; line-height: 1.35;
  box-shadow: 0 2px 10px rgba(255,138,61,0.35);
}

.kx-acts { display: flex; gap: 8px; margin-top: 10px; }
.kx-adv, .kx-back { flex: 1; padding: 13px 10px; border-radius: 10px; font-size: 14px; font-weight: 700; transition: transform 0.1s, filter 0.15s; min-height: 46px; }
.kx-adv:active, .kx-back:active { transform: scale(0.96); }
.kx-adv { background: var(--brand); color: var(--bg1); }
.kx-adv:hover { filter: brightness(1.08); }
.kx-back { flex: 0 0 auto; min-width: 84px; background: var(--bg4); color: var(--text2); }
.kx-back:hover { color: var(--text1); }

.kx-bump { width: 100%; padding: 12px; font-size: 13px; font-weight: 700; color: var(--text2); background: var(--bg3); border-top: 1px solid var(--border); transition: all 0.15s; }
.kx-bump:hover { background: var(--bg4); color: var(--text1); }
.kx-bump:active { transform: scale(0.99); }

/* tablet / phone — columns scroll horizontally so each stays usable */
@media (max-width: 820px) {
  .kx-cols { grid-template-columns: repeat(3, minmax(260px, 1fr)); overflow-x: auto; }
  .kx-toggle button { padding: 9px 14px; }
  .kx-stats { display: none; }
}
@media (max-width: 520px) {
  .kx-top { flex-wrap: wrap; gap: 10px; }
  .kx-toggle { order: 3; width: 100%; }
  .kx-toggle button { flex: 1; }
  .kx-cols { grid-template-columns: repeat(3, 86vw); }
}
`;
