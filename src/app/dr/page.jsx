import Workspace from '../../components/workspace.jsx';
export const metadata={title:'DR Strategy Tracker | Nugaom AI Pick'};
export default async function MarketPage({searchParams}){
 const params=await searchParams;
 return <Workspace key="dr" marketId="dr" initialSymbol={typeof params.symbol==='string'?params.symbol:null}/>;
}
