import { redirect } from 'next/navigation';
import { currentMember } from '../../membership/server.mjs';
import { isAdmin } from '../../membership/store.mjs';
import CoachHub from '../../components/coach-dashboard.jsx';
import CoachPageShell from '../../components/coach-page-shell.jsx';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'จัดการพอร์ตจำลองของโค้ช (สำหรับแอดมิน) | Nugaom AI Pick',robots:{index:false,follow:false}};
export default async function Page(){
  const member = await currentMember();
  if(!isAdmin(member)) redirect('/account');
  return <CoachPageShell management><CoachHub mode="admin"/></CoachPageShell>;
}
