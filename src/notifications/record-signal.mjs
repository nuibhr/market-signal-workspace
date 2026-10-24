export function recordSignal(trade){
 const p=trade?.plan;
 if(!trade||!['LONG','SHORT'].includes(trade.side)||typeof trade.symbol!=='string'||![p?.entry,p?.stop,p?.target].every(v=>Number.isFinite(v)&&v>0))throw Error('CURRENT_SIGNAL_REQUIRED');
 return {symbol:trade.symbol,side:trade.side,signalTime:trade.signalTime,...(trade.atr===undefined?{}:{atr:trade.atr}),plan:{...p}};
}
