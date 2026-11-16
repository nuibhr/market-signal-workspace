import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Thai Dividend Portfolio Radar | Nugaom AI Pick',
  description: 'SETHD High Dividend Strategy, XD Calendar, and Disciplined 5-Tier Allocation Model.',
};

export default async function ThaiDividendPage({ searchParams }) {
  const params = await searchParams;
  const symbol = typeof params?.symbol === 'string' ? `?symbol=${encodeURIComponent(params.symbol)}` : '';
  redirect(`/thai${symbol}`);
}
