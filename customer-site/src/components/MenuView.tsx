import { useMemo, useRef, useState, useEffect, type ReactNode } from 'react';
import type { CartLine, MenuCategory, MenuItem } from '../types';
import { WaiterCallBtn } from './WaiterCall';

type HeaderInfo = {
  outletName: string;
  tagline: string;
  tableNumber: number | string;
  zone: string;
  waiterCall: boolean;
  onCallWaiter: () => void;
};

type Props = {
  menu: { categories: MenuCategory[]; items: MenuItem[] };
  currency: string;
  cart: CartLine[];
  onAdd: (item: MenuItem) => void;
  onInc: (itemId: string) => void;
  onDec: (itemId: string) => void;
  header: HeaderInfo;
  activeOrder?: ReactNode;
};

const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const TableIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 9h16M6 9l-1 11M18 9l1 11M5 5h14a1 1 0 0 1 1 1v3H4V6a1 1 0 0 1 1-1Z" />
  </svg>
);

function Wordmark({ name }: { name: string }) {
  const word = (name.split(' ')[0] || name).toUpperCase();
  const idx = word.indexOf('T');
  if (idx === -1) return <>{word}</>;
  return <>{word.slice(0, idx)}<span className="hl">T</span>{word.slice(idx + 1)}</>;
}

export function MenuView({ menu, currency, cart, onAdd, onInc, onDec, header, activeOrder }: Props) {
  const [query, setQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [active, setActive] = useState<string>(menu.categories[0]?.id ?? '');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const catBarRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const filtering = q.length > 0 || vegOnly;

  const grouped = useMemo(() => {
    const match = (i: MenuItem) =>
      (!vegOnly || i.is_veg) &&
      (!q || i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q));
    const g: Record<string, MenuItem[]> = {};
    menu.categories.forEach(c => { g[c.id] = []; });
    menu.items.forEach(i => { if (i.category_id && g[i.category_id] && match(i)) g[i.category_id].push(i); });
    return g;
  }, [menu, q, vegOnly]);

  const visibleCats = useMemo(
    () => menu.categories.filter(c => grouped[c.id]?.length),
    [menu.categories, grouped]
  );

  const cartMap = useMemo(() => {
    const m = new Map<string, number>();
    cart.forEach(l => m.set(l.item.id, (m.get(l.item.id) ?? 0) + l.qty));
    return m;
  }, [cart]);

  // intersection observer to highlight active category chip
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.getAttribute('data-cat-id') || '');
      },
      { rootMargin: '-160px 0px -55% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, [menu, visibleCats.length]);

  // keep the active chip scrolled into view inside the horizontal bar
  useEffect(() => {
    const bar = catBarRef.current;
    if (!bar) return;
    const chip = bar.querySelector<HTMLElement>(`[data-chip-id="${active}"]`);
    if (chip) {
      const target = chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2;
      bar.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
  }, [active]);

  function scrollToCat(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const { outletName, tagline, tableNumber, zone, waiterCall, onCallWaiter } = header;
  const tableLabel = String(tableNumber).padStart(3, '0');
  const zoneLabel = (zone || 'Dine-in').toUpperCase();

  return (
    <>
      <div className="menu-header">
        <div className="top">
          <div className="brand">
            <div className="wordmark"><Wordmark name={outletName} /></div>
            {tagline && <div className="tagline">{tagline}</div>}
          </div>
          <div className="header-actions">
            {waiterCall && <WaiterCallBtn onClick={onCallWaiter} />}
            <div className="table-badge">
              <span className="ic"><TableIcon /></span>
              <div>
                <div className="tnum">TABLE {tableLabel}</div>
                <div className="tzone">{zoneLabel}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="search-row">
          <div className="search-box">
            <span className="search-ic"><SearchIcon /></span>
            <input
              type="text"
              inputMode="search"
              placeholder="Search dishes & drinks..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>
            )}
          </div>
          <button
            className={`veg-toggle ${vegOnly ? 'on' : ''}`}
            onClick={() => setVegOnly(v => !v)}
            aria-pressed={vegOnly}
          >
            <span className="veg-box" />
            Veg
          </button>
        </div>

        <div className="cat-bar" ref={catBarRef}>
          {visibleCats.map(c => (
            <button
              key={c.id}
              data-chip-id={c.id}
              className={`cat-chip ${active === c.id ? 'active' : ''}`}
              onClick={() => scrollToCat(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {activeOrder}

      <div className="menu-list">
        {visibleCats.length === 0 ? (
          <div className="menu-empty">
            No dishes match{q ? ` “${query.trim()}”` : ''}{vegOnly ? ' (veg only)' : ''}.
          </div>
        ) : visibleCats.map(c => (
          <div
            key={c.id} className="cat-section"
            data-cat-id={c.id}
            ref={el => (sectionRefs.current[c.id] = el)}
          >
            <div className="cat-title">{c.name}</div>
            {grouped[c.id].map(item => {
              const qty = cartMap.get(item.id) ?? 0;
              return (
                <div className="dish" key={item.id}>
                  <div className="info">
                    <div className="name">
                      <span className={`veg-dot ${item.is_veg ? 'veg' : 'nonveg'}`} aria-hidden />
                      {item.name}
                    </div>
                    {item.description && <div className="desc">{item.description}</div>}
                    <div className="meta">
                      <span className="price">{currency}{Number(item.price).toFixed(0)}</span>
                      {item.serving && <span>· {item.serving}</span>}
                      <span>· {item.prep_time} min</span>
                    </div>
                  </div>
                  <div className="right">
                    <div className="visual">
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} loading="lazy" />
                        : <span className="emoji">{item.emoji ?? '🍽️'}</span>}
                    </div>
                    {qty === 0 ? (
                      <button className="add-btn" onClick={() => onAdd(item)}>Add +</button>
                    ) : (
                      <div className="qty-ctrl">
                        <button onClick={() => onDec(item.id)} aria-label="decrease">−</button>
                        <span className="n">{qty}</span>
                        <button onClick={() => onInc(item.id)} aria-label="increase">+</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
