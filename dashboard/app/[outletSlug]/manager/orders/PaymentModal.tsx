'use client';
import { useState } from 'react';

export type PaymentMethod = 'cash' | 'upi' | 'card';

const METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'upi',  label: 'UPI',  icon: '📱' },
  { key: 'card', label: 'Card', icon: '💳' },
];

export function PaymentModal({
  total, currency, onCancel, onConfirm,
}: {
  total: number; currency: string;
  onCancel: () => void;
  onConfirm: (methods: PaymentMethod[]) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<Set<PaymentMethod>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(m: PaymentMethod) {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(m)) n.delete(m); else { if (n.size >= 2) { const first = n.values().next().value!; n.delete(first); } n.add(m); }
      return n;
    });
  }

  async function confirm() {
    if (selected.size === 0) return;
    setBusy(true);
    try { await onConfirm(Array.from(selected)); } finally { setBusy(false); }
  }

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" style={{ width: 380 }}>
        <h2>Payment received via</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>
          Pick one or two methods. Total: <b style={{ color: 'var(--brand)' }}>{currency}{total.toLocaleString('en-IN')}</b>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
          {METHODS.map(m => {
            const on = selected.has(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggle(m.key)}
                style={{
                  padding: '18px 10px', borderRadius: 12, fontSize: 13, fontWeight: 500,
                  background: on ? 'var(--brand-dim)' : 'var(--bg3)',
                  border: on ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
                  color: on ? 'var(--brand)' : 'var(--text2)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 28 }}>{m.icon}</span>
                {m.label}
              </button>
            );
          })}
        </div>
        {selected.size > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 12 }}>
            {selected.size === 1 ? 'Single method' : 'Split payment — note the breakdown on the printed bill'}
          </div>
        )}
        <div className="actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm} disabled={busy || selected.size === 0}>
            {busy ? 'Saving…' : `Confirm & Print`}
          </button>
        </div>
      </div>
    </div>
  );
}
