import { notFound, redirect } from 'next/navigation';
import { currentMember } from '../../membership/server.mjs';
import { isAdmin } from '../../membership/store.mjs';
import AdminPage from '../../components/admin-page.jsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'หลังบ้านผู้ดูแล | Nugaom AI Pick', robots: { index: false, follow: false } };

export default async function Page() {
  const member = await currentMember();
  if (!member) redirect('/account');
  if (!isAdmin(member)) notFound();
  return <AdminPage />;
}
