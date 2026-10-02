import Workspace from '../../components/workspace.jsx';
export const metadata={title:'TFEX | Nugaom AI Pick'};
export default async function MarketPage({searchParams}){
 const params=await searchParams;
 return <Workspace key="tfex" marketId="tfex" initialSymbol={typeof params.symbol==='string'?params.symbol:null}/>;
}
