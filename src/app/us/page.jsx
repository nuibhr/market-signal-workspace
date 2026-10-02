import Workspace from '../../components/workspace.jsx';
export const metadata={title:'หุ้นสหรัฐฯ | Nugaom AI Pick'};
export default async function MarketPage({searchParams}){
 const params=await searchParams;
 return <Workspace key="us" marketId="us" initialSymbol={typeof params.symbol==='string'?params.symbol:null}/>;
}
