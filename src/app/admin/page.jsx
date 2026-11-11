import { notFound, redirect } from 'next/navigation';
import { currentMember } from '../../membership/server.mjs';
import { isAdmin, getBrokerStaffRole } from '../../membership/store.mjs';
import AdminConsole from '../../components/admin-console.jsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'หลังบ้านผู้ดูแล | Nugaom AI Pick', robots: { index: false, follow: false } };

export default async function Page() {
  const member = await currentMember();
  if (!member) redirect('/account');
  const brokerRole = getBrokerStaffRole(member);
  if (!isAdmin(member) && !brokerRole) notFound();
  return <AdminConsole initialBrokerRole={brokerRole} />;
}
