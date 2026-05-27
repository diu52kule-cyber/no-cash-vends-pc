import { useMemo, useRef, useState, useEffect } from 'react';
import type { CartLine, MenuCategory, MenuItem } from '../types';

type Props = {
  menu: { categories: MenuCategory[]; items: MenuItem[] };
  currency: string;
  cart: CartLine[];
  onAdd: (item: MenuItem) => void;
  onInc: (itemId: string) => void;
  onDec: (itemId: string) => void;
};

export function MenuView({ menu, currency, cart, onAdd, onInc, onDec }: Props) {
  const [active, setActive] = useState<string>(menu.categories[0]?.id ?? '');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const grouped = useMemo(() => {
    const g: Record<string, MenuItem[]> = {};
    menu.categories.forEach(c => { g[c.id] = []; });
    menu.items.forEach(i => { if (i.category_id && g[i.category_id]) g[i.category_id].push(i); });
    return g;
  }, [menu]);

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
      { rootMargin: '-90px 0px -60% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, [menu]);

  function scrollToCat(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <div className="cat-bar">
        {menu.categories.map(c => (
          <button
            key={c.id}
            className={`cat-chip ${active === c.id ? 'active' : ''}`}
            onClick={() => scrollToCat(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="menu-list">
        {menu.categories.map(c => grouped[c.id]?.length ? (
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
        ) : null)}
      </div>
    </>
  );
}
