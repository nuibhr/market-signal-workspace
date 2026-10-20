/** Position estimates use explicit costs and buying-power assumptions. */
export function calculatePositionSize({market='thai',capital=100000,riskPercent=1,side='long',entryPrice=100,stopLossPrice=95,targetMultiple=2}={}) {
  const [cap,riskPct,entry,sl,mult]=[capital,riskPercent,entryPrice,stopLossPrice,targetMultiple].map(Number);
  const invalid=error=>({isValid:false,error,riskAmount:0,positionSize:0});
  if(![cap,riskPct,entry,sl,mult].every(Number.isFinite)||cap<=0||entry<=0||sl<=0||riskPct<=0||riskPct>100||mult<=0)
    return invalid('ทุน ราคาเข้า Stop Loss และความเสี่ยงต้องมากกว่า 0 และเป็นตัวเลขจำกัด');
  if(!['thai','tfex','us','forex','gold'].includes(market)||!['long','short'].includes(side))return invalid('ตลาดหรือฝั่งซื้อขายไม่ถูกต้อง');
  if(side==='long'&&sl>=entry)return invalid('ฝั่ง Long: Stop Loss ต้องต่ำกว่าราคาเข้า');
  if(side==='short'&&sl<=entry)return invalid('ฝั่ง Short: Stop Loss ต้องสูงกว่าราคาเข้า');
  const distance=Math.abs(entry-sl),riskAmount=cap*riskPct/100;
  const target=side==='long'?entry+distance*mult:entry-distance*mult;
  if(target<=0)return invalid('ราคาเป้าหมายต้องมากกว่า 0');
  let step=1,pointValue=1,marginPerUnit=entry,cashPerUnit=entry,unitLabel='หุ้น',feeRate=0;
  if(market==='thai'){step=100;feeRate=0.00157;cashPerUnit=entry*(1+feeRate);marginPerUnit=cashPerUnit;}
  if(market==='us')step=0.01;
  if(market==='tfex'){pointValue=200;marginPerUnit=15500;cashPerUnit=marginPerUnit;unitLabel='สัญญา';}
  if(market==='gold'){step=0.01;pointValue=100;marginPerUnit=entry;cashPerUnit=marginPerUnit;unitLabel='Lots';}
  if(market==='forex'){step=0.01;pointValue=100000;marginPerUnit=1000;cashPerUnit=marginPerUnit;unitLabel='Lots';}
  const lossPerUnit=distance*pointValue+(entry+sl)*feeRate;
  const gainPerUnit=distance*mult*pointValue-(entry+target)*feeRate;
  const raw=Math.min(riskAmount/lossPerUnit,cap/cashPerUnit);
  const units=Number((Math.floor(raw/step)*step).toFixed(8));
  const loss=units*lossPerUnit,gain=units*gainPerUnit;
  const round=n=>Math.round(n*100)/100;
  return {isValid:true,market,side,capital:cap,riskPercent:riskPct,riskAmount:round(riskAmount),
    entryPrice:entry,stopLossPrice:sl,stopDistance:Math.round(distance*1000)/1000,stopPercent:round(distance/entry*100),
    targetPrice:Math.round(target*1000)/1000,targetMultiple:mult,riskRewardRatio:`1:${loss>0?(gain/loss).toFixed(2):'0'}`,
    units,unitLabel,positionValue:round(units*entry*pointValue),marginRequired:round(units*marginPerUnit),
    expectedLoss:round(loss),expectedGain:round(gain),costBasis:market==='thai'?'estimated-0.157-percent-per-side':'before-fees-and-slippage',
    marginBasis:['forex','gold'].includes(market)?'assumed-1:100':market==='tfex'?'assumed-15500-per-contract':'cash-including-estimated-buy-fees'};
}
