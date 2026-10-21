import DaytradeWorkspace from '../../components/daytrade/daytrade-workspace.jsx';
import {currentMember} from '../../membership/server.mjs';
import {redirect} from 'next/navigation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'Daytrade Scanner | Nugaom AI Pick'};
export default async function Page({searchParams}){
  const p=await searchParams;
  const market=['thai','dr','tfex','us','forex'].includes(p.market)?p.market:'thai';
  if(['thai','dr'].includes(market))redirect(`/${market}${typeof p.symbol==='string'?`?symbol=${encodeURIComponent(p.symbol)}`:''}`);
  const member=await currentMember();
  return <DaytradeWorkspace market={['thai','dr','tfex','us','forex'].includes(p.market)?p.market:'thai'} initialSymbol={typeof p.symbol==='string'?p.symbol:null} viewer={member?{displayName:member.display_name,pictureUrl:member.picture_url}:null}/>;
}
