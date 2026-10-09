import {dirname,resolve} from 'node:path';
import {AsyncLocalStorage} from 'node:async_hooks';

const context=new AsyncLocalStorage();
let local,platform;
const operation=(sql,...params)=>({sql,params});
export {operation};

function d1Adapter(binding){
  if(!binding?.prepare||!binding?.batch)throw new Error('D1_BINDING_REQUIRED');
  const statement=({sql,params=[]})=>binding.prepare(sql).bind(...params);
  const checked=result=>{if(result?.success===false)throw new Error('STORAGE_QUERY_FAILED');return result;};
  return {
    kind:'d1',
    async first(sql,...params){return statement(operation(sql,...params)).first();},
    async all(sql,...params){return checked(await statement(operation(sql,...params)).all()).results??[];},
    async run(sql,...params){const r=checked(await statement(operation(sql,...params)).run());return {changes:r.meta?.changes??0};},
    async batch(queries){
      if(!queries.length)return [];
      const results=await binding.batch(queries.map(statement));
      return results.map(r=>{checked(r);return {results:r.results??[],changes:r.meta?.changes??0};});
    },
  };
}

// Workers entry points supply their actual env.DB for the duration of a request/job.
// No global mutable binding and no silent SQLite fallback when D1 is selected.
export function withD1Database(binding,action){
  if(!binding?.prepare||!binding?.batch)throw new Error('D1_BINDING_REQUIRED');
  return context.run(d1Adapter(binding),action);
}
async function adapter(){
  if(context.getStore())return context.getStore();
  const mode=process.env.STORAGE_PROVIDER||'sqlite';
  if(mode==='d1'){
    // OpenNext installs this request-scoped getter (see cloudflare/init.js).
    // Read only the active request binding; the development helper also imports
    // Wrangler's Node CLI, which cannot be shipped inside a Worker.
    const requestContext=globalThis[Symbol.for('__cloudflare-context__')];
    return d1Adapter(requestContext?.env?.DB);
  }
  if(mode==='d1-local'||mode==='d1-remote'){
    if(!platform)platform=(async()=>{
      const {getPlatformProxy}=await import('wrangler');
      const remote=mode==='d1-remote';
      const configPath=process.env.D1_CONFIG_PATH||`deploy/cloudflare/wrangler.${remote?'remote':'local'}.jsonc`;
      const proxy=await getPlatformProxy({configPath,remoteBindings:remote,persist:{path:resolve(dirname(configPath),'.wrangler/state/v3')}});
      return {proxy,db:d1Adapter(proxy.env.DB)};
    })().catch(error=>{platform=undefined;throw error;});
    return (await platform).db;
  }
  if(mode!=='sqlite')throw new Error('INVALID_STORAGE_PROVIDER');
  if(!local)local=import('./sqlite.mjs').then(({sqliteDatabase})=>{
    const db=sqliteDatabase();
    return {kind:'sqlite',
      async first(sql,...params){return db.prepare(sql).get(...params)??null;},
      async all(sql,...params){return db.prepare(sql).all(...params);},
      async run(sql,...params){return db.prepare(sql).run(...params);},
      async batch(queries){
        // Entire batch executes synchronously on this connection; nothing awaits inside the transaction.
        db.exec('BEGIN IMMEDIATE');
        try{const results=queries.map(({sql,params=[]})=>{
          const stmt=db.prepare(sql);const readOnly=/^\s*(SELECT|PRAGMA)/i.test(sql);const rows=stmt.all(...params);
          const changes=readOnly?0:db.prepare('SELECT changes() AS n').get().n;
          return {results:rows,changes};
        });db.exec('COMMIT');return results;}
        catch(error){db.exec('ROLLBACK');throw error;}
      },
    };
  }).catch(error=>{local=undefined;throw error;});
  return local;
}

// Only asynchronous query operations are exposed to application repositories.
export const storage={
  first:async(...args)=>(await adapter()).first(...args),
  all:async(...args)=>(await adapter()).all(...args),
  run:async(...args)=>(await adapter()).run(...args),
  batch:async(...args)=>(await adapter()).batch(...args),
  kind:async()=>(await adapter()).kind,
};
export async function closeStorage(){if(platform){const p=await platform;await p.proxy.dispose();platform=undefined;}}
