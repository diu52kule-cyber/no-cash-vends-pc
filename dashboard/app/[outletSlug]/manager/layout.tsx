import { redirect, notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import { Sidebar } from '@/components/Sidebar';
import type { Outlet, Staff } from '@/lib/types';

export default async function ManagerLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ outletSlug: string }> }) {
  const { outletSlug } = await params;
  const supa = await supabaseServer();

  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect(`/login?next=/${outletSlug}/manager/orders`);

  const { data: outlet } = await supa.from('outlets').select('*').eq('slug', outletSlug).maybeSingle();
  if (!outlet) notFound();

  const { data: staff } = await supa.from('staff')
    .select('*').eq('auth_user_id', user.id).eq('outlet_id', (outlet as Outlet).id).maybeSingle();
  if (!staff) {
    return (
      <div className="login-bg">
        <div className="login-card">
          <h1>Not authorised</h1>
          <p className="sub">Your account is signed in, but isn't linked to <b>{(outlet as Outlet).name}</b>. Ask an admin to add you to the staff list.</p>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost" style={{ marginTop: 12 }}>Sign out</button></form>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <Sidebar outlet={outlet as Outlet} staff={staff as Staff} />
      <main className="content">{children}</main>
    </div>
  );
}
