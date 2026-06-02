'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Staff } from '@/lib/types';
import type { Role } from '@/lib/access';
import { createStaff, setStaffRole, setStaffActive, deleteStaff } from './actions';

const ROLES: Role[] = ['admin', 'manager', 'waiter', 'chef'];
const ROLE_HINT: Record<Role, string> = {
  admin: 'Everything + manage logins',
  manager: 'Manager dashboard',
  waiter: 'Waiter screen',
  chef: 'Kitchen Display only',
};

export function StaffClient({ outletSlug, currentUserId, staff }: {
  outletSlug: string; currentUserId: string; staff: Staff[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'waiter' as Role });
  const [adding, setAdding] = useState(false);

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setErr('');
    start(async () => {
      const res = await fn();
      if (res?.error) setErr(res.error);
      else { after?.(); router.refresh(); }
    });
  }

  function add() {
    if (!form.name.trim() || !form.email.trim() || !form.password) { setErr('Name, email and password are required.'); return; }
    run(() => createStaff(outletSlug, form), () => { setForm({ name: '', email: '', password: '', role: 'waiter' }); setAdding(false); });
  }

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Team &amp; logins</h1>
          <p>Create logins and set what each person can access. Admin-only.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(a => !a)}>{adding ? 'Close' : '+ Add login'}</button>
      </div>

      {err && <div className="card" style={{ padding: 12, marginBottom: 14, color: 'var(--red)', background: 'var(--red-dim)', border: '1px solid var(--red)' }}>{err}</div>}

      {adding && (
        <div className="card" style={{ padding: 16, marginBottom: 18 }}>
          <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
            <div className="field"><label>Email (login)</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@outlet.com" /></div>
          </div>
          <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Temporary password</label><input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="min 6 characters" /></div>
            <div className="field"><label>Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>
                {ROLES.map(r => <option key={r} value={r}>{r} — {ROLE_HINT[r]}</option>)}
              </select>
            </div>
          </div>
          <div className="actions">
            <button className="btn btn-ghost" onClick={() => { setAdding(false); setErr(''); }} disabled={pending}>Cancel</button>
            <button className="btn btn-primary" onClick={add} disabled={pending}>{pending ? 'Creating…' : 'Create login'}</button>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="staff-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Access</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {staff.map(s => {
              const isMe = s.auth_user_id === currentUserId;
              return (
                <tr key={s.id} style={s.active ? undefined : { opacity: 0.5 }}>
                  <td>{s.name}{isMe && <span style={{ color: 'var(--text3)', fontSize: 11 }}> · you</span>}</td>
                  <td style={{ color: 'var(--text3)' }}>{s.email ?? '—'}</td>
                  <td>
                    <select
                      value={s.role}
                      disabled={pending || isMe}
                      onChange={e => run(() => setStaffRole(outletSlug, s.id, e.target.value as Role))}
                      style={{ width: 130 }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>{ROLE_HINT[s.role as Role]}</td>
                  <td>
                    <button
                      className={`toggle ${s.active ? 'on' : ''}`}
                      disabled={pending || isMe}
                      title={s.active ? 'Active — click to disable' : 'Disabled — click to enable'}
                      onClick={() => run(() => setStaffActive(outletSlug, s.id, !s.active))}
                    />
                  </td>
                  <td>
                    {!isMe && (
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={pending}
                        onClick={() => { if (confirm(`Delete ${s.name}'s login? This removes their access permanently.`)) run(() => deleteStaff(outletSlug, s.id)); }}
                      >Delete</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        .staff-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .staff-table th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text4); padding: 12px 16px; border-bottom: 1px solid var(--border); }
        .staff-table td { padding: 12px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .staff-table tr:last-child td { border-bottom: none; }
      `}</style>
    </>
  );
}
