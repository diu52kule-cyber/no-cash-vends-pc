'use client';
import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

export function LoginForm({ nextPromise }: { nextPromise: Promise<{ next?: string }> }) {
  const next = use(nextPromise).next ?? '/raasta/manager/orders';
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const supa = supabaseBrowser();
    const { error } = await supa.auth.signInWithPassword({ email, password: pwd });
    if (error) { setErr(error.message); setBusy(false); return; }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Email</label>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@cafe.com" />
      </div>
      <div className="field">
        <label>Password</label>
        <input type="password" required value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••" />
      </div>
      {err && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{err}</div>}
      <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
