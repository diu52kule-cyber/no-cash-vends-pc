'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import { roleHome, type Role } from '@/lib/access';

export async function loginAction(_prev: { error: string } | null, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/raasta/manager/orders');

  const supa = await supabaseServer();
  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  // Send each role to the area it's allowed into.
  const slug = next.match(/^\/([^/]+)\//)?.[1] ?? 'raasta';
  let dest = `/${slug}/manager/orders`;
  const { data: { user } } = await supa.auth.getUser();
  if (user) {
    const { data: outlet } = await supa.from('outlets').select('id').eq('slug', slug).maybeSingle();
    if (outlet) {
      const { data: staff } = await supa.from('staff')
        .select('role').eq('auth_user_id', user.id).eq('outlet_id', outlet.id).maybeSingle();
      if (staff?.role) dest = `/${slug}/${roleHome(staff.role as Role)}`;
    }
  }
  redirect(dest);
}
