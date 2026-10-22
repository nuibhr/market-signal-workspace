import Workspace from '../../components/workspace.jsx';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'US Stocks & Global ETFs | Nugaom AI Pick' };
export default async function MarketPage({ searchParams }) {
  const params = await searchParams;
  const initialSymbol = typeof params.symbol === 'string' ? params.symbol : null;
  return <Workspace key="us" marketId="us" initialSymbol={initialSymbol} />;
}
