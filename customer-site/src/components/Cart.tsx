import { useState } from 'react';
import type { CartLine } from '../types';

type Props = {
  lines: CartLine[];
  currency: string;
  remarksEnabled: boolean;
  onClose: () => void;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemark: (id: string, remark: string) => void;
  onRemove: (id: string) => void;
  onSubmit: () => Promise<void>;
};

export function CartSheet({ lines, currency, remarksEnabled, onClose, onInc, onDec, onRemark, onRemove, onSubmit }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);

  async function submit() {
    setBusy(true);
    try { await onSubmit(); } finally { setBusy(false); }
  }

  return (
    <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet cart-sheet">
        <h2>Your Order</h2>
        <p className="sub">Review, then send to kitchen. No payment now — pay at the counter or to a waiter.</p>

        {lines.map(l => (
          <div key={l.item.id}>
            <div className="cart-line">
              <div>
                <div className="ln-name">{l.item.emoji} {l.item.name}</div>
                <div className="ln-meta">{currency}{l.item.price} × {l.qty}</div>
                {l.remark && <div className="ln-remark">"{l.remark}"</div>}
                {remarksEnabled && (
                  <button
                    onClick={() => setExpanded(expanded === l.item.id ? null : l.item.id)}
                    style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, textDecoration: 'underline' }}
                  >
                    {l.remark ? 'Edit note' : '+ Add note'}
                  </button>
                )}
              </div>
              <div className="qty-ctrl">
                <button onClick={() => l.qty === 1 ? onRemove(l.item.id) : onDec(l.item.id)}>−</button>
                <span className="n">{l.qty}</span>
                <button onClick={() => onInc(l.item.id)}>+</button>
              </div>
              <div className="ln-price">{currency}{(l.item.price * l.qty).toFixed(0)}</div>
            </div>
            {expanded === l.item.id && (
              <div className="field" style={{ marginTop: 0, marginBottom: 12 }}>
                <textarea
                  rows={2}
                  placeholder="e.g. less spicy, no onion"
                  value={l.remark}
                  onChange={(e) => onRemark(l.item.id, e.target.value)}
                  maxLength={120}
                />
              </div>
            )}
          </div>
        ))}

        <div className="totals">
          <div className="row"><span>Subtotal</span><span>{currency}{total.toFixed(0)}</span></div>
          <div className="row" style={{ color: 'var(--text-dim)', fontSize: 11 }}>
            <span>Taxes &amp; charges</span><span>Shown on final bill</span>
          </div>
          <div className="row grand"><span>Total</span><span>{currency}{total.toFixed(0)}</span></div>
        </div>

        <button className="btn-primary" disabled={busy || lines.length === 0} onClick={submit}>
          {busy ? 'Sending to kitchen…' : 'Send to kitchen'}
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: 12, marginTop: 8, fontSize: 13, color: 'var(--text-dim)' }}>
          Keep browsing
        </button>
      </div>
    </div>
  );
}
