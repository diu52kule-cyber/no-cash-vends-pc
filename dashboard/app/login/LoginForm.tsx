'use client';
import { use, useActionState } from 'react';
import { loginAction } from './actions';

export function LoginForm({ nextPromise }: { nextPromise: Promise<{ next?: string }> }) {
  const next = use(nextPromise).next ?? '/raasta/manager/orders';
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label>Email</label>
        <input name="email" type="email" required autoComplete="email" placeholder="you@cafe.com" />
      </div>
      <div className="field">
        <label>Password</label>
        <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
      </div>
      {state?.error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{state.error}</div>}
      <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
