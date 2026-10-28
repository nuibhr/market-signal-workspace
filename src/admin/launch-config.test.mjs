import test from 'node:test';
import assert from 'node:assert/strict';
import { launchConfiguration } from './launch-config.mjs';
const rights=Object.fromEntries(['settrade','fmp','owner-ingest'].map(id=>[id,{status:'CONFIRMED',markets:['thai','dr','us','tfex','forex'],evidenceId:'FIXTURE_ONLY',verifiedAt:'2026-01-01T00:00:00Z',validUntil:'2099-01-01T00:00:00Z'}]));
const configured = {
  CANONICAL_DISPLAY_RIGHTS_JSON:JSON.stringify(rights),
  APP_ORIGIN: 'https://example.com', LINE_REDIRECT_URI: 'https://example.com/api/auth/line/callback',
  LINE_CHANNEL_ID: 'configured', LINE_CHANNEL_SECRET: 'private-line-value',
  SESSION_SECRET: 's'.repeat(64), PORTFOLIO_HASH_SECRET: 'p'.repeat(64), ADMIN_LINE_IDS: 'U'+'a'.repeat(32),
  STORAGE_PROVIDER: 'd1', AUTO_PICK_RUN_SECRET: 'w'.repeat(64), BACKUP_ENCRYPTION_KEY: 'b'.repeat(64), BACKUP_RECOVERY_CONFIRMED: 'true',
  YAHOO_DISPLAY_RIGHTS_CONFIRMED: 'true',
};
const check = (env,id) => launchConfiguration(env).checks.find(item=>item.id===id).status;
test('canonical rights require evidence; legacy booleans cannot certify a deployment', () => {
  assert.equal(check({...configured, LAUNCH_MAINTENANCE:'true'},'maintenance'),'blocked');
  const missing={...configured,CANONICAL_DISPLAY_RIGHTS_JSON:'{}',SETTRADE_DISPLAY_RIGHTS_CONFIRMED:'true',FMP_DISPLAY_RIGHTS_CONFIRMED:'true'};
  for(const market of ['thai','dr','us','tfex','forex'])assert.equal(check(missing,`rights-${market}`),'blocked');
  assert.ok(launchConfiguration(configured).checks.every(item=>item.status==='ready'));
  assert.ok(!launchConfiguration(configured).checks.some(item=>item.id==='rights-history'),'No mandatory Yahoo source');
});
test('expired, future, malformed and wrong-market evidence stay blocked',()=>{
 for(const evidence of [{settrade:{...rights.settrade,validUntil:'2020-01-01T00:00:00Z'}},{settrade:{...rights.settrade,verifiedAt:'2098-01-01T00:00:00Z'}},{settrade:{...rights.settrade,markets:['tfex']}},{}]){
  assert.equal(check({...configured,CANONICAL_DISPLAY_RIGHTS_JSON:JSON.stringify(evidence)},'rights-thai'),'blocked');
 }
 assert.equal(check({...configured,CANONICAL_DISPLAY_RIGHTS_JSON:'invalid'},'rights-thai'),'blocked');
});
test('VPS D1 HTTP configuration needs an HTTPS bridge, daily snapshots and independent secrets',()=>{
 const env={...configured,STORAGE_PROVIDER:'d1-http',WEB_BRIDGE_URL:'https://bridge.example',WEB_BRIDGE_SECRET:'w'.repeat(64),VPS_ORIGIN_SECRET:'v'.repeat(64),SHARED_MARKET_DATA_MODE:'daily'};
 for(const id of ['storage','shared-daily','origin-security'])assert.equal(check(env,id),'ready');
 for(const patch of [{WEB_BRIDGE_URL:'http://bridge.example'},{WEB_BRIDGE_URL:'https://user:password@bridge.example'},{WEB_BRIDGE_URL:'https://bridge.example/path'},{WEB_BRIDGE_SECRET:''}])assert.equal(check({...env,...patch},'storage'),'blocked');
 assert.equal(check({...env,SHARED_MARKET_DATA_MODE:''},'shared-daily'),'blocked');
 for(const key of [env.WEB_BRIDGE_SECRET,env.SESSION_SECRET])assert.equal(check({...env,VPS_ORIGIN_SECRET:key},'origin-security'),'blocked');
});
test('localhost, IPv6 loopback, credential-bearing URLs and mismatched callbacks cannot certify a public site', () => {
  for (const host of ['localhost','127.0.0.1','[::1]']) {
    assert.equal(check({...configured,APP_ORIGIN:`https://${host}`,LINE_REDIRECT_URI:`https://${host}/api/auth/line/callback`},'public-web'),'blocked');
  }
  for (const patch of [{APP_ORIGIN:'https://user:password@example.com'}, {APP_ORIGIN:'https://example.com/path'}, {LINE_REDIRECT_URI:'https://other.example.com/api/auth/line/callback'}, {LINE_REDIRECT_URI:'https://example.com/api/auth/line/callback?test=1'}]) {
    assert.equal(check({...configured,...patch},'public-web'),'blocked');
  }
});
test('recovery acknowledgement without a valid encryption key and shared secrets remain blocked', () => {
  assert.equal(check({...configured,BACKUP_ENCRYPTION_KEY:''},'backup'),'blocked');
  assert.equal(check({...configured,PORTFOLIO_HASH_SECRET:configured.SESSION_SECRET},'session-security'),'blocked');
  for (const value of ['', ' ', 'U'+'a'.repeat(32)+',']) assert.equal(check({...configured,ADMIN_LINE_IDS:value},'admin-access'),'blocked');
  assert.equal(check({...configured,STORAGE_PROVIDER:'sqlite',DATABASE_PATH:'./data/local.sqlite',AUTO_PICK_PERSISTENT_SERVER_CONFIRMED:'true'},'storage'),'blocked');
});
test('launch report never contains credential values', () => {
  const report = JSON.stringify(launchConfiguration({...configured,FRED_API_KEY:'macro-secret',MARKETDX_API_KEY:'news-secret'}));
  for (const key of ['LINE_CHANNEL_SECRET','SESSION_SECRET','PORTFOLIO_HASH_SECRET','AUTO_PICK_RUN_SECRET','BACKUP_ENCRYPTION_KEY']) assert.ok(!report.includes(configured[key]));
  assert.ok(!report.includes('macro-secret') && !report.includes('news-secret'));
});
test('main launch checks include the merged MT5 receiver and its separate recovery evidence', () => {
  const forex = { ...configured, FOREX_MT5_ENABLED: 'true', FOREX_MT5_VANTAGE_SERVERS: 'VantageMarkets-Demo',
    FOREX_MT5_DATABASE_PATH: '/var/lib/nugaom/forex.sqlite', FOREX_MT5_PERSISTENT_STORAGE: 'true' };
  assert.equal(check(forex, 'forex-receiver'), 'blocked'); // D1 cannot host this Node SQLite receiver.
  assert.equal(check(forex, 'forex-backup'), 'blocked'); // Member backup evidence does not cover a second database.
  const node = { ...forex, NODE_ENV: 'production', STORAGE_PROVIDER: 'sqlite', DATABASE_PATH: '/var/lib/nugaom/members.sqlite',
    AUTO_PICK_PERSISTENT_SERVER_CONFIRMED: 'true', FOREX_MT5_BACKUP_RECOVERY_CONFIRMED: 'true' };
  assert.equal(check(node, 'forex-receiver'), 'ready');
  assert.equal(check(node, 'forex-backup'), 'ready');
  for (const patch of [{ FOREX_MT5_DATABASE_PATH: node.DATABASE_PATH }, { FOREX_MT5_LOCAL_MODE: 'true' },
    { FOREX_MT5_MEMBER_LOCAL_FILES: 'true' }, { FOREX_MT5_PERSISTENT_STORAGE: 'false' }, { FOREX_MT5_VANTAGE_SERVERS: '' }]) {
    assert.equal(check({ ...node, ...patch }, 'forex-receiver'), 'blocked');
  }
  assert.equal(check({ ...node, BACKUP_ENCRYPTION_KEY: '' }, 'forex-backup'), 'blocked');
  const text = JSON.stringify(launchConfiguration(node));
  assert.ok(!text.includes(node.FOREX_MT5_DATABASE_PATH));
  assert.ok(!text.includes(node.LINE_CHANNEL_SECRET));
  assert.ok(!launchConfiguration(configured).checks.some(item => item.id.startsWith('forex-')));
});
