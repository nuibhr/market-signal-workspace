import DaytradeWorkspace from '../../components/daytrade/daytrade-workspace.jsx';
import {currentMember} from '../../membership/server.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'US CFD Command Center | Nugaom AI Pick'};
export default async function MarketPage({searchParams}){
 const params=await searchParams;
 const member=await currentMember();
 return <DaytradeWorkspace market="us" initialSymbol={typeof params.symbol==='string'?params.symbol:null} viewer={member?{displayName:member.display_name,pictureUrl:member.picture_url}:null}/>;
}
