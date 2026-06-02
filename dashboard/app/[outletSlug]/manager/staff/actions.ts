'use server';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Role } from '@/lib/access';

const ROLES: Role[] = ['admin', 'manager', 'waiter', 'chef'];

/** Verify the caller is an admin of this outlet; returns the outlet id. */
async function requireAdmin(slug: string): Promise<string> {
  const supa = await supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data: outlet } = await supa.from('outlets').select('id').eq('slug', slug).single();
  if (!outlet) throw new Error('Outlet not found');
  const { data: me } = await supa.from('staff')
    .select('role').eq('auth_user_id', user.id).eq('outlet_id', outlet.id).maybeSingle();
  if (me?.role !== 'admin') throw new Error('Admins only');
  return outlet.id as string;
}

export async function createStaff(
  slug: string,
  input: { name: string; email: string; password: string; role: Role },
): Promise<{ error?: string }> {
  let outletId: string;
  try { outletId = await requireAdmin(slug); } catch (e) { return { error: (e as Error).message }; }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !email || !input.password) return { error: 'Name, email and password are required.' };
  if (input.password.length < 6) return { error: 'Password must be at least 6 characters.' };
  if (!ROLES.includes(input.role)) return { error: 'Invalid role.' };

  const admin = supabaseAdmin();
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: input.password, email_confirm: true,
  });
  if (error || !created.user) return { error: error?.message ?? 'Could not create login.' };

  const { error: e2 } = await admin.from('staff').insert({
    outlet_id: outletId, auth_user_id: created.user.id, name, role: input.role, email, active: true,
  });
  if (e2) {
    await admin.auth.admin.deleteUser(created.user.id); // rollback the orphan login
    return { error: e2.message };
  }
  revalidatePath(`/${slug}/manager/staff`);
  return {};
}

export async function setStaffRole(slug: string, staffId: string, role: Role): Promise<{ error?: string }> {
  let outletId: string;
  try { outletId = await requireAdmin(slug); } catch (e) { return { error: (e as Error).message }; }
  if (!ROLES.includes(role)) return { error: 'Invalid role.' };
  const admin = supabaseAdmin();
  const { error } = await admin.from('staff').update({ role }).eq('id', staffId).eq('outlet_id', outletId);
  if (error) return { error: error.message };
  revalidatePath(`/${slug}/manager/staff`);
  return {};
}

export async function setStaffActive(slug: string, staffId: string, active: boolean): Promise<{ error?: string }> {
  let outletId: string;
  try { outletId = await requireAdmin(slug); } catch (e) { return { error: (e as Error).message }; }
  const admin = supabaseAdmin();
  const { error } = await admin.from('staff').update({ active }).eq('id', staffId).eq('outlet_id', outletId);
  if (error) return { error: error.message };
  revalidatePath(`/${slug}/manager/staff`);
  return {};
}

export async function deleteStaff(slug: string, staffId: string): Promise<{ error?: string }> {
  let outletId: string;
  try { outletId = await requireAdmin(slug); } catch (e) { return { error: (e as Error).message }; }
  const admin = supabaseAdmin();

  // guard: never let an admin delete themselves, and keep at least one admin
  const supa = await supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  const { data: target } = await admin.from('staff')
    .select('auth_user_id, role').eq('id', staffId).eq('outlet_id', outletId).maybeSingle();
  if (!target) return { error: 'Staff not found.' };
  if (target.auth_user_id && target.auth_user_id === user?.id) return { error: "You can't delete your own account." };
  if (target.role === 'admin') {
    const { count } = await admin.from('staff')
      .select('id', { count: 'exact', head: true }).eq('outlet_id', outletId).eq('role', 'admin');
    if ((count ?? 0) <= 1) return { error: 'Cannot delete the last admin.' };
  }

  const { error } = await admin.from('staff').delete().eq('id', staffId).eq('outlet_id', outletId);
  if (error) return { error: error.message };
  if (target.auth_user_id) await admin.auth.admin.deleteUser(target.auth_user_id);
  revalidatePath(`/${slug}/manager/staff`);
  return {};
}
