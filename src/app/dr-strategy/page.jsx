import Workspace from '../../components/workspace.jsx';

export const metadata = {
  title: 'DR Strategy Tracker & Thai Dividend Radar | Nugaom AI Pick',
  description: 'Camarilla Pivot 8 Levels, EMA 25/50/75, Indicative Arbitrage Bridge, and Thai Dividend Portfolio.',
};

export default async function DrStrategyPage({ searchParams }) {
  const params = await searchParams;
  return (
    <Workspace
      key="dr"
      marketId="dr"
      initialSymbol={typeof params.symbol === 'string' ? params.symbol : 'AAPL80'}
    />
  );
}
