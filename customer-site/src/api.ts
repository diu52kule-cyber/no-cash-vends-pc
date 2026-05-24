import type { ActiveOrder, MenuCategory, MenuItem, Outlet, Table } from './types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(text || `HTTP ${r.status}`);
  }
  return r.json();
}

export const api = {
  outlet: (slug: string) => req<Outlet>(`/api/c/outlets/${slug}`),
  table: (slug: string, qrUid: string) => req<Table>(`/api/c/outlets/${slug}/tables/${qrUid}`),
  menu: (slug: string) => req<{ categories: MenuCategory[]; items: MenuItem[] }>(`/api/c/outlets/${slug}/menu`),
  upsertCustomer: (outletSlug: string, name: string, phone: string) =>
    req<{ id: string; name: string; phone: string }>(`/api/c/customers`, {
      method: 'POST', body: JSON.stringify({ outletSlug, name, phone }),
    }),
  activeOrder: (tableId: string) => req<ActiveOrder>(`/api/c/orders/active?tableId=${tableId}`),
  submitOrder: (payload: {
    outletSlug: string; tableId: string; customerId: string | null;
    items: { menuItemId: string; qty: number; remark?: string }[];
  }) => req<{ orderId: string; billNo: string | null }>(`/api/c/orders`, {
    method: 'POST', body: JSON.stringify(payload),
  }),
  callWaiter: (outletSlug: string, tableId: string, reason?: string) =>
    req<{ id: string; deduped?: boolean }>(`/api/c/waiter-calls`, {
      method: 'POST', body: JSON.stringify({ outletSlug, tableId, reason }),
    }),
};
