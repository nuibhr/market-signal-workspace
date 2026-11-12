import { redirect } from 'next/navigation';

export const metadata = {
  title: 'DR Strategy Tracker | Nugaom AI Pick',
  description: 'Nugaom AI Proprietary Quantitative Multi-Factor Radar and Indicative Arbitrage Bridge.',
};

export default async function DrStrategyPage({ searchParams }) {
  const params = await searchParams;
  const symbol = typeof params?.symbol === 'string' ? `?symbol=${encodeURIComponent(params.symbol)}` : '';
  redirect(`/dr${symbol}`);
}
