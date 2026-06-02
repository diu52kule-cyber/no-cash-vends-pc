'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { PaymentModal, type PaymentMethod, type Payment } from './PaymentModal';

const PM_LABELS: Record<string, string> = { cash: 'Cash 💵', upi: 'UPI 📱', card: 'Card 💳' };
function encodePayments(ps: Payment[]) { return ps.map(p => `${p.method}:${Math.round(p.amount)}`).join(','); }
function parsePayments(s: string | null): Payment[] {
  if (!s) return [];
  return s.split(',').map(seg => {
    const [m, a] = seg.split(':');
    return { method: m as PaymentMethod, amount: a !== undefined ? Number(a) : 0 };
  }).filter(p => p.method);
}
import type { OrderRow, OrderItemRow, Table, Customer } from '@/lib/types';

const STATUS_CYCLE: Record<OrderItemRow['status'], OrderItemRow['status']> = {
  pending: 'preparing', preparing: 'ready', ready: 'served', served: 'pending', cancelled: 'pending',
};
const STATUS_LABEL: Record<OrderItemRow['status'], string> = {
  pending: '● Pending', preparing: '◑ Preparing', ready: '◕ Ready', served: '✓ Served', cancelled: '✗ Cancelled',
};
const STATUS_CLASS: Record<OrderItemRow['status'], string> = {
  pending: 's-pending', preparing: 's-preparing', ready: 's-ready', served: 's-served', cancelled: 's-cancelled',
};

type Props = {
  outletId: string;
  outletName: string;
  outletTagline: string;
  gstin: string;
  currency: string;
  cgst: number;
  sgst: number;
  serviceCharge: number;
  initialOrders: OrderRow[];
  initialItems: OrderItemRow[];
  tables: Table[];
  customers: Customer[];
};

export function OrdersClient({
  outletId, outletName, outletTagline, gstin, currency, cgst, sgst, serviceCharge,
  initialOrders, initialItems, tables, customers,
}: Props) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [items, setItems] = useState<OrderItemRow[]>(initialItems);
  const [freshOrderIds, setFreshOrderIds] = useState<Set<string>>(new Set());
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const tableMap = useMemo(() => new Map(tables.map(t => [t.id, t])), [tables]);
  const custMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItemRow[]>();
    items.forEach(i => { const arr = m.get(i.order_id) ?? []; arr.push(i); m.set(i.order_id, arr); });
    return m;
  }, [items]);

  // Bill maths — GST/service computed at the end (not baked into item prices).
  function billTotals(orderId: string) {
    const its = (itemsByOrder.get(orderId) ?? []).filter(i => i.status !== 'cancelled');
    const subtotal = its.reduce((s, i) => s + i.price_at_order * i.qty, 0);
    const service = serviceCharge > 0 ? subtotal * serviceCharge / 100 : 0;
    const taxable = subtotal + service;
    const cgstAmt = taxable * cgst / 100;
    const sgstAmt = taxable * sgst / 100;
    const grand = Math.round(taxable + cgstAmt + sgstAmt);
    return { subtotal, service, cgstAmt, sgstAmt, grand };
  }

  // Hard refetch — used by polling fallback + focus + when subscribe drops
  const refetch = useCallback(async () => {
    const supa = supabaseBrowser();
    const { data: ords } = await supa.from('orders').select('*').eq('outlet_id', outletId).eq('status', 'open').order('opened_at', { ascending: false });
    setOrders(ords ?? []);
    const ids = (ords ?? []).map(o => o.id);
    if (ids.length) {
      const { data: its } = await supa.from('order_items').select('*').in('order_id', ids).order('created_at');
      setItems(its ?? []);
    } else {
      setItems([]);
    }
  }, [outletId]);

  // Realtime: subscribe to orders + order_items for this outlet.
  // Must await session JWT first or Supabase treats the socket as anon → RLS denies everything.
  useEffect(() => {
    const supa = supabaseBrowser();
    let connected = false;
    let cancelled = false;
    let ch: ReturnType<typeof supa.channel> | null = null;

    (async () => {
      const { data: { session } } = await supa.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supa.realtime.setAuth(session.access_token);
        console.log('[rt:orders] auth set');
      } else {
        console.warn('[rt:orders] NO SESSION — realtime will be RLS-blocked');
      }

      ch = supa.channel(`orders-${outletId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${outletId}` },
        (payload) => {
          const newRow = payload.new as OrderRow;
          const oldRow = payload.old as OrderRow;
          if (payload.eventType === 'INSERT') {
            if (newRow.status === 'open') {
              setOrders(o => o.some(r => r.id === newRow.id) ? o : [newRow, ...o]);
              setFreshOrderIds(s => new Set(s).add(newRow.id));
              setTimeout(() => setFreshOrderIds(s => { const n = new Set(s); n.delete(newRow.id); return n; }), 4000);
              playDing();
            }
          } else if (payload.eventType === 'UPDATE') {
            setOrders(o => o.map(r => r.id === newRow.id ? newRow : r).filter(r => r.status === 'open'));
          } else if (payload.eventType === 'DELETE') {
            setOrders(o => o.filter(r => r.id !== oldRow.id));
          }
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        (payload) => {
          const n = payload.new as OrderItemRow;
          const o = payload.old as OrderItemRow;
          if (payload.eventType === 'INSERT') {
            setItems(arr => arr.some(i => i.id === n.id) ? arr : [...arr, n]);
            setFreshOrderIds(s => new Set(s).add(n.order_id));
            setTimeout(() => setFreshOrderIds(s => { const next = new Set(s); next.delete(n.order_id); return next; }), 4000);
            playDing();
          } else if (payload.eventType === 'UPDATE') {
            setItems(arr => arr.map(i => i.id === n.id ? n : i));
          } else if (payload.eventType === 'DELETE') {
            setItems(arr => arr.filter(i => i.id !== o.id));
          }
        })
      .subscribe((status, err) => {
        console.log('[rt:orders] status', status, err ?? '');
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

  function playDing() { try { audioRef.current?.play().catch(() => {}); } catch {/* */} }

  async function cycleStatus(itemId: string, current: OrderItemRow['status']) {
    const next = STATUS_CYCLE[current];
    const supa = supabaseBrowser();
    setItems(arr => arr.map(i => i.id === itemId ? { ...i, status: next } : i)); // optimistic
    await supa.from('order_items').update({ status: next }).eq('id', itemId);
  }

  async function cancelItem(itemId: string) {
    if (!confirm('Mark this item as cancelled? It stays on the bill but won’t be charged.')) return;
    const supa = supabaseBrowser();
    setItems(arr => arr.map(i => i.id === itemId ? { ...i, status: 'cancelled' } : i));
    await supa.from('order_items').update({ status: 'cancelled' }).eq('id', itemId);
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Delete this item permanently from the bill? This cannot be undone.')) return;
    const supa = supabaseBrowser();
    setItems(arr => arr.filter(i => i.id !== itemId));
    const { error } = await supa.from('order_items').delete().eq('id', itemId);
    if (error) { alert(error.message); refetch(); }
  }

  // Only allowed when there's nothing to pay (empty/voided bill).
  async function closeEmpty(orderId: string) {
    if (!confirm('Close this bill? It has no payable items.')) return;
    const supa = supabaseBrowser();
    setOrders(o => o.filter(r => r.id !== orderId));
    await supa.from('orders').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', orderId);
  }

  // Record payment → print → close. Payment is required to close a bill with a balance.
  async function settleAndClose(orderId: string, payments: Payment[]) {
    const supa = supabaseBrowser();
    const csv = encodePayments(payments);
    setPayingOrderId(null);
    setTimeout(() => printBill(orderId, payments), 100);
    setOrders(o => o.filter(r => r.id !== orderId)); // optimistic remove
    await supa.from('orders').update({
      payment_methods: csv, status: 'closed', closed_at: new Date().toISOString(),
    }).eq('id', orderId);
  }

  function printBill(orderId: string, payments?: Payment[]) {
    const o = orders.find(x => x.id === orderId)!;
    const its = (itemsByOrder.get(orderId) ?? []).filter(i => i.status !== 'cancelled');
    const cancelledItems = (itemsByOrder.get(orderId) ?? []).filter(i => i.status === 'cancelled');
    const table = tableMap.get(o.table_id);
    const cust = o.customer_id ? custMap.get(o.customer_id) : null;
    const t = billTotals(orderId);
    const fmt = (n: number) => `${currency}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    const esc = (s: string) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    const pays = payments ?? parsePayments(o.payment_methods);
    const w = window.open('', '_blank', 'width=420,height=720');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Bill ${o.bill_no}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;padding:20px;font-size:13px}
      h2{text-align:center;font-family:Georgia,serif;margin-bottom:4px}
      .c{text-align:center}.m{color:#666}.row{display:flex;justify-content:space-between;margin:3px 0}
      .row.strike{text-decoration:line-through;color:#aaa}
      hr{border:none;border-top:1px dashed #ccc;margin:8px 0}
      .grand{font-size:15px;font-weight:bold;border-top:2px solid #000;padding-top:6px;margin-top:6px}
      .pay{margin-top:10px;padding:8px 0;border-top:1px dashed #ccc;border-bottom:1px dashed #ccc;font-weight:bold;text-align:center;font-size:13px}
    </style></head><body>
      <h2>${esc(outletName)}</h2>${outletTagline ? `<p class="c m" style="font-size:11px">${esc(outletTagline)}</p>` : ''}${gstin ? `<p class="c m" style="font-size:10px">GSTIN: ${esc(gstin)}</p>` : ''}<hr>
      <div class="row"><span>Bill:</span><b>${o.bill_no ?? ''}</b></div>
      <div class="row"><span>Table:</span><span>${table?.number ?? ''}</span></div>
      ${cust ? `<div class="row"><span>Guest:</span><span>${cust.name}</span></div>` : ''}
      <div class="row"><span>Date:</span><span>${new Date().toLocaleString('en-IN')}</span></div><hr>
      ${its.map(i => `<div class="row"><span>${i.name_snapshot} ×${i.qty}</span><span>${currency}${(i.price_at_order * i.qty).toFixed(0)}</span></div>${i.remark ? `<div class="m" style="font-size:11px;padding-left:6px">↳ ${i.remark}</div>` : ''}`).join('')}
      ${cancelledItems.length ? `<div class="m" style="font-size:10px;padding-top:4px">Cancelled:</div>${cancelledItems.map(i => `<div class="row strike"><span>${i.name_snapshot} ×${i.qty}</span><span>${currency}${(i.price_at_order * i.qty).toFixed(0)}</span></div>`).join('')}` : ''}
      <hr><div class="row"><span>Subtotal</span><span>${fmt(t.subtotal)}</span></div>
      ${t.service ? `<div class="row"><span>Service charge</span><span>${fmt(t.service)}</span></div>` : ''}
      ${cgst ? `<div class="row"><span>CGST ${cgst}%</span><span>${fmt(t.cgstAmt)}</span></div>` : ''}
      ${sgst ? `<div class="row"><span>SGST ${sgst}%</span><span>${fmt(t.sgstAmt)}</span></div>` : ''}
      <div class="row grand"><span>TOTAL</span><span>${fmt(t.grand)}</span></div>
      ${pays.length ? `<div class="pay">Paid via: ${pays.map(p => `${PM_LABELS[p.method] ?? p.method}${p.amount ? ` ${fmt(p.amount)}` : ''}`).join(' + ')}</div>` : ''}
      <p class="c" style="margin-top:14px">Thank you 🙏</p>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  const totRev = orders.reduce((s, o) => s + (itemsByOrder.get(o.id) ?? []).reduce((a, i) => a + i.price_at_order * i.qty, 0), 0);
  const totPend = orders.reduce((s, o) => s + (itemsByOrder.get(o.id) ?? []).filter(i => i.status === 'pending' || i.status === 'preparing').length, 0);
  const avg = orders.length ? Math.round(totRev / orders.length) : 0;

  return (
    <>
      <audio ref={audioRef} preload="auto" src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=" />
      <div className="page-h">
        <div>
          <h1>Live Orders</h1>
          <p>{orders.length} active tables · {totPend} items pending</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="lbl">Active tables</div><div className="val gold">{orders.length}</div></div>
        <div className="stat"><div className="lbl">Revenue (open)</div><div className="val gold">{currency}{totRev.toLocaleString('en-IN')}</div></div>
        <div className="stat"><div className="lbl">Items pending</div><div className="val">{totPend}</div></div>
        <div className="stat"><div className="lbl">Avg bill</div><div className="val">{currency}{avg.toLocaleString('en-IN')}</div></div>
      </div>

      {orders.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          No open orders. New orders will appear here live as customers place them.
        </div>
      )}

      <div className="bills">
        {orders.map(o => {
          const its = itemsByOrder.get(o.id) ?? [];
          const t = billTotals(o.id);
          const pendingN = its.filter(i => i.status !== 'served' && i.status !== 'cancelled').length;
          const fresh = freshOrderIds.has(o.id);
          const cust = o.customer_id ? custMap.get(o.customer_id) : null;
          const table = tableMap.get(o.table_id);
          return (
            <div key={o.id} className={`bill ${fresh ? 'fresh' : ''}`}>
              <div className="h">
                <div>
                  <div className="id">{o.bill_no ?? '—'}</div>
                  <div className="tag">Table {table?.number ?? '?'}{cust ? ` · ${cust.name}` : ''}</div>
                </div>
                <div className="total" title="incl. taxes">{currency}{t.grand.toLocaleString('en-IN')}</div>
              </div>
              <div className="items">
                {its.map(i => (
                  <div key={i.id} className="row" style={i.status === 'cancelled' ? { opacity: 0.6 } : undefined}>
                    <div className="nm">
                      <div style={i.status === 'cancelled' ? { textDecoration: 'line-through' } : undefined}>{i.name_snapshot}</div>
                      <div className="qty">×{i.qty} · {currency}{i.price_at_order} · {currency}{i.price_at_order * i.qty}{i.added_by === 'waiter' ? ' · waiter add' : ''}</div>
                      {i.remark && <div className="remark">↳ {i.remark}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                      <button className={`status-btn ${STATUS_CLASS[i.status]}`} onClick={() => cycleStatus(i.id, i.status)} title="Cycle status">
                        {STATUS_LABEL[i.status]}
                      </button>
                      {i.status !== 'cancelled' && (
                        <button onClick={() => cancelItem(i.id)} title="Cancel item (keep on bill)"
                                style={{ color: 'var(--amber)', padding: '4px 6px', fontSize: 13, opacity: 0.6 }}>⊘</button>
                      )}
                      <button onClick={() => deleteItem(i.id)} title="Delete item from bill"
                              style={{ color: 'var(--red)', padding: '4px 6px', fontSize: 14, opacity: 0.6 }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="f">
                <div className="meta">{its.filter(i => i.status !== 'cancelled').length} items · {pendingN} pending</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => printBill(o.id)}>Print</button>
                  {t.grand > 0
                    ? <button className="btn btn-primary btn-sm" onClick={() => setPayingOrderId(o.id)}>Settle &amp; close</button>
                    : <button className="btn btn-danger btn-sm" onClick={() => closeEmpty(o.id)}>Close</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {payingOrderId && (() => {
        const o = orders.find(x => x.id === payingOrderId);
        if (!o) return null;
        return (
          <PaymentModal
            total={billTotals(o.id).grand} currency={currency}
            onCancel={() => setPayingOrderId(null)}
            onConfirm={(payments) => settleAndClose(o.id, payments)}
          />
        );
      })()}
    </>
  );
}
