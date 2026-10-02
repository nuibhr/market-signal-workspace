import Workspace from '../../components/workspace.jsx';
export const metadata={title:'หุ้นไทย | Nugaom AI Pick'};
export default async function MarketPage({searchParams}){
 const params=await searchParams;
 return <Workspace key="thai" marketId="thai" initialSymbol={typeof params.symbol==='string'?params.symbol:null}/>;
}
