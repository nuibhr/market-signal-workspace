import { redirect } from 'next/navigation';
import { currentMember } from '../../membership/server.mjs';
import CoachHub from '../../components/coach-dashboard.jsx';
import CoachPageShell from '../../components/coach-page-shell.jsx';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'จัดการพอร์ตจำลองของโค้ช | Nugaom AI Pick',robots:{index:false,follow:false}};
export default async function Page(){
  if(!await currentMember())redirect('/account');
  return <CoachPageShell management><CoachHub mode="own"/></CoachPageShell>;
}
