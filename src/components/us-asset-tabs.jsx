'use client';
import {ChartNoAxesCombined,Layers3} from 'lucide-react';
import {US_STOCKS,US_ETFS} from '../markets/catalog.mjs';
export default function UsAssetTabs({value,onChange,showAll=false}){
  return <nav className="us-asset-tabs" aria-label="แยกหุ้นและ ETF">
    {showAll&&<button aria-pressed={value==='all'} onClick={()=>onChange('all')}>ทั้งหมด</button>}
    <button aria-pressed={value==='stock'} onClick={()=>onChange('stock')}><ChartNoAxesCombined size={18}/>หุ้น <b>{US_STOCKS.length}</b></button>
    <button aria-pressed={value==='etf'} onClick={()=>onChange('etf')}><Layers3 size={18}/>ETF <b>{US_ETFS.length}</b></button>
  </nav>;
}
