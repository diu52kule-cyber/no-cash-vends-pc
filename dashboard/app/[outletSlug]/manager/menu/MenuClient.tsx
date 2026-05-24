'use client';
import { useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { MenuCategory, MenuItem } from '@/lib/types';

type Props = {
  outletId: string;
  currency: string;
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
};

const EMPTY: Omit<MenuItem, 'id' | 'outlet_id'> = {
  category_id: null, name: '', description: '', price: 0, serving: '', emoji: '🍽️',
  prep_time: 15, is_veg: true, available: true, sort: 0,
};

export function MenuClient({ outletId, currency, initialCategories, initialItems }: Props) {
  const [cats] = useState<MenuCategory[]>(initialCategories);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [filter, setFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);

  const catName = useMemo(() => new Map(cats.map(c => [c.id, c.name])), [cats]);
  const filtered = filter === 'all' ? items : items.filter(i => i.category_id === filter);

  async function toggleAvail(item: MenuItem) {
    const supa = supabaseBrowser();
    setItems(arr => arr.map(i => i.id === item.id ? { ...i, available: !i.available } : i));
    await supa.from('menu_items').update({ available: !item.available }).eq('id', item.id);
  }

  function openNew() { setEditing({ ...EMPTY, category_id: cats[0]?.id ?? null }); }
  function openEdit(i: MenuItem) { setEditing({ ...i }); }

  async function save() {
    if (!editing) return;
    const payload = {
      outlet_id: outletId,
      category_id: editing.category_id ?? null,
      name: editing.name?.trim() ?? '',
      description: editing.description ?? null,
      price: Number(editing.price ?? 0),
      serving: editing.serving ?? null,
      emoji: editing.emoji ?? '🍽️',
      prep_time: Number(editing.prep_time ?? 15),
      is_veg: editing.is_veg !== false,
      available: editing.available !== false,
      sort: Number(editing.sort ?? 0),
    };
    if (!payload.name) { alert('Name required'); return; }
    const supa = supabaseBrowser();
    if (editing.id) {
      const { data, error } = await supa.from('menu_items').update(payload).eq('id', editing.id).select().single();
      if (error) return alert(error.message);
      setItems(arr => arr.map(i => i.id === data.id ? data as MenuItem : i));
    } else {
      const { data, error } = await supa.from('menu_items').insert(payload).select().single();
      if (error) return alert(error.message);
      setItems(arr => [...arr, data as MenuItem]);
    }
    setEditing(null);
  }

  async function remove() {
    if (!editing?.id || !confirm('Delete this item?')) return;
    const supa = supabaseBrowser();
    await supa.from('menu_items').delete().eq('id', editing.id);
    setItems(arr => arr.filter(i => i.id !== editing.id));
    setEditing(null);
  }

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Menu</h1>
          <p>Changes reflect on customer ordering site instantly.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 180 }}>
            <option value="all">All categories</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={openNew}>+ Add item</button>
        </div>
      </div>

      <div className="menu-grid">
        {filtered.map(i => (
          <div key={i.id} className="menu-card">
            <div className="img">{i.emoji ?? '🍽️'}</div>
            <div className="body">
              <div className="name"><span className={`veg veg-${i.is_veg}`} />{i.name}</div>
              <div className="desc">{i.description ?? ''}</div>
              <div className="row">
                <span className="price">{currency}{Number(i.price).toFixed(0)}</span>
                <span className="cat">{i.category_id ? catName.get(i.category_id) : '—'}</span>
              </div>
              <div className="row">
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{i.available ? 'Available' : 'Unavailable'}</span>
                <button className={`toggle ${i.available ? 'on' : ''}`} onClick={() => toggleAvail(i)} aria-label="toggle available" />
              </div>
              <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => openEdit(i)}>Edit</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ color: 'var(--text3)' }}>No items in this category.</div>}
      </div>

      {editing && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="modal">
            <h2>{editing.id ? 'Edit item' : 'New item'}</h2>
            <div className="field"><label>Name</label><input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="field"><label>Description</label><textarea rows={2} value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="field-row">
              <div className="field"><label>Price ({currency})</label><input type="number" value={editing.price ?? 0} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
              <div className="field"><label>Serving</label><input value={editing.serving ?? ''} onChange={e => setEditing({ ...editing, serving: e.target.value })} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Category</label>
                <select value={editing.category_id ?? ''} onChange={e => setEditing({ ...editing, category_id: e.target.value || null })}>
                  <option value="">— none —</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field"><label>Emoji</label><input value={editing.emoji ?? ''} onChange={e => setEditing({ ...editing, emoji: e.target.value })} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Prep time (min)</label><input type="number" value={editing.prep_time ?? 15} onChange={e => setEditing({ ...editing, prep_time: Number(e.target.value) })} /></div>
              <div className="field"><label>Type</label>
                <select value={editing.is_veg ? 'veg' : 'nonveg'} onChange={e => setEditing({ ...editing, is_veg: e.target.value === 'veg' })}>
                  <option value="veg">Veg</option><option value="nonveg">Non-veg</option>
                </select>
              </div>
            </div>
            <div className="actions">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              {editing.id && <button className="btn btn-danger" onClick={remove}>Delete</button>}
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
