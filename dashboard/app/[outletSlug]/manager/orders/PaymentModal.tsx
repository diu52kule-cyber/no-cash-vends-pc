'use client';
import { useMemo, useState } from 'react';

export type PaymentMethod = 'cash' | 'upi' | 'card';
export type Payment = { method: PaymentMethod; amount: number };

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
  onConfirm: (payments: Payment[]) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<PaymentMethod[]>([]);
  // amount entered for the FIRST method when splitting; the second gets the remainder
  const [firstAmount, setFirstAmount] = useState<string>('');
  const [busy, setBusy] = useState(false);

  function toggle(m: PaymentMethod) {
    setSelected(s => {
      if (s.includes(m)) return s.filter(x => x !== m);
      if (s.length >= 2) return [s[1], m];   // keep max 2, drop the oldest
      return [...s, m];
    });
    setFirstAmount('');
  }

  const split = selected.length === 2;
  const firstAmt = split ? Math.min(total, Math.max(0, Number(firstAmount) || 0)) : 0;
  const secondAmt = split ? Math.max(0, total - firstAmt) : 0;

  const payments: Payment[] = useMemo(() => {
    if (selected.length === 1) return [{ method: selected[0], amount: total }];
    if (split) return [{ method: selected[0], amount: firstAmt }, { method: selected[1], amount: secondAmt }];
    return [];
  }, [selected, split, firstAmt, secondAmt, total]);

  const valid = selected.length === 1 || (split && firstAmt > 0 && firstAmt < total);

  async function confirm() {
    if (!valid) return;
    setBusy(true);
    try { await onConfirm(payments); } finally { setBusy(false); }
  }

  const label = (m: PaymentMethod) => METHODS.find(x => x.key === m)!.label;

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" style={{ width: 380 }}>
        <h2>Payment received via</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>
          Pick one or two methods. Total: <b style={{ color: 'var(--brand)' }}>{currency}{total.toLocaleString('en-IN')}</b>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {METHODS.map(m => {
            const on = selected.includes(m.key);
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

        {split && (
          <div style={{ marginBottom: 16 }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>{label(selected[0])} amount</label>
              <input
                type="number" min={0} max={total} value={firstAmount}
                placeholder={`e.g. ${Math.round(total / 2)}`}
                onChange={e => setFirstAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)' }}>
              <span>{label(selected[1])} (remainder)</span>
              <b style={{ color: 'var(--brand)' }}>{currency}{secondAmt.toLocaleString('en-IN')}</b>
            </div>
            {!valid && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 6 }}>Enter an amount between 1 and {currency}{total - 1}.</div>}
          </div>
        )}

        <div className="actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm} disabled={busy || !valid}>
            {busy ? 'Saving…' : 'Confirm & close'}
          </button>
        </div>
      </div>
    </div>
  );
}
