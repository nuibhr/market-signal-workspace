// Evidence index validation, not a substitute for reviewing licenses or observing staging.
const markets=new Set(['thai','dr','us','tfex','forex']);
const providers={thai:['settrade','yahoo'],dr:['settrade','yahoo'],us:['fmp','yahoo'],tfex:['settrade'],forex:['owner-ingest']};
export function releaseReadiness(manifest,{revision,clean=true,now=Date.now(),verifiedFiles=new Set()}={}){
 const checks=[];
 const add=(id,passed)=>checks.push({id,status:passed?'PASS':'PENDING'});
 const scope=manifest?.scope;
 const validScope=Array.isArray(scope)&&scope.length>0&&new Set(scope.map(s=>s?.market)).size===scope.length&&scope.every(s=>markets.has(s.market)&&Array.isArray(s.providers)&&s.providers.length>0&&new Set(s.providers).size===s.providers.length&&s.providers.every(p=>providers[s.market].includes(p))&&Array.isArray(s.features)&&s.features.length>0&&s.features.every(f=>['quotes','charts','signals','performance'].includes(f)));
 add('schema',manifest?.schemaVersion===1);
 add('revision',/^[a-f0-9]{40}$/.test(revision??'')&&manifest?.revision===revision&&clean);
 add('scope',validScope);
 let origin;try{origin=new URL(manifest?.environment?.origin);}catch{}
 add('staging-environment',Boolean(manifest?.environment?.name&&manifest.environment.kind==='staging'&&origin?.protocol==='https:'&&!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)&&!origin.username&&!origin.password&&origin.pathname==='/'&&!origin.search&&!origin.hash));
 const required=['staging-isolation','clean-install','release-image','browser-desktop-mobile','line-login','stripe-test-lifecycle','load','backup-rollback','session-continuity','owner-release-approval'];
 if(validScope)for(const s of scope){
  for(const p of s.providers)required.push(`rights:${s.market}:${p}`);
  required.push(`real-data:${s.market}`);
  if(s.features.includes('signals'))required.push(`strategy:${s.market}`);
  if(s.features.includes('performance'))required.push(`performance:${s.market}`);
 }
 for(const id of required){
  const evidence=manifest?.gates?.[id],at=Date.parse(evidence?.verifiedAt),until=Date.parse(evidence?.validUntil);
  add(id,evidence?.status==='PASS'&&evidence?.fixture!==true&&evidence?.revision===revision&&typeof evidence?.reviewer==='string'&&evidence.reviewer.trim().length>0&&Number.isFinite(at)&&at<=now&&Number.isFinite(until)&&until>now&&verifiedFiles.has(id));
 }
 return {verdict:checks.every(c=>c.status==='PASS')?'GO':'NO-GO',revision:revision??null,checks,pending:checks.filter(c=>c.status!=='PASS').map(c=>c.id),note:'PASS validates the evidence index; the named reviewer remains responsible for the referenced runtime/license evidence.'};
}
