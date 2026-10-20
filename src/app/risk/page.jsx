import RiskPage from '../../components/risk/risk-page.jsx';

export const metadata = {
  title: 'Risk & Position Manager — คำนวณขนาดไม้และคุมความเสี่ยงทุกตลาด | Nugaom',
  description: 'คำนวณขนาดออเดอร์ (Position Size), Stop Loss, และ 2R Target อัตโนมัติสำหรับหุ้นไทย, TFEX SET50, หุ้นสหรัฐฯ, ทองคำ และ Forex',
};

export default function Page() {
  return <RiskPage />;
}
