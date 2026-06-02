'use client';
import { useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useRealtimeTable } from '@/lib/useRealtimeTable';
import { ImageEditor } from './ImageEditor';
import type { MenuCategory, MenuItem } from '@/lib/types';

type Props = {
  outletId: string;
  currency: string;
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
};

const EMPTY: Omit<MenuItem, 'id' | 'outlet_id'> = {
  category_id: null, name: '', description: '', price: 0, serving: '', emoji: '🍽️',
  image_url: null, prep_time: 15, is_veg: true, available: true, sort: 0,
};

export function MenuClient({ outletId, currency, initialCategories, initialItems }: Props) {
  const [cats, setCats] = useState<MenuCategory[]>(initialCategories);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [filter, setFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [editingImage, setEditingImage] = useState(false);
  const [managingCats, setManagingCats] = useState(false);

  useRealtimeTable<MenuItem>('menu_items', setItems, `outlet_id=eq.${outletId}`, {
    onRefetch: async () => {
      const supa = supabaseBrowser();
      const { data } = await supa.from('menu_items').select('*').eq('outlet_id', outletId).order('sort');
      if (data) setItems(data as MenuItem[]);
    },
  });

  useRealtimeTable<MenuCategory>('menu_categories', setCats, `outlet_id=eq.${outletId}`, {
    debug: false,
    onRefetch: async () => {
      const supa = supabaseBrowser();
      const { data } = await supa.from('menu_categories').select('*').eq('outlet_id', outletId).order('sort');
      if (data) setCats(data as MenuCategory[]);
    },
  });

  const sortedCats = useMemo(() => [...cats].sort((a, b) => a.sort - b.sort), [cats]);

  async function addCategory(name: string) {
    const supa = supabaseBrowser();
    const sort = sortedCats.length ? Math.max(...sortedCats.map(c => c.sort)) + 1 : 0;
    const { data, error } = await supa.from('menu_categories')
      .insert({ outlet_id: outletId, name: name.trim(), sort }).select().single();
    if (error) return alert(error.message);
    setCats(arr => arr.some(c => c.id === data.id) ? arr : [...arr, data as MenuCategory]);
  }

  async function renameCategory(id: string, name: string) {
    const supa = supabaseBrowser();
    setCats(arr => arr.map(c => c.id === id ? { ...c, name } : c)); // optimistic
    const { error } = await supa.from('menu_categories').update({ name: name.trim() }).eq('id', id);
    if (error) alert(error.message);
  }

  async function deleteCategory(id: string) {
    const inCat = items.filter(i => i.category_id === id).length;
    const msg = inCat
      ? `Delete this category? Its ${inCat} item${inCat === 1 ? '' : 's'} will become uncategorised (not deleted).`
      : 'Delete this category?';
    if (!confirm(msg)) return;
    const supa = supabaseBrowser();
    setCats(arr => arr.filter(c => c.id !== id));
    setItems(arr => arr.map(i => i.category_id === id ? { ...i, category_id: null } : i));
    if (filter === id) setFilter('all');
    const { error } = await supa.from('menu_categories').delete().eq('id', id);
    if (error) alert(error.message);
  }

  async function moveCategory(id: string, dir: -1 | 1) {
    const ordered = sortedCats;
    const idx = ordered.findIndex(c => c.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= ordered.length) return;
    const a = ordered[idx], b = ordered[swap];
    setCats(arr => arr.map(c => c.id === a.id ? { ...c, sort: b.sort } : c.id === b.id ? { ...c, sort: a.sort } : c));
    const supa = supabaseBrowser();
    await Promise.all([
      supa.from('menu_categories').update({ sort: b.sort }).eq('id', a.id),
      supa.from('menu_categories').update({ sort: a.sort }).eq('id', b.id),
    ]);
  }

  const catName = useMemo(() => new Map(cats.map(c => [c.id, c.name])), [cats]);
  const filtered = filter === 'all'
    ? items
    : filter === '__uncat'
      ? items.filter(i => !i.category_id)
      : items.filter(i => i.category_id === filter);

  async function toggleAvail(item: MenuItem) {
    const supa = supabaseBrowser();
    setItems(arr => arr.map(i => i.id === item.id ? { ...i, available: !i.available } : i));
    await supa.from('menu_items').update({ available: !item.available }).eq('id', item.id);
  }

  function openNew() { setEditing({ ...EMPTY, category_id: sortedCats[0]?.id ?? null }); }
  function openEdit(i: MenuItem) { setEditing({ ...i }); }

  async function uploadImage(blob: Blob) {
    const supa = supabaseBrowser();
    const path = `${outletId}/${editing?.id ?? 'new'}-${Date.now()}.jpg`;
    const { error: upErr } = await supa.storage.from('menu-images').upload(path, blob, {
      contentType: 'image/jpeg', cacheControl: '3600', upsert: true,
    });
    if (upErr) { alert(upErr.message); return; }
    const { data } = supa.storage.from('menu-images').getPublicUrl(path);
    setEditing(e => e ? { ...e, image_url: data.publicUrl } : e);
    setEditingImage(false);
  }

  async function removeImage() {
    if (!editing) return;
    setEditing({ ...editing, image_url: null });
  }

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
      image_url: editing.image_url ?? null,
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
            {sortedCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__uncat">Uncategorised</option>
          </select>
          <button className="btn btn-ghost" onClick={() => setManagingCats(true)}>Categories</button>
          <button className="btn btn-primary" onClick={openNew}>+ Add item</button>
        </div>
      </div>

      <div className="menu-grid">
        {filtered.map(i => (
          <div key={i.id} className="menu-card">
            <div className="img" style={i.image_url ? { backgroundImage: `url(${i.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'saturate(0.92) contrast(1.05) brightness(0.92)' } : undefined}>
              {!i.image_url && (i.emoji ?? '🍽️')}
            </div>
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

      {editing && !editingImage && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="modal">
            <h2>{editing.id ? 'Edit item' : 'New item'}</h2>

            {/* Image section */}
            <div className="field">
              <label>Photo</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 84, height: 84, borderRadius: 12,
                  background: editing.image_url
                    ? `url(${editing.image_url}) center/cover, var(--bg3)`
                    : 'var(--bg3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, border: '1px solid var(--border)',
                  filter: editing.image_url ? 'saturate(0.92) contrast(1.05) brightness(0.92)' : 'none',
                  flexShrink: 0,
                }}>
                  {!editing.image_url && (editing.emoji ?? '🍽️')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingImage(true)}>
                    {editing.image_url ? 'Replace / edit image' : 'Upload image'}
                  </button>
                  {editing.image_url && (
                    <button className="btn btn-danger btn-sm" onClick={removeImage}>Remove image</button>
                  )}
                </div>
              </div>
            </div>

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
                  {sortedCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field"><label>Emoji (fallback)</label><input value={editing.emoji ?? ''} onChange={e => setEditing({ ...editing, emoji: e.target.value })} /></div>
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

      {editing && editingImage && (
        <ImageEditor
          initialSrc={editing.image_url ?? null}
          onCancel={() => setEditingImage(false)}
          onSave={uploadImage}
        />
      )}

      {managingCats && (
        <CategoryManager
          cats={sortedCats}
          counts={items.reduce((m, i) => { if (i.category_id) m[i.category_id] = (m[i.category_id] ?? 0) + 1; return m; }, {} as Record<string, number>)}
          onAdd={addCategory}
          onRename={renameCategory}
          onDelete={deleteCategory}
          onMove={moveCategory}
          onClose={() => setManagingCats(false)}
        />
      )}
    </>
  );
}

function CategoryManager({
  cats, counts, onAdd, onRename, onDelete, onMove, onClose,
}: {
  cats: MenuCategory[];
  counts: Record<string, number>;
  onAdd: (name: string) => void | Promise<void>;
  onRename: (id: string, name: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onMove: (id: string, dir: -1 | 1) => void | Promise<void>;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState('');
  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>Categories</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
          Add, rename, reorder or remove categories. Order here is the order shown on the customer menu.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {cats.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>No categories yet — add your first below.</div>}
          {cats.map((c, idx) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button className="cat-move" onClick={() => onMove(c.id, -1)} disabled={idx === 0} aria-label="Move up">▲</button>
                <button className="cat-move" onClick={() => onMove(c.id, 1)} disabled={idx === cats.length - 1} aria-label="Move down">▼</button>
              </div>
              <input
                defaultValue={c.name}
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== c.name) onRename(c.id, v); }}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 54, textAlign: 'right' }}>
                {counts[c.id] ?? 0} item{(counts[c.id] ?? 0) === 1 ? '' : 's'}
              </span>
              <button className="btn btn-danger btn-sm" onClick={() => onDelete(c.id)}>Delete</button>
            </div>
          ))}
        </div>

        <div className="field">
          <label>Add category</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newName}
              placeholder="e.g. Desserts"
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { onAdd(newName); setNewName(''); } }}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" disabled={!newName.trim()} onClick={() => { onAdd(newName); setNewName(''); }}>Add</button>
          </div>
        </div>

        <div className="actions" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
