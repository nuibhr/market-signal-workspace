import Workspace from '../../components/workspace.jsx';
export const metadata={title:'Forex | Nugaom AI Pick'};
export default async function MarketPage({searchParams}){
 const params=await searchParams;
 return <Workspace key="forex" marketId="forex" initialSymbol={typeof params.symbol==='string'?params.symbol:null}/>;
}
