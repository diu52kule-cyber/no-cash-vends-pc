import { redirect } from 'next/navigation';

export default async function ManagerHome({ params }: { params: Promise<{ outletSlug: string }> }) {
  const { outletSlug } = await params;
  redirect(`/${outletSlug}/manager/orders`);
}
