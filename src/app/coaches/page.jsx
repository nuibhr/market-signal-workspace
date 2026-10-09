import CoachHub from '../../components/coach-dashboard.jsx';
import CoachPageShell from '../../components/coach-page-shell.jsx';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'พอร์ตจำลองของโค้ช | Nugaom AI Pick'};
export default function Page(){return <CoachPageShell><CoachHub/></CoachPageShell>;}
