'use client';
import { useMemo, useState } from 'react';
import type { MenuItem, MenuCategory } from '@/lib/types';

export function AddItemsModal({
  currency, categories, items, onCancel, onConfirm,
}: {
  currency: string; categories: MenuCategory[]; items: MenuItem[];
  onCancel: () => void;
  onConfirm: (picks: { menuItemId: string; qty: number }[]) => Promise<void> | void;
}) {
  const [picks, setPicks] = useState<Map<string, number>>(new Map());
  const [activeCat, setActiveCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    let arr = items;
    if (activeCat !== 'all') arr = arr.filter(i => i.category_id === activeCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(i => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q));
    }
    return arr;
  }, [items, activeCat, search]);

  function bump(id: string, delta: number) {
    setPicks(p => {
      const n = new Map(p);
      const cur = (n.get(id) ?? 0) + delta;
      if (cur <= 0) n.delete(id); else n.set(id, cur);
      return n;
    });
  }

  const total = useMemo(() => {
    let t = 0; let count = 0;
    picks.forEach((q, id) => {
      const i = items.find(x => x.id === id);
      if (i) { t += i.price * q; count += q; }
    });
    return { t, count };
  }, [picks, items]);

  async function confirm() {
    if (picks.size === 0) return;
    setBusy(true);
    try {
      await onConfirm(Array.from(picks.entries()).map(([menuItemId, qty]) => ({ menuItemId, qty })));
    } finally { setBusy(false); }
  }

  return (
    <div className="w-modal-bg" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-modal">
        <div className="w-modal-head">
          <h2>Add items</h2>
          <button onClick={onCancel} className="w-modal-close">×</button>
        </div>

        <div className="w-modal-search">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search items…" autoFocus />
        </div>

        <div className="w-modal-cats">
          <button className={`w-cat-chip ${activeCat === 'all' ? 'on' : ''}`} onClick={() => setActiveCat('all')}>All</button>
          {categories.map(c => (
            <button key={c.id} className={`w-cat-chip ${activeCat === c.id ? 'on' : ''}`} onClick={() => setActiveCat(c.id)}>{c.name}</button>
          ))}
        </div>

        <div className="w-modal-items">
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>No items match</div>
          ) : filtered.map(i => {
            const qty = picks.get(i.id) ?? 0;
            return (
              <div key={i.id} className={`w-mitem ${qty > 0 ? 'has-pick' : ''}`}>
                <div className="w-mitem-emoji">{i.emoji ?? '🍽️'}</div>
                <div className="w-mitem-info">
                  <div className="w-mitem-name">{i.name}</div>
                  <div className="w-mitem-price">{currency}{Number(i.price).toFixed(0)}</div>
                </div>
                {qty === 0 ? (
                  <button className="w-mitem-add" onClick={() => bump(i.id, 1)}>+</button>
                ) : (
                  <div className="w-mitem-qty">
                    <button onClick={() => bump(i.id, -1)}>−</button>
                    <span>{qty}</span>
                    <button onClick={() => bump(i.id, 1)}>+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="w-modal-foot">
          {total.count > 0 ? (
            <button className="w-btn w-btn-primary w-btn-lg" style={{ width: '100%' }} onClick={confirm} disabled={busy}>
              {busy ? 'Adding…' : `Add ${total.count} item${total.count !== 1 ? 's' : ''} · ${currency}${total.t.toFixed(0)}`}
            </button>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '14px 0' }}>Tap + on items to add them</div>
          )}
        </div>
      </div>

      <style>{`
        .w-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); z-index: 200; display: flex; align-items: flex-end; justify-content: center; padding: 0; animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .w-modal { width: 100%; max-width: 720px; max-height: 90dvh; background: var(--bg2); border-top-left-radius: 24px; border-top-right-radius: 24px; display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes slideUp { from { transform: translateY(80px); } to { transform: none; } }
        .w-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid var(--border); }
        .w-modal-head h2 { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; }
        .w-modal-close { width: 36px; height: 36px; border-radius: 50%; background: var(--bg3); font-size: 22px; color: var(--text2); display: flex; align-items: center; justify-content: center; }
        .w-modal-search { padding: 14px 22px 0; }
        .w-modal-search input { width: 100%; padding: 14px 16px; border-radius: 12px; background: var(--bg1); border: 1px solid var(--border); font-size: 15px; }
        .w-modal-cats { display: flex; gap: 6px; padding: 12px 22px 6px; overflow-x: auto; scrollbar-width: none; }
        .w-modal-cats::-webkit-scrollbar { display: none; }
        .w-cat-chip { flex-shrink: 0; padding: 8px 14px; border-radius: 999px; background: var(--bg3); font-size: 12px; font-weight: 500; color: var(--text2); border: 1px solid transparent; transition: all 0.15s; }
        .w-cat-chip.on { background: var(--brand-dim); color: var(--brand); border-color: rgba(200,169,110,0.3); }
        .w-modal-items { flex: 1; overflow-y: auto; padding: 12px 22px; display: flex; flex-direction: column; gap: 8px; }
        .w-mitem { display: grid; grid-template-columns: 50px 1fr auto; gap: 14px; align-items: center; padding: 14px; border-radius: 12px; background: var(--bg1); border: 1.5px solid transparent; transition: all 0.2s; }
        .w-mitem.has-pick { border-color: var(--brand); background: rgba(200,169,110,0.05); }
        .w-mitem-emoji { font-size: 28px; text-align: center; }
        .w-mitem-name { font-size: 14.5px; font-weight: 500; }
        .w-mitem-price { font-size: 12px; color: var(--text3); margin-top: 2px; }
        .w-mitem-add { width: 44px; height: 44px; border-radius: 12px; background: var(--brand); color: var(--bg1); font-size: 22px; font-weight: 700; }
        .w-mitem-add:active { transform: scale(0.92); }
        .w-mitem-qty { display: flex; align-items: center; background: var(--bg3); border-radius: 12px; overflow: hidden; }
        .w-mitem-qty button { width: 44px; height: 44px; font-size: 22px; font-weight: 700; color: var(--brand); }
        .w-mitem-qty button:active { background: rgba(200,169,110,0.15); }
        .w-mitem-qty span { min-width: 30px; text-align: center; font-weight: 700; font-size: 16px; font-variant-numeric: tabular-nums; }
        .w-modal-foot { padding: 16px 22px 20px; border-top: 1px solid var(--border); }
      `}</style>
    </div>
  );
}
