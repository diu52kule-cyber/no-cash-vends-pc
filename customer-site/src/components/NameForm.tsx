import { useState } from 'react';

type Props = {
  onSubmit: (name: string, phone: string) => Promise<void>;
  onClose: () => void;
};

export function NameForm({ onSubmit, onClose }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const valid = name.trim().length >= 2 && /^[0-9]{10}$/.test(phone.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setErr('');
    try { await onSubmit(name.trim(), phone.trim()); }
    catch (e: any) { setErr(e.message ?? 'Something went wrong'); setBusy(false); }
  }

  return (
    <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="sheet" onSubmit={submit}>
        <h2>Welcome 🌴</h2>
        <p className="sub">Just so our staff know who's at the table.</p>
        <div className="field">
          <label>Your name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Aarav" autoFocus />
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="10-digit mobile" />
        </div>
        {err && <div style={{ color: '#e05a5a', fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <button type="submit" className="btn-primary" disabled={!valid || busy}>
          {busy ? 'One moment…' : 'See the menu'}
        </button>
      </form>
    </div>
  );
}
