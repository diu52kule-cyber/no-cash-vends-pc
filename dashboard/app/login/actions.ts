'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';

export async function loginAction(_prev: { error: string } | null, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/raasta/manager/orders');

  const supa = await supabaseServer();
  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(next);
}
