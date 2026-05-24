import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from './api';
import type { ActiveOrder, CartLine, MenuCategory, MenuItem, Outlet, Table } from './types';
import { RaastaLogo } from './outlets/raasta/Logo';
import { Landing } from './components/Landing';
import { NameForm } from './components/NameForm';
import { MenuView } from './components/MenuView';
import { CartSheet } from './components/Cart';
import { WaiterCallBtn } from './components/WaiterCall';

const LOGOS: Record<string, (p: { size?: number }) => JSX.Element> = {
  raasta: RaastaLogo,
};

type Phase = 'loading' | 'landing' | 'name' | 'menu' | 'error';

const CUSTOMER_KEY = (slug: string, tableId: string) => `ncv:cust:${slug}:${tableId}`;

export default function App() {
  const { outletSlug = 'raasta', qrUid = 'tbl-001' } = useParams();
  const [phase, setPhase] = useState<Phase>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [menu, setMenu] = useState<{ categories: MenuCategory[]; items: MenuItem[] } | null>(null);
  const [customer, setCustomer] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [active, setActive] = useState<ActiveOrder>(null);
  const [toast, setToast] = useState<string>('');

  // ── load outlet + table + menu, apply theme ──
  useEffect(() => {
    (async () => {
      try {
        const [o, t, m] = await Promise.all([
          api.outlet(outletSlug),
          api.table(outletSlug, qrUid),
          api.menu(outletSlug),
        ]);
        setOutlet(o); setTable(t); setMenu(m);
        applyTheme(o.theme);
        // restore customer if previously entered for this table
        const stored = localStorage.getItem(CUSTOMER_KEY(outletSlug, t.id));
        if (stored) {
          setCustomer(JSON.parse(stored));
          await refreshActive(t.id);
          setPhase('menu');
        } else {
          setPhase('landing');
        }
      } catch (e: any) {
        setErrMsg(e.message ?? 'Failed to load');
        setPhase('error');
      }
    })();
  }, [outletSlug, qrUid]);

  // poll active order every 12s while menu is open
  useEffect(() => {
    if (phase !== 'menu' || !table) return;
    const i = setInterval(() => refreshActive(table.id), 12000);
    return () => clearInterval(i);
  }, [phase, table?.id]);

  async function refreshActive(tableId: string) {
    try { setActive(await api.activeOrder(tableId)); } catch {/* ignore */}
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  }

  function addToCart(item: MenuItem) {
    setCart(c => {
      const idx = c.findIndex(l => l.item.id === item.id && !l.remark);
      if (idx >= 0) { const nc = [...c]; nc[idx] = { ...nc[idx], qty: nc[idx].qty + 1 }; return nc; }
      return [...c, { item, qty: 1, remark: '' }];
    });
  }
  function changeQty(itemId: string, delta: number) {
    setCart(c => c.flatMap(l => {
      if (l.item.id !== itemId) return [l];
      const q = l.qty + delta;
      return q <= 0 ? [] : [{ ...l, qty: q }];
    }));
  }
  function setRemark(itemId: string, remark: string) {
    setCart(c => c.map(l => l.item.id === itemId ? { ...l, remark } : l));
  }
  function clearLine(itemId: string) {
    setCart(c => c.filter(l => l.item.id !== itemId));
  }

  async function onNameSubmit(name: string, phone: string) {
    if (!outlet || !table) return;
    const cust = await api.upsertCustomer(outlet.slug, name, phone);
    setCustomer(cust);
    localStorage.setItem(CUSTOMER_KEY(outlet.slug, table.id), JSON.stringify(cust));
    await refreshActive(table.id);
    setPhase('menu');
  }

  async function submitOrder() {
    if (!outlet || !table || cart.length === 0) return;
    try {
      const res = await api.submitOrder({
        outletSlug: outlet.slug, tableId: table.id,
        customerId: customer?.id ?? null,
        items: cart.map(l => ({ menuItemId: l.item.id, qty: l.qty, remark: l.remark || undefined })),
      });
      setCart([]); setCartOpen(false);
      await refreshActive(table.id);
      flash(res.billNo ? `Order placed · ${res.billNo}` : 'Order placed');
    } catch (e: any) {
      flash(e.message || 'Could not place order');
    }
  }

  async function callWaiter() {
    if (!outlet || !table) return;
    try {
      const r = await api.callWaiter(outlet.slug, table.id);
      flash(r.deduped ? 'Waiter already called' : 'Waiter is on the way');
    } catch { flash('Could not call waiter'); }
  }

  const cartTotal = useMemo(() => cart.reduce((s, l) => s + l.item.price * l.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);
  const Logo = (outlet && LOGOS[outlet.theme.logo_key]) || RaastaLogo;

  // ── render ──
  if (phase === 'loading') return <div className="loading">Loading…</div>;
  if (phase === 'error') return (
    <div className="error-screen">
      <h2>Hmm.</h2>
      <p>{errMsg}</p>
      <p style={{ marginTop: 14, fontSize: 12 }}>Scan the QR on your table again, or ask staff.</p>
    </div>
  );

  return (
    <div className="app">
      {phase === 'landing' && outlet && table && (
        <Landing
          Logo={Logo}
          outletName={outlet.name}
          tagline={outlet.tagline ?? ''}
          tableNumber={table.number}
          onBegin={() => setPhase('name')}
        />
      )}

      {phase === 'name' && (
        <NameForm onSubmit={onNameSubmit} onClose={() => setPhase('landing')} />
      )}

      {phase === 'menu' && outlet && table && menu && (
        <>
          <div className="top">
            <Logo size={36} />
            <div>
              <div className="name">{outlet.name}</div>
              <div className="meta">Table {table.number} · {table.zone}{customer ? ` · ${customer.name}` : ''}</div>
            </div>
            {outlet.features.waiter_call && (
              <div className="right"><WaiterCallBtn onClick={callWaiter} /></div>
            )}
          </div>

          {active && active.items.length > 0 && (
            <div className="active-order">
              <div className="h">
                <span>Your Bill</span>
                <span className="bill">{active.bill_no ?? ''}</span>
              </div>
              {active.items.map(i => (
                <div className="ao-item" key={i.id}>
                  <div className="nm">
                    <strong>{i.name_snapshot}</strong> × {i.qty}
                    <span className={`st st-${i.status}`}>{i.status}</span>
                  </div>
                  <div>{outlet.currency}{(i.price_at_order * i.qty).toFixed(0)}</div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 13 }}>
                <span>Subtotal so far</span>
                <strong style={{ color: 'var(--secondary)' }}>
                  {outlet.currency}{active.items.reduce((s, i) => s + i.price_at_order * i.qty, 0).toFixed(0)}
                </strong>
              </div>
            </div>
          )}

          <MenuView
            menu={menu}
            currency={outlet.currency}
            cart={cart}
            onAdd={addToCart}
            onInc={(id) => changeQty(id, +1)}
            onDec={(id) => changeQty(id, -1)}
          />

          {cart.length > 0 && (
            <button className="cart-bar" onClick={() => setCartOpen(true)}>
              <div>
                <div className="count">{cartCount} item{cartCount !== 1 ? 's' : ''} in cart</div>
                <div className="sub">Tap to review &amp; order</div>
              </div>
              <div className="total">{outlet.currency}{cartTotal.toFixed(0)}</div>
              <div className="open">View →</div>
            </button>
          )}

          {cartOpen && (
            <CartSheet
              lines={cart}
              currency={outlet.currency}
              onClose={() => setCartOpen(false)}
              onInc={(id) => changeQty(id, +1)}
              onDec={(id) => changeQty(id, -1)}
              onRemark={setRemark}
              onRemove={clearLine}
              onSubmit={submitOrder}
              remarksEnabled={outlet.features.remarks}
            />
          )}

          {toast && <div className="toast">{toast}</div>}
        </>
      )}
    </div>
  );
}

function applyTheme(t: Outlet['theme']) {
  const root = document.documentElement.style;
  root.setProperty('--primary',   t.primary);
  root.setProperty('--secondary', t.secondary);
  root.setProperty('--accent',    t.accent);
  root.setProperty('--bg',        t.bg);
  root.setProperty('--surface',   t.surface);
  root.setProperty('--surface2',  t.surface2);
  root.setProperty('--text',      t.text);
  root.setProperty('--text-dim',  t.text_dim);
  root.setProperty('--font-display', `'${t.font_display}'`);
  root.setProperty('--font-body',    `'${t.font_body}'`);
  document.body.style.background = t.bg;
  document.body.style.color = t.text;
}
