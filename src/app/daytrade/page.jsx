import DaytradeWorkspace from '../../components/daytrade/daytrade-workspace.jsx';
import {currentMember} from '../../membership/server.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'Daytrade Scanner | Nugaom AI Pick'};
export default async function Page({searchParams}){
  const p=await searchParams,member=await currentMember();
  return <DaytradeWorkspace market={['thai','dr','tfex','us','forex'].includes(p.market)?p.market:'thai'} initialSymbol={typeof p.symbol==='string'?p.symbol:null} viewer={member?{displayName:member.display_name,pictureUrl:member.picture_url}:null}/>;
}
