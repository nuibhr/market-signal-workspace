import MarketLobby from '../../components/market-lobby.jsx';
import '../market-pages.css';

export const metadata = {
  title: 'เลือกตลาดลงทุน | Nugaom AI Pick',
  description: 'ศูนย์รวม 5 ตลาด หุ้นไทย, DR, TFEX, US CFD และ Forex พร้อมสรุปสถานะและความสดของข้อมูล',
};

export default function MarketsPage() { return <MarketLobby />; }
