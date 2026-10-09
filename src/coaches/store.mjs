import { createHash, randomUUID } from 'node:crypto';
import { storage, operation } from '../storage/database.mjs';
import { isAdmin } from '../membership/store.mjs';
import { RequestError } from '../security/request-guard.mjs';

const fail=(code,status=400)=>{throw new RequestError(code,status);};
const id=value=>typeof value==='string'&&/^[-_a-zA-Z0-9]{16,100}$/.test(value);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function text(value,max,required=false){
  if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value))fail('INVALID_COACH_INPUT');
  const result=value.trim();if(required&&!result)fail('INVALID_COACH_INPUT');return result;
}
function scaled(value,scale,max,positive=false){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max||(positive&&value===0))fail('INVALID_COACH_INPUT');
  const n=Math.round(value*scale);
  if(!Number.isSafeInteger(n)||Math.abs(value*scale-n)>0.0001||(positive&&n===0))fail('INVALID_COACH_INPUT');
  return n;
}
// Round each fill to the currency's minor unit, without floating-point multiplication.
const gross=(micro,quantity)=>Number((BigInt(micro)*BigInt(quantity)+5000n)/10000n);
const visible=p=>p.published===1&&p.active===1;
function safePortfolio(p){return {id:p.id,name:p.name,currency:p.currency,initialCapital:p.initial_minor/100,cash:p.cash_minor/100,published:!!p.published,active:!!p.active,createdAt:p.created_at,updatedAt:p.updated_at,mode:'paper'};}
async function load(idValue){if(!id(idValue))fail('COACH_NOT_FOUND',404);const p=await storage.first('SELECT * FROM coach_portfolios WHERE id=?',idValue);if(!p)fail('COACH_NOT_FOUND',404);return p;}
function manage(actor,p){if(!actor||(!isAdmin(actor)&&actor.id!==p.owner_id))fail('FORBIDDEN',403);}
async function replay(actor,operationId,payloadHash){
  const previous=await storage.first('SELECT * FROM coach_operations WHERE id=?',operationId);
  if(!previous)return null;
  if(previous.actor_id!==actor.id||previous.payload_hash!==payloadHash)fail('OPERATION_CONFLICT',409);
  return {ok:true,portfolioId:previous.portfolio_id,tradeId:previous.trade_id,replayed:true};
}

export async function listPortfolios(actor,{admin=false,page=1,own=false}={}){
  if(admin&&!isAdmin(actor))fail('FORBIDDEN',403);
  if(own&&!actor)fail('FORBIDDEN',403);
  const where=admin?'1=1':own?'p.owner_id=?':'p.published=1 AND p.active=1';
  const params=own&&!admin?[actor.id]:[];
  const total=(await storage.first(`SELECT COUNT(*) AS n FROM coach_portfolios p WHERE ${where}`,...params)).n;
  const current=Math.max(1,Math.min(Math.ceil(total/7)||1,Math.floor(Number(page)||1)));
  const rows=await storage.all(`SELECT p.*,m.display_name,m.picture_url FROM coach_portfolios p JOIN members m ON m.id=p.owner_id WHERE ${where} ORDER BY p.created_at DESC,p.id LIMIT 7 OFFSET ?`,...params,(current-1)*7);
  return {portfolios:rows.map(p=>({...safePortfolio(p),coachName:p.display_name,pictureUrl:p.picture_url})),total,page:current,pageSize:7};
}
export async function portfolioDetail(actor,portfolioId,{page=1,filter='all',management=false}={}){
  const p=await load(portfolioId);
  if(management)manage(actor,p);else if(!visible(p))fail('COACH_NOT_FOUND',404);
  const where=filter==='open'?'AND closed_at IS NULL':filter==='closed'?'AND closed_at IS NOT NULL':'';
  const requested=Math.max(1,Math.min(1000000,Math.floor(Number(page)||1)));
  // One transactional read keeps cash, open positions and realized statistics consistent.
  const snapshot=await storage.batch([
    operation(`SELECT p.*,m.display_name,m.picture_url FROM coach_portfolios p JOIN members m ON m.id=p.owner_id WHERE p.id=? ${management?'':'AND p.published=1 AND p.active=1'}`,p.id),
    operation(`SELECT COUNT(*) AS entered,
      SUM(CASE WHEN closed_at IS NULL THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN closed_at IS NOT NULL THEN 1 ELSE 0 END) AS closed,
      SUM(CASE WHEN pnl_minor>0 THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN pnl_minor<0 THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN pnl_minor=0 THEN 1 ELSE 0 END) AS flat,
      COALESCE(SUM(pnl_minor),0) AS realized,
      COALESCE(SUM(CASE WHEN closed_at IS NULL THEN cost_minor ELSE 0 END),0) AS committed,
      COALESCE(SUM(entry_fee_minor+COALESCE(exit_fee_minor,0)),0) AS fees
      FROM coach_trades WHERE portfolio_id=?`,p.id),
    operation(`SELECT COUNT(*) AS n FROM coach_trades WHERE portfolio_id=? ${where}`,p.id),
    operation(`SELECT * FROM coach_trades WHERE portfolio_id=? ${where} ORDER BY opened_at DESC,id DESC LIMIT 7
      OFFSET (SELECT MIN(?,MAX(0,CAST((COUNT(*)-1)/7 AS INTEGER))*7) FROM coach_trades WHERE portfolio_id=? ${where})`,p.id,(requested-1)*7,p.id),
  ]);
  const account=snapshot[0].results[0];if(!account)fail('COACH_NOT_FOUND',404);
  const totals=snapshot[1].results[0],total=snapshot[2].results[0].n,rows=snapshot[3].results;
  const current=Math.max(1,Math.min(Math.ceil(total/7)||1,requested));
  const trades=rows.map(t=>({id:t.id,symbol:t.symbol,market:t.market,quantity:t.quantity,entryPrice:t.entry_micro/1e6,entryFee:t.entry_fee_minor/100,cost:t.cost_minor/100,entryNote:t.entry_note,openedAt:t.opened_at,exitPrice:t.exit_micro===null?null:t.exit_micro/1e6,exitFee:t.exit_fee_minor===null?null:t.exit_fee_minor/100,exitNote:t.exit_note,closedAt:t.closed_at,pnl:t.pnl_minor===null?null:t.pnl_minor/100}));
  const closed=totals.closed||0;
  return {portfolio:{...safePortfolio(account),coachName:account.display_name,pictureUrl:account.picture_url},
    statistics:{entered:totals.entered,open:totals.open||0,closed,wins:totals.wins||0,losses:totals.losses||0,flat:totals.flat||0,winRate:closed?(totals.wins||0)/closed*100:null,realized:totals.realized/100,returnPercent:totals.realized/account.initial_minor*100,committed:totals.committed/100,bookBalance:(account.cash_minor+totals.committed)/100,fees:totals.fees/100},
    trades,total,page:current,pageSize:7,filter,canManage:management&&account.active===1};
}

export async function mutatePortfolio(actor,body){
  if(!actor)fail('FORBIDDEN',403);
  if(!id(body.operationId))fail('INVALID_REQUEST_ID');
  const action=body.action;
  let normalized,p;
  if(action==='create'){
    if(!isAdmin(actor))fail('FORBIDDEN',403);
    if(!id(body.memberId)||!['THB','USD'].includes(body.currency))fail('INVALID_COACH_INPUT');
    if(!await storage.first('SELECT id FROM members WHERE id=?',body.memberId))fail('COACH_MEMBER_NOT_FOUND',404);
    normalized={action,memberId:body.memberId,name:text(body.name,80,true),currency:body.currency,initial:scaled(body.initialCapital,100,100000000,true)};
  }else{
    p=await load(body.portfolioId);manage(actor,p);
    if(action==='visibility'){
      if(!isAdmin(actor))fail('FORBIDDEN',403);
      if(typeof body.published!=='boolean'||typeof body.active!=='boolean')fail('INVALID_COACH_INPUT');
      normalized={action,portfolioId:p.id,published:body.published&&body.active?1:0,active:body.active?1:0};
    }else if(action==='open'){
      if(!['thai','dr','us'].includes(body.market)||((body.market==='us')!==(p.currency==='USD')))fail('COACH_CURRENCY_MISMATCH');
      if(typeof body.symbol!=='string'||!/^([A-Z0-9][A-Z0-9.-]{0,19})$/.test(body.symbol.trim().toUpperCase()))fail('INVALID_COACH_INPUT');
      if(!Number.isInteger(body.quantity)||body.quantity<1||body.quantity>1000000)fail('INVALID_COACH_INPUT');
      normalized={action,portfolioId:p.id,market:body.market,symbol:body.symbol.trim().toUpperCase(),quantity:body.quantity,price:scaled(body.price,1e6,1000000,true),fee:scaled(body.fee,100,1000000),note:text(body.note,240,true)};
    }else if(action==='close'){
      if(!id(body.tradeId))fail('INVALID_COACH_INPUT');
      normalized={action,portfolioId:p.id,tradeId:body.tradeId,price:scaled(body.price,1e6,1000000,true),fee:scaled(body.fee,100,1000000),note:text(body.note,240,true)};
    }else fail('INVALID_ACTION');
  }
  const payloadHash=hash(normalized);
  const previous=await replay(actor,body.operationId,payloadHash);if(previous)return previous;
  const now=new Date().toISOString();
  if(action==='create'){
    const portfolioId=randomUUID();
    await storage.batch([
      operation(`INSERT INTO coach_portfolios(id,owner_id,name,currency,initial_minor,cash_minor,last_operation,created_at,updated_at)
        SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM coach_operations WHERE id=?)
        ON CONFLICT(owner_id,currency) DO NOTHING`,portfolioId,normalized.memberId,normalized.name,normalized.currency,normalized.initial,normalized.initial,body.operationId,now,now,body.operationId),
      operation(`INSERT INTO coach_operations(id,portfolio_id,actor_id,payload_hash,action,created_at)
        SELECT ?,id,?,?,?,? FROM coach_portfolios WHERE id=? AND last_operation=?`,body.operationId,actor.id,payloadHash,action,now,portfolioId,body.operationId),
    ]);
    const saved=await replay(actor,body.operationId,payloadHash);if(saved)return saved;
    fail('COACH_PORTFOLIO_EXISTS',409);
  }
  if(action!=='visibility'&&!p.active)fail('COACH_INACTIVE',409);
  const version=p.version+1;
  const gate=`EXISTS(SELECT 1 FROM coach_portfolios WHERE id=? AND version=? AND last_operation=?)`;
  const gateParams=[p.id,version,body.operationId];
  let tradeId=null,queries=[];
  if(action==='visibility'){
    queries.push(operation(`UPDATE coach_portfolios SET published=?,active=?,version=version+1,last_operation=?,updated_at=? WHERE id=? AND version=? AND NOT EXISTS(SELECT 1 FROM coach_operations WHERE id=?)`,normalized.published,normalized.active,body.operationId,now,p.id,p.version,body.operationId));
  }else if(action==='open'){
    tradeId=randomUUID();const cost=gross(normalized.price,normalized.quantity)+normalized.fee;
    if(cost<1)fail('INVALID_COACH_INPUT');
    if(p.cash_minor<cost)fail('COACH_INSUFFICIENT_CASH',409);
    queries.push(operation(`UPDATE coach_portfolios SET cash_minor=cash_minor-?,version=version+1,last_operation=?,updated_at=? WHERE id=? AND version=? AND active=1 AND cash_minor>=? AND NOT EXISTS(SELECT 1 FROM coach_operations WHERE id=?)`,cost,body.operationId,now,p.id,p.version,cost,body.operationId));
    queries.push(operation(`INSERT INTO coach_trades(id,portfolio_id,symbol,market,quantity,entry_micro,entry_fee_minor,cost_minor,entry_note,opened_at,entry_actor)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${gate}`,tradeId,p.id,normalized.symbol,normalized.market,normalized.quantity,normalized.price,normalized.fee,cost,normalized.note,now,actor.id,...gateParams));
  }else{
    tradeId=normalized.tradeId;
    const trade=await storage.first('SELECT * FROM coach_trades WHERE id=? AND portfolio_id=?',tradeId,p.id);
    if(!trade||trade.closed_at)fail('COACH_TRADE_UNAVAILABLE',409);
    const proceeds=gross(normalized.price,trade.quantity)-normalized.fee;
    if(proceeds<0||p.cash_minor+proceeds>100000000000000)fail('INVALID_COACH_INPUT');
    queries.push(operation(`UPDATE coach_portfolios SET cash_minor=cash_minor+?,version=version+1,last_operation=?,updated_at=? WHERE id=? AND version=? AND active=1 AND NOT EXISTS(SELECT 1 FROM coach_operations WHERE id=?) AND EXISTS(SELECT 1 FROM coach_trades WHERE id=? AND portfolio_id=? AND closed_at IS NULL)`,proceeds,body.operationId,now,p.id,p.version,body.operationId,tradeId,p.id));
    queries.push(operation(`UPDATE coach_trades SET exit_micro=?,exit_fee_minor=?,proceeds_minor=?,pnl_minor=?,exit_note=?,closed_at=?,exit_actor=? WHERE id=? AND portfolio_id=? AND closed_at IS NULL AND ${gate}`,normalized.price,normalized.fee,proceeds,proceeds-trade.cost_minor,normalized.note,now,actor.id,tradeId,p.id,...gateParams));
  }
  queries.push(operation(`INSERT INTO coach_operations(id,portfolio_id,actor_id,payload_hash,action,trade_id,created_at)
    SELECT ?,?,?,?,?,?,? WHERE ${gate}`,body.operationId,p.id,actor.id,payloadHash,action,tradeId,now,...gateParams));
  await storage.batch(queries);
  const saved=await replay(actor,body.operationId,payloadHash);if(saved)return saved;
  fail('COACH_CONCURRENT_UPDATE',409);
}
