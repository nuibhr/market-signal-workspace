import { currentMember } from '../../membership/server.mjs';
import { isAdmin, getBrokerStaffRole } from '../../membership/store.mjs';
import { getAffiliateProfile } from '../../membership/affiliates.mjs';
import AdminConsole from '../../components/admin-console.jsx';
import AdminLoginCard from '../../components/admin/admin-login-card.jsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'หลังบ้านผู้ดูแล | Nugaom AI Pick', robots: { index: false, follow: false } };

export default async function Page() {
  const member = await currentMember();
  const brokerRole = getBrokerStaffRole(member);
  const affProfile = await getAffiliateProfile(member);
  const activeAffiliate = affProfile?.status === 'active' ? affProfile : null;
  if (!member || (!isAdmin(member) && !brokerRole && !activeAffiliate)) {
    return <AdminLoginCard />;
  }
  return <AdminConsole initialBrokerRole={brokerRole} initialAffiliateOnly={Boolean(!isAdmin(member) && !brokerRole && activeAffiliate)} />;
}
