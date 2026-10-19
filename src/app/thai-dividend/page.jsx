import Workspace from '../../components/workspace.jsx';

export const metadata = {
  title: 'Thai Dividend Portfolio Radar | Nugaom AI Pick',
  description: 'SETHD High Dividend Strategy, XD Calendar, and Disciplined 5-Tier Allocation Model.',
};

export default async function ThaiDividendPage({ searchParams }) {
  const params = await searchParams;
  return (
    <Workspace
      key="thai-dividend"
      marketId="dr"
      initialSymbol={typeof params.symbol === 'string' ? params.symbol : 'AAPL80'}
    />
  );
}
