import {readFileSync,realpathSync} from 'node:fs';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {releaseReadiness} from '../src/admin/release-readiness.mjs';
try{
 const path=resolve(process.argv[2]||'deploy/staging/release-evidence.example.json');
 const manifest=JSON.parse(readFileSync(path,'utf8')),root=realpathSync(dirname(path));
 const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const clean=!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
 const verifiedFiles=new Set();
 for(const [id,gate] of Object.entries(manifest.gates??{})){
  try{
   if(typeof gate.file!=='string'||!gate.file||isAbsolute(gate.file)||!/^[a-f0-9]{64}$/.test(gate.sha256??''))continue;
   const file=realpathSync(resolve(root,gate.file)),rel=relative(root,file);
   if(rel==='..'||rel.startsWith('../')||isAbsolute(rel))continue;
   const bytes=readFileSync(file);
   if(bytes.length>0&&createHash('sha256').update(bytes).digest('hex')===gate.sha256)verifiedFiles.add(id);
  }catch{}
 }
 const report=releaseReadiness(manifest,{revision,clean,verifiedFiles});
 console.log(JSON.stringify(report,null,2));process.exitCode=report.verdict==='GO'?0:1;
}catch{console.log(JSON.stringify({verdict:'NO-GO',pending:['EVIDENCE_FILE_OR_GIT_UNAVAILABLE']}));process.exitCode=1;}
