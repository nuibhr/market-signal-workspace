import { redirect, notFound } from 'next/navigation';
import { currentMember } from '../../membership/server.mjs';
import { communityAccess } from '../../community/store.mjs';
import CommunityShell from '../../components/community-shell.jsx';
import CommunityHub from '../../components/community-hub.jsx';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'กล่องงานทีม | Nugaom AI Pick',robots:{index:false,follow:false}};
export default async function Page(){const actor=await currentMember();if(!actor)redirect('/account');const access=await communityAccess(actor);if(!access.admin&&!access.roles.length)notFound();return <CommunityShell team><CommunityHub team/></CommunityShell>;}
