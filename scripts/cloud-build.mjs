// Build the existing app in a private staging directory; local preview and secrets stay intact.
import {cpSync,mkdirSync,existsSync,rmSync,symlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),stage=resolve('data/cloud-build/app');
mkdirSync(stage,{recursive:true,mode:0o700});
for(const name of ['src','public','deploy','scripts','package.json','package-lock.json','next.config.mjs','open-next.config.ts','wrangler.jsonc']){
  const source=join(root,name),dest=join(stage,name);
  if(existsSync(dest))rmSync(dest,{recursive:true,force:true});
  cpSync(source,dest,{recursive:true,filter:path=>!path.includes('/.wrangler')&&!path.endsWith('.credentials.json')&&!/(?:^|\/)\.env(?:\.|$)|\.env$|tunnel-token/.test(path)});
}
if(!existsSync(join(stage,'node_modules')))symlinkSync(join(root,'node_modules'),join(stage,'node_modules'),'dir');
const env={...process.env,NUGAOM_CLOUD_BUILD:'true',NUGAOM_REVIEW_MODE:'false',WRANGLER_SEND_METRICS:'false'};
// Never inline any application credentials in a deployable bundle.
for(const name of Object.keys(env))if(/(?:SECRET|TOKEN|API_KEY|APP_KEY|ENCRYPTION_KEY|LINE_CHANNEL|ADMIN_LINE_IDS|BROKER_APP|SETTRADE_|TFEX_)/.test(name))delete env[name];
const result=spawnSync(process.execPath,[join(root,'node_modules/@opennextjs/cloudflare/dist/cli/index.js'),'build'],{cwd:stage,env,stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const output=join(root,'.open-next');if(existsSync(output))rmSync(output,{recursive:true,force:true});
cpSync(join(stage,'.open-next'),output,{recursive:true});
console.log('Cloud bundle prepared. The live local preview and .env.local were not used or replaced.');
