import { redirect } from 'next/navigation';
import { currentMember } from '../../membership/server.mjs';
import CommunityShell from '../../components/community-shell.jsx';
import CommunityHub from '../../components/community-hub.jsx';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'Community | Nugaom AI Pick',robots:{index:false,follow:false}};
export default async function Page(){if(!await currentMember())redirect('/account');return <CommunityShell><CommunityHub/></CommunityShell>;}
