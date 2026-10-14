import {resolve} from 'node:path';
import {configuration} from './protocol.mjs';

// The imported receiver needs durable Node SQLite. Cloudflare continues using
// the existing D1 app; enabling a flag cannot create an ephemeral Forex store.
export function receiverConfiguration(env=process.env) {
  const config=configuration(env);
  const nodeStorage=(env.STORAGE_PROVIDER||'sqlite')==='sqlite'&&env.NUGAOM_CLOUD_BUILD!=='true'&&env.AUTO_PICK_RUNTIME!=='cloudflare';
  const separateDatabase=config.databasePath===':memory:'||resolve(config.databasePath)!==resolve(env.DATABASE_PATH||'./data/nugaom.sqlite');
  const disabledReason=!nodeStorage?'NODE_RECEIVER_REQUIRED':!separateDatabase?'SEPARATE_DATABASE_REQUIRED':null;
  return {...config,enabled:config.enabled&&!disabledReason,disabledReason,
    memberLocalFiles:env.NODE_ENV==='development'&&env.FOREX_MT5_MEMBER_LOCAL_FILES==='true'};
}

export function loopbackRequest(request) {
  return ['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);
}

// Local HTTP is a development transport, independent of the optional anonymous
// pilot session. Members on the unified app keep using their normal LINE session.
export function developmentTransport(request,env=process.env) {
  return env.NODE_ENV==='development'&&loopbackRequest(request);
}
