'use client';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { Table } from '@/lib/types';

const CUSTOMER_BASE = process.env.NEXT_PUBLIC_CUSTOMER_SITE_URL ?? 'https://beneficial-charm-production-d3c1.up.railway.app';

export function QRClient({ outletId, outletSlug, initialTables }: { outletId: string; outletSlug: string; initialTables: Table[] }) {
  const [tables, setTables] = useState<Table[]>(initialTables);
  const [num, setNum] = useState<number | ''>('');
  const [cap, setCap] = useState<number | ''>(4);
  const [zone, setZone] = useState('Rooftop');
  const [busy, setBusy] = useState(false);

  const urlFor = (qrUid: string) => `${CUSTOMER_BASE}/${outletSlug}/t/${qrUid}`;

  async function addTable() {
    if (!num || Number(num) < 1) return;
    setBusy(true);
    const qrUid = `tbl-${String(num).padStart(3, '0')}`;
    const supa = supabaseBrowser();
    const { data, error } = await supa.from('tables').insert({
      outlet_id: outletId, number: Number(num), capacity: Number(cap || 4), zone, qr_uid: qrUid,
    }).select().single();
    setBusy(false);
    if (error) return alert(error.message);
    setTables(t => [...t, data as Table].sort((a, b) => a.number - b.number));
    setNum('');
  }

  async function removeTable(t: Table) {
    if (!confirm(`Remove Table ${t.number}? Active orders for this table will block deletion.`)) return;
    const supa = supabaseBrowser();
    const { error } = await supa.from('tables').delete().eq('id', t.id);
    if (error) return alert(error.message);
    setTables(arr => arr.filter(x => x.id !== t.id));
  }

  function downloadSVG(qrUid: string, number: number) {
    const svg = document.getElementById(`qr-${qrUid}`)?.outerHTML;
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `table-${number}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <div className="page-h">
        <div>
          <h1>QR Codes</h1>
          <p>Each QR opens the ordering page locked to that table. Print on table tents.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 500, marginBottom: 14 }}>Add new table</div>
          <div className="field"><label>Table number</label><input type="number" min={1} value={num} onChange={e => setNum(e.target.value ? Number(e.target.value) : '')} placeholder="13" /></div>
          <div className="field"><label>Capacity</label><input type="number" min={1} value={cap} onChange={e => setCap(e.target.value ? Number(e.target.value) : '')} /></div>
          <div className="field"><label>Zone</label>
            <select value={zone} onChange={e => setZone(e.target.value)}>
              <option>Rooftop</option><option>Lounge</option><option>Indoor</option><option>Outdoor</option><option>Bar</option>
            </select>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 11 }} onClick={addTable} disabled={busy || !num}>
            {busy ? 'Adding…' : 'Generate & add'}
          </button>
        </div>

        <div>
          <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 10 }}>{tables.length} tables configured</div>
          <div className="qr-grid">
            {tables.map(t => (
              <div key={t.id} className="qr-card">
                <div className="qr-box">
                  <QRCodeSVG id={`qr-${t.qr_uid}`} value={urlFor(t.qr_uid)} size={100} level="M" />
                </div>
                <div className="tno">Table {t.number}</div>
                <div className="meta">{t.zone} · seats {t.capacity}</div>
                <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => downloadSVG(t.qr_uid, t.number)}>SVG</button>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigator.clipboard.writeText(urlFor(t.qr_uid))}>Link</button>
                  <button className="btn btn-danger btn-sm" style={{ justifyContent: 'center' }} onClick={() => removeTable(t)} title="Delete">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
