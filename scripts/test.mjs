// Restrict discovery to source tests: cloud build staging contains a copied app.
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const files=readdirSync('src',{recursive:true}).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>join('src',name));
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
