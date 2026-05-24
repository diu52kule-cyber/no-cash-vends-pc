'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useRealtimeRow } from '@/lib/useRealtimeTable';
import type { Outlet } from '@/lib/types';

export function SettingsClient({ initialOutlet }: { initialOutlet: Outlet }) {
  const [o, setO] = useState<Outlet>(initialOutlet);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Realtime: pull in updates from other admin sessions without losing in-progress edits
  useRealtimeRow<Outlet>('outlets', initialOutlet.id, (fresh) => {
    if (!saving) setO(prev => ({ ...prev, ...fresh, features: fresh.features ?? prev.features, theme: fresh.theme ?? prev.theme }));
  });

  function up<K extends keyof Outlet>(k: K, v: Outlet[K]) { setO({ ...o, [k]: v }); }
  function feat(k: string, v: boolean) { setO({ ...o, features: { ...o.features, [k]: v } }); }

  async function save() {
    setSaving(true); setMsg('');
    const supa = supabaseBrowser();
    const { error } = await supa.from('outlets').update({
      name: o.name, tagline: o.tagline, address: o.address, phone: o.phone, email: o.email,
      gstin: o.gstin, cgst: o.cgst, sgst: o.sgst, service_charge: o.service_charge,
      features: o.features,
    }).eq('id', o.id);
    setSaving(false);
    setMsg(error ? `Error: ${error.message}` : 'Saved.');
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Settings</h1>
          <p>Outlet details, billing, and features.</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div className="spanel" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>General</h3>
        <div className="field-row">
          <div className="field"><label>Outlet name</label><input value={o.name} onChange={e => up('name', e.target.value)} /></div>
          <div className="field"><label>Tagline</label><input value={o.tagline ?? ''} onChange={e => up('tagline', e.target.value)} /></div>
        </div>
        <div className="field"><label>Address</label><textarea rows={2} value={o.address ?? ''} onChange={e => up('address', e.target.value)} /></div>
        <div className="field-row">
          <div className="field"><label>Phone</label><input value={o.phone ?? ''} onChange={e => up('phone', e.target.value)} /></div>
          <div className="field"><label>Email</label><input type="email" value={o.email ?? ''} onChange={e => up('email', e.target.value)} /></div>
        </div>
      </div>

      <div className="spanel" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>Tax & Billing</h3>
        <div className="field-row">
          <div className="field"><label>GSTIN</label><input value={o.gstin ?? ''} onChange={e => up('gstin', e.target.value)} /></div>
          <div className="field"><label>Service charge (%)</label><input type="number" step="0.5" value={o.service_charge} onChange={e => up('service_charge', Number(e.target.value))} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label>CGST (%)</label><input type="number" step="0.5" value={o.cgst} onChange={e => up('cgst', Number(e.target.value))} /></div>
          <div className="field"><label>SGST (%)</label><input type="number" step="0.5" value={o.sgst} onChange={e => up('sgst', Number(e.target.value))} /></div>
        </div>
      </div>

      <div className="spanel">
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>Features</h3>
        {[
          { k: 'waiter_call', label: 'Customer can call waiter from their phone' },
          { k: 'remarks', label: 'Customer can add notes to items (e.g. "less spicy")' },
          { k: 'service_charge', label: 'Show service charge on bill' },
          { k: 'kds', label: 'Send orders to Kitchen Display System (Phase 4)' },
        ].map(f => (
          <div key={f.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13 }}>{f.label}</div>
            <button className={`toggle ${o.features?.[f.k] ? 'on' : ''}`} onClick={() => feat(f.k, !o.features?.[f.k])} />
          </div>
        ))}
      </div>

      {msg && <div className="toast-stack"><div className={`toast ${msg.startsWith('Error') ? 'error' : 'success'}`}>{msg}</div></div>}
    </>
  );
}
