import Workspace from '../../components/workspace.jsx';
import {daytradeRuntime} from '../../daytrade/runtime.mjs';
import DaytradeWorkspace from '../../components/daytrade/daytrade-workspace.jsx';
import {currentMember} from '../../membership/server.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'US Markets | Nugaom AI Pick'};
export default async function MarketPage({searchParams}){
 const params=await searchParams;
 const initialSymbol=typeof params.symbol==='string'?params.symbol:null;
 if(!daytradeRuntime('us').enabled)return <Workspace marketId="us" initialSymbol={initialSymbol}/>;
 const member=await currentMember();
 return <DaytradeWorkspace market="us" initialSymbol={typeof params.symbol==='string'?params.symbol:null} viewer={member?{displayName:member.display_name,pictureUrl:member.picture_url}:null}/>;
}
