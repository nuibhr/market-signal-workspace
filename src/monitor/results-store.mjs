import {storage} from '../storage/database.mjs';
import {SIGNAL_RULE} from '../signals/model.mjs';
import {receiverConfiguration} from '../forex-mt5/runtime-policy.mjs';
import {storeFor} from '../forex-mt5/store.mjs';
import {forwardEvents} from './view.mjs';
import {projectTrade,combineResults,resultStatus} from './results.mjs';
const rawStates=status=>({WAITING:['WAITING','WAITING_FOR_ENTRY'],OPEN:['OPEN'],RUNNER:['RUNNER'],CLOSED:['CLOSED','TARGET','EXIT'],STOP:['STOP'],EXPIRED:['EXPIRED'],REVIEW:['REVIEW','AMBIGUOUS']})[status]??[];
// Every query remains in the authorized source scope. No ledger rows are copied or mutated.
async function readSource({ledger,db=storage,where=[],params=[],market,status='all',limit=107}) {
 const day=ledger==='daytrade',swing=ledger==='swing',table=day?'daytrade_forward':swing?'signal_desk_signals':'auto_pick_signals';
 const body=day?'body':'payload_json',field=name=>day?`json_extract(body,'$.${name}')`:swing?`json_extract(payload_json,'$.${name}')`:({publishedAt:'published_at',enteredAt:'entered_at',exitedAt:'exited_at',entryPrice:'entry_price',exitPrice:'exit_price'})[name]??name;
 const statusField=day?field('status'):'status',marketField=day?field('market'):'market';
 if(market!=='all'){where.push(`${marketField}=?`);params.push(market);}
 if(status!=='all'){const states=rawStates(status);where.push(`${statusField} IN (${states.map(()=>'?').join(',')})`);params.push(...states);}
 const base=where.length?where.join(' AND '):'1=1';
 const resolved=day||swing?`${statusField} IN ('CLOSED','STOP') AND json_type(${body},'$.netR') IN ('integer','real')`:
  `status IN ('TARGET','STOP','EXIT') AND entry_price>0 AND exit_price>0 AND julianday(exited_at)>=julianday(entered_at)`;
 const order=field('publishedAt'),exitOrder=field(day?'exitTime':'exitedAt');
 const parse=r=>{if(day||swing)return projectTrade(JSON.parse(r[body]),ledger);return projectTrade({id:r.id,market:r.market,symbol:r.symbol,status:r.status,publishedAt:r.published_at,enteredAt:r.entered_at,exitedAt:r.exited_at,entryPrice:r.entry_price,exitPrice:r.exit_price,plan:JSON.parse(r.plan_json)},ledger);};
 const [rows,closed,count,groups,entered]=await Promise.all([
  db.all(`SELECT * FROM ${table} WHERE ${base} ORDER BY ${order} DESC,id LIMIT ?`,...params,limit),
  db.all(`SELECT * FROM ${table} WHERE ${base} AND ${resolved} ORDER BY ${exitOrder} DESC,id LIMIT 100`,...params),
  db.first(`SELECT COUNT(*) AS n FROM ${table} WHERE ${base}`,...params),
  db.all(`SELECT ${statusField} AS state,COUNT(*) AS n FROM ${table} WHERE ${base} GROUP BY ${statusField}`,...params),
  db.first(`SELECT COUNT(*) AS n FROM ${table} WHERE ${base} AND ${field(day?'entryTime':'enteredAt')} IS NOT NULL`,...params),
 ]);
 return {ledger,rows:rows.map(parse),closed:closed.map(parse),total:count.n,counts:Object.fromEntries(groups.map(r=>[r.state,r.n])),entered:entered.n};
}
export async function tradeResults(memberId,options={}, {env=process.env,getStore=storeFor}={}) {
 const {market='all',strategy='all',status='all',scope='history'}=options;
 const page=Math.max(1,Math.min(10000,Math.floor(Number(options.page)||1))),pageSize=7,limit=page*pageSize+100;
 const common={market,status,limit},parts=[];
 if(['all','swing'].includes(strategy)){
  const where=[`rule_version=?`,`(market IN ('thai','dr') AND cost_profile='standard' OR market='us' AND cost_profile IN (SELECT profile_id FROM signal_desk_profile_access WHERE member_id=?))`];
  parts.push(await readSource({ledger:'swing',...common,where,params:[SIGNAL_RULE,memberId]}));
 }
 if(['all','orb','eod'].includes(strategy)){
  const where=[],params=[];
  if(strategy==='orb')where.push("json_extract(plan_json,'$.setupType') IN ('OPENING_RANGE_BREAKOUT','DR_ORB_15M')");
  if(strategy==='eod')where.push("json_extract(plan_json,'$.setupType') IN ('DAILY_CLOSE_BREAKOUT','US_EOD')");
  parts.push(await readSource({ledger:'legacy',...common,where,params}));
 }
 if(['all','scalp'].includes(strategy)){
  const config=receiverConfiguration(env);
  if(!config.disabledReason){
   const store=getStore(config),connection=store.connection(`member:${memberId}`),scopes=['native:thai','native:dr','native:tfex'];
   if(config.enabled&&connection&&config.servers.includes(connection.server))scopes.push(`mt5:${connection.owner}:${connection.server}`);
   const db={all:async(sql,...p)=>store.db.prepare(sql).all(...p),first:async(sql,...p)=>store.db.prepare(sql).get(...p)};
   parts.push(await readSource({ledger:'daytrade',db,...common,where:[`scope IN (${scopes.map(()=>'?').join(',')})`,`COALESCE(json_extract(body,'$.origin'),'forward')!='replay'`],params:scopes}));
  }else parts.push({ledger:'daytrade',status:config.disabledReason||'SCANNER_DISABLED',rows:[],closed:[],total:0});
 }
 const result=combineResults(parts,{page,pageSize,scope});
 // Only the seven displayed records load their event history; identity was authorized above.
 for(const row of result.signals){
  if(row.ledger==='daytrade'){
   const config=receiverConfiguration(env),store=getStore(config),scope=row.market==='us'||row.market==='forex'?(()=>{const c=store.connection(`member:${memberId}`);return c?`mt5:${c.owner}:${c.server}`:'';})():`native:${row.market}`;
   const raw=store.db.prepare('SELECT body FROM daytrade_forward WHERE scope=? AND id=?').get(scope,row.id);
   row.events=raw?forwardEvents([JSON.parse(raw.body)]):[];
  }else if(row.ledger==='swing')row.events=(await storage.all('SELECT id,payload_json FROM signal_desk_events WHERE signal_id=? ORDER BY seq',row.id)).map(r=>{const e=JSON.parse(r.payload_json);return {id:r.id,type:e.type,createdAt:e.createdAt,price:e.price,barTime:e.barTime};});
  else row.events=await storage.all('SELECT id,event_type AS type,created_at AS createdAt,price,bar_time AS barTime,bar_day AS barDay FROM auto_pick_events WHERE pick_id=? ORDER BY created_at,id',row.id);
 }
 return result;
}
