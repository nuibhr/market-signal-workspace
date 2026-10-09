// Run with --env-file=.env.local. Values travel only through Wrangler's stdin.
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const common=['SETTRADE_BROKER_ID','SETTRADE_APP_CODE','SETTRADE_APP_ID','SETTRADE_APP_SECRET','BROKER_APP_ID','BROKER_API_SECRET',
  'FMP_API_KEY','AUTO_PICK_RUN_SECRET','AUTO_PICK_ENABLED','AUTO_PICK_DR_ENABLED','AUTO_PICK_US_ENABLED',
  'SETTRADE_DISPLAY_RIGHTS_CONFIRMED','FMP_DISPLAY_RIGHTS_CONFIRMED','YAHOO_EOD_DISPLAY_RIGHTS_CONFIRMED'];
const web=['LINE_CHANNEL_ID','LINE_CHANNEL_SECRET','SESSION_SECRET','PORTFOLIO_HASH_SECRET','ADMIN_LINE_IDS',
  'BIGDATA_API_KEY','MARKETDX_API_KEY','FRED_API_KEY','MARKETDX_PUBLIC_DISPLAY_RIGHTS_CONFIRMED','FRED_PUBLIC_DISPLAY_RIGHTS_CONFIRMED',
  'TFEX_BROKER_ID','TFEX_APP_CODE','TFEX_APP_ID','TFEX_APP_SECRET','TFEX_API_SECRET','TFEX_DISPLAY_RIGHTS_CONFIRMED','YAHOO_DISPLAY_RIGHTS_CONFIRMED','TWELVE_DATA_API_KEY'];
const target=process.argv[2];
if(!['web','scanner'].includes(target))throw Error('Choose web or scanner');
if(target==='web'&&['LINE_CHANNEL_ID','LINE_CHANNEL_SECRET','SESSION_SECRET','PORTFOLIO_HASH_SECRET'].some(key=>!process.env[key]))throw Error('LINE_CONFIGURATION_MISSING');
process.umask(0o077);
const secrets=Object.fromEntries([...common,...(target==='web'?web:[])].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
if(target==='web'){
  mkdirSync('data/cloud-launch',{recursive:true,mode:0o700});
  const keyPath='data/cloud-launch/review.key';
  if(!existsSync(keyPath))writeFileSync(keyPath,randomBytes(32).toString('base64url'),{mode:0o600,flag:'wx'});
  secrets.LAUNCH_REVIEW_SECRET=readFileSync(keyPath,'utf8').trim();
}
const config=target==='web'?'wrangler.jsonc':'deploy/cloudflare/wrangler.scanner.jsonc';
const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk','--config',config],{
  input:JSON.stringify(secrets),encoding:'utf8',env:{...process.env,CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false',WRANGLER_SEND_METRICS:'false'},maxBuffer:1024*1024,
});
// Failed provider messages may echo payloads. Keep them out of the transcript.
if(result.status!==0){console.error('CLOUD_SECRET_UPLOAD_FAILED');process.exitCode=1;}
else console.log(JSON.stringify({target,secretsUploaded:Object.keys(secrets).length,localEnvironmentUnchanged:true}));
