import { redirect, notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import { canAccess, roleHome, type Role } from '@/lib/access';
import type { Outlet, Staff } from '@/lib/types';

export default async function KdsLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ outletSlug: string }> }) {
  const { outletSlug } = await params;
  const supa = await supabaseServer();

  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect(`/login?next=/${outletSlug}/kds`);

  const { data: outlet } = await supa.from('outlets').select('*').eq('slug', outletSlug).maybeSingle();
  if (!outlet) notFound();

  const { data: staff } = await supa.from('staff')
    .select('*').eq('auth_user_id', user.id).eq('outlet_id', (outlet as Outlet).id).maybeSingle();
  if (!staff || !(staff as Staff).active) {
    return (
      <div className="login-bg">
        <div className="login-card">
          <h1>Not authorised</h1>
          <p className="sub">You aren't on staff at {(outlet as Outlet).name}.</p>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost" style={{ marginTop: 12 }}>Sign out</button></form>
        </div>
      </div>
    );
  }

  const role = (staff as Staff).role as Role;
  if (!canAccess(role, 'kds')) redirect(`/${outletSlug}/${roleHome(role)}`);

  return <div className="kds-root" data-staff={(staff as Staff).name}>{children}</div>;
}
