import { currentMember } from '../../membership/server.mjs';
import { isAdmin, getBrokerStaffRole } from '../../membership/store.mjs';
import AdminConsole from '../../components/admin-console.jsx';
import AdminLoginCard from '../../components/admin/admin-login-card.jsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'หลังบ้านผู้ดูแล | Nugaom AI Pick', robots: { index: false, follow: false } };

export default async function Page() {
  const member = await currentMember();
  const brokerRole = getBrokerStaffRole(member);
  if (!member || (!isAdmin(member) && !brokerRole)) {
    return <AdminLoginCard />;
  }
  return <AdminConsole initialBrokerRole={brokerRole} />;
}
