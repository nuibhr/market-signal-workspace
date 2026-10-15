// Read-only deployment checks. Never follow an OAuth redirect or print secrets.
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const origin=new URL(config.vars.APP_ORIGIN).origin;
let key;
try{key=readFileSync('data/cloud-launch/review.key','utf8').trim();}catch{}
const privateProbe=key?{'x-nugaom-launch-review':key}:{};
let failures=0;
for(const path of ['/api/health','/thai','/account','/api/account','/api/auto-pick','/api/auto-pick/results','/api/admin/system']){
  try{
    const response=await fetch(origin+path,{headers:privateProbe,redirect:'manual',signal:AbortSignal.timeout(30000)});
    const text=await response.text();let body;try{body=JSON.parse(text);}catch{}
    const passed=response.status===(path==='/api/admin/system'?403:200);
    if(!passed)failures++;
    console.log(JSON.stringify({path,status:response.status,passed,configured:body?.configured,scanner:body?.scanner,cache:response.headers.get('cache-control')}));
  }catch{failures++;console.log(JSON.stringify({path,passed:false,error:'REQUEST_UNAVAILABLE'}));}
}
const publicResponse=await fetch(origin+'/thai',{redirect:'manual',signal:AbortSignal.timeout(30000)});
const expected=config.vars.LAUNCH_MAINTENANCE==='true'?503:200;
if(publicResponse.status!==expected)failures++;
console.log(JSON.stringify({publicStatus:publicResponse.status,maintenance:config.vars.LAUNCH_MAINTENANCE==='true',passed:publicResponse.status===expected}));
console.log('These probes do not certify customer LINE consent, live market scans or browser audio.');
if(failures)process.exitCode=1;
