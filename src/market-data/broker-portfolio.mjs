import {createSettradeClient} from './settrade.mjs';
const fail=code=>Object.assign(new Error(code),{code});
const number=(o,keys)=>{for(const k of keys){if(o?.[k]!==null&&o?.[k]!==''&&o?.[k]!==undefined&&Number.isFinite(Number(o[k])))return Number(o[k]);}return null;};
const object=value=>value?.data&&!Array.isArray(value.data)?value.data:value;
export function normalizeBrokerPortfolio(market,accountRaw,portfolioRaw){
 const account=object(accountRaw),p=object(portfolioRaw);
 const rows=Array.isArray(portfolioRaw)?portfolioRaw:Array.isArray(portfolioRaw?.data)?portfolioRaw.data:p?.portfolios||p?.portfolioList||p?.securities||p?.positions||p?.portfolio;
 if(!Array.isArray(rows))throw fail('PORTFOLIO_SCHEMA_UNSUPPORTED');
 const equity=number(account,['equity','totalAsset','totalAssets','totalEquity','netAssetValue']);
 if(equity===null)throw fail('ACCOUNT_EQUITY_UNAVAILABLE');
 const cashBalance=number(account,['cashBalance','cash','cashAvailable','cashBalanceAvailable']);
 if(market==='TFEX'){
  const positions=[];
  for(const row of rows){
   const symbol=String(row.symbol||row.symbolName||'').toUpperCase();if(!/^[A-Z0-9._-]{1,32}$/.test(symbol))throw fail('PORTFOLIO_SCHEMA_UNSUPPORTED');
   const product=/^S50/.test(symbol)?'S50':/^SVF/.test(symbol)?'SVF':/^GO/.test(symbol)?'GO':/^USD/.test(symbol)?'USD':null;
   if(!product)throw fail('UNSUPPORTED_PORTFOLIO_PRODUCT');
   const long=number(row,['actualLongPosition','longPosition','longVolume','longQty']),short=number(row,['actualShortPosition','shortPosition','shortVolume','shortQty']);
   const direct=number(row,['contracts','volume','position']),side=String(row.side||'').toUpperCase();
   const parts=long!==null||short!==null?[['LONG',long||0],['SHORT',short||0]]:[[side,direct]];
   for(const [positionSide,contracts] of parts){
    if(contracts===0)continue;if(!['LONG','SHORT'].includes(positionSide)||!Number.isSafeInteger(contracts)||contracts<0)throw fail('PORTFOLIO_SCHEMA_UNSUPPORTED');
    positions.push({symbol,product,side:positionSide,contracts,entryPrice:number(row,positionSide==='LONG'?['longAveragePrice','longAvgPrice','averagePrice','avgPrice','entryPrice']:['shortAveragePrice','shortAvgPrice','averagePrice','avgPrice','entryPrice']),marketPrice:number(row,['marketPrice','lastPrice','price']),unrealizedPl:number(row,['unrealizedPL','unrealizedPl','unrealizedProfit'])});
   }
  }
  const totalIm=number(account,['totalInitialMargin','initialMargin','totalMargin','marginRequirement','totalIm']);
  const totalMm=number(account,['totalMaintenanceMargin','maintenanceMargin','totalMm']),totalFm=number(account,['totalForceMargin','forceMargin','totalFm']);
  return {equity,cashBalance,positions,totalIm,totalMm,totalFm,totalUnrealizedPl:number(account,['unrealizedPL','unrealizedPl','unrealizedProfit']),excessEquity:number(account,['excessEquity','excessMargin']),marginUsagePct:totalIm!==null&&equity>0?(totalIm/equity*100).toFixed(1):null};
 }
 const holdings=rows.map(row=>{
  const symbol=String(row.symbol||row.symbolName||'').toUpperCase(),quantity=number(row,['actualVolume','currentVolume','availableVolume','volume','quantity','qty']);
  if(!/^[A-Z0-9._-]{1,32}$/.test(symbol)||quantity===null||quantity<0)throw fail('PORTFOLIO_SCHEMA_UNSUPPORTED');
  const avgCost=number(row,['averagePrice','avgPrice','averageCost','avgCost']),marketPrice=number(row,['marketPrice','lastPrice','price']);
  const marketValue=number(row,['marketValue'])??(marketPrice===null?null:quantity*marketPrice),costValue=number(row,['costValue'])??(avgCost===null?null:quantity*avgCost);
  return {symbol,quantity,avgCost,marketPrice,marketValue,costValue,unrealizedPl:number(row,['unrealizedPL','unrealizedPl'])??(marketValue!==null&&costValue!==null?marketValue-costValue:null),unrealizedPlPct:number(row,['unrealizedPLPercent','unrealizedPlPercent']),market:/\d{2,4}$/.test(symbol)?'DR':'THAI',sector:'—',stage:null,stageName:'รอประเมินจากข้อมูลราคา',action:'ตรวจแผนจากกราฟ',actionNote:'ข้อมูลพอร์ตจากโบรกเกอร์',trailingStop:null,cutLossPrice:null};
 }).filter(h=>h.quantity>0);
 const totalMarketValue=holdings.every(h=>h.marketValue!==null)?holdings.reduce((s,h)=>s+h.marketValue,0):null,totalCostValue=holdings.every(h=>h.costValue!==null)?holdings.reduce((s,h)=>s+h.costValue,0):null;
 const groupValue=market=>{const group=holdings.filter(h=>h.market===market);return group.every(h=>h.marketValue!==null)?group.reduce((sum,h)=>sum+h.marketValue,0):null;};
 const thaiStockValue=groupValue('THAI'),drStockValue=groupValue('DR');
 return {equity,cashBalance,lineAvailable:number(account,['lineAvailable','creditAvailable']),holdings,totalMarketValue,totalCostValue,totalUnrealizedPl:totalMarketValue!==null&&totalCostValue!==null?totalMarketValue-totalCostValue:null,totalUnrealizedPlPct:totalCostValue>0?(totalMarketValue/totalCostValue-1)*100:null,allocation:{thaiStockValue,drStockValue,cashBalance,thaiStockPct:totalMarketValue===null||thaiStockValue===null?null:totalMarketValue>0?thaiStockValue/totalMarketValue*100:0,drStockPct:totalMarketValue===null||drStockValue===null?null:totalMarketValue>0?drStockValue/totalMarketValue*100:0,cashPct:equity>0&&cashBalance!==null?cashBalance/equity*100:null},health:{score:null,grade:'รอข้อมูลราคา',stage2RatioPct:null,stage4DangerRatioPct:null},fxEnvironment:{usdThb:null,impactSummary:'รอข้อมูลอัตราแลกเปลี่ยน'}};
}
export async function readBrokerPortfolio(market,body,{fetcher=fetch}={}){
 const {brokerId,appId,appSecret,appCode,accountNo}=body;
 if(!['SET','TFEX'].includes(market)||!/^\d{3}$/.test(brokerId||'')||![appId,appSecret,appCode,accountNo].every(v=>typeof v==='string'&&v.length>0&&v.length<4096)||!/^[-A-Za-z0-9]{3,40}$/.test(accountNo))throw fail('ACCOUNT_AND_CREDENTIALS_REQUIRED');
 const client=createSettradeClient({env:{SETTRADE_BROKER_ID:brokerId,SETTRADE_APP_CODE:appCode,BROKER_APP_ID:appId,BROKER_API_SECRET:appSecret},fetcher});
 const token=await client.login(),service=market==='TFEX'?'seosd':'seos';
 const base='https://open-api.settrade.com/api/'+service+'/v3/'+brokerId+'/accounts/'+encodeURIComponent(accountNo);
 async function read(suffix){
  const r=await fetcher(base+'/'+suffix,{headers:{Accept:'application/json',Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000),cache:'no-store'});
  if(!r.ok)throw fail(r.status===401||r.status===403?'BROKER_PERMISSION_DENIED':r.status===429?'BROKER_RATE_LIMITED':'BROKER_SOURCE_UNAVAILABLE');
  try{return await r.json();}catch{throw fail('BROKER_INVALID_RESPONSE');}
 }
 const [info,portfolio]=await Promise.all([read('account-info'),read('portfolios')]);
 return {success:true,mode:'LIVE',brokerId,accountNo:'••'+accountNo.slice(-4),appCode,asOf:new Date().toISOString(),source:'Settrade Open API',...normalizeBrokerPortfolio(market,info,portfolio),notice:'อ่านข้อมูลจากโบรกเกอร์สำเร็จ · ไม่บันทึก API key หรือเลขบัญชีเต็ม'};
}
