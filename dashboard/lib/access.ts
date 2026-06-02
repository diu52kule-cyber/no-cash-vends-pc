// ── Central role → access map ───────────────────────────────────────
// One place that decides which area each staff role may enter.
// admin  → everything (and the only role that manages credentials)
// manager→ the manager dashboard
// waiter → the waiter screen
// chef   → the Kitchen Display only (kept separate from the rest)

export type Role = 'admin' | 'manager' | 'waiter' | 'chef';
export type Area = 'manager' | 'waiter' | 'kds';

const ACCESS: Record<Role, Area[]> = {
  admin: ['manager', 'waiter', 'kds'],
  manager: ['manager'],
  waiter: ['waiter'],
  chef: ['kds'],
};

export function canAccess(role: Role, area: Area): boolean {
  return (ACCESS[role] ?? []).includes(area);
}

/** Landing path for a role right after login (relative to /[outletSlug]). */
export function roleHome(role: Role): string {
  switch (role) {
    case 'chef': return 'kds';
    case 'waiter': return 'waiter';
    case 'admin':
    case 'manager':
    default: return 'manager/orders';
  }
}

/** Only admins manage logins/credentials. */
export function canManageStaff(role: Role): boolean {
  return role === 'admin';
}
