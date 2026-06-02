'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Outlet, Staff } from '@/lib/types';

const NAV = [
  { section: 'Operations', items: [
    { key: 'orders',  label: 'Orders',    href: 'orders',   icon: '🧾' },
    { key: 'tables',  label: 'Tables',    href: 'tables',   icon: '🪑' },
    { key: 'menu',    label: 'Edit Menu', href: 'menu',     icon: '🍽️' },
  ]},
  { section: 'Insights', items: [
    { key: 'analytics', label: 'Analytics', href: 'analytics', icon: '📊' },
  ]},
  { section: 'Setup', items: [
    { key: 'qr',       label: 'QR Codes', href: 'qr',       icon: '📱' },
    { key: 'settings', label: 'Settings', href: 'settings', icon: '⚙️' },
  ]},
];

export function Sidebar({ outlet, staff }: { outlet: Outlet; staff: Staff }) {
  const path = usePathname();
  const base = `/${outlet.slug}/manager`;
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">{outlet.name.charAt(0)}</div>
        <div>
          <div className="name">{outlet.name}</div>
          <div className="sub">Manager</div>
        </div>
      </div>

      {NAV.map(group => (
        <div key={group.section}>
          <div className="nav-head">{group.section}</div>
          {group.items.map(it => {
            const href = `${base}/${it.href}`;
            const active = path.startsWith(href);
            return (
              <Link key={it.key} href={href} className={`nav-item ${active ? 'active' : ''}`}>
                <span className="icon">{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            );
          })}
        </div>
      ))}

      <div>
        <div className="nav-head">Kitchen</div>
        <a href={`/${outlet.slug}/kds`} target="_blank" rel="noopener" className="nav-item">
          <span className="icon">👨‍🍳</span>
          <span>Kitchen Display</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text4)' }}>↗</span>
        </a>
      </div>

      <div className="me">
        <div className="av">{staff.name.split(' ').map(p => p[0]).slice(0, 2).join('')}</div>
        <div className="info">
          <b>{staff.name}</b>
          <span>{staff.role}</span>
        </div>
        <form action="/auth/signout" method="post" style={{ marginLeft: 'auto' }}>
          <button className="out" title="Sign out" type="submit">⎋</button>
        </form>
      </div>
    </aside>
  );
}
