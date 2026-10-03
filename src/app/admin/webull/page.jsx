import { notFound, redirect } from 'next/navigation';
import { currentMember } from '../../../membership/server.mjs';
import { isAdmin } from '../../../membership/store.mjs';
import WebullLab from '../../../components/webull-lab.jsx';
import './webull-lab.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'ห้องทดลองหุ้นสหรัฐฯ | Nugaom AI Pick', robots: { index: false, follow: false } };
export default async function Page() {
  const member = await currentMember();
  if (!member) redirect('/account');
  if (!isAdmin(member)) notFound();
  return <WebullLab />;
}
