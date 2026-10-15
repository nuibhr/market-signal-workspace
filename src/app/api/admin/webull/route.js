import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { currentMember, privateHeaders, sameOrigin } from '../../../../membership/server.mjs';
import { isAdmin } from '../../../../membership/store.mjs';
import { LAB_UNIVERSE, labBars, labConfigured, labRun } from '../../../../webull-lab/store.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  if (!isAdmin(await currentMember())) return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
  if(process.env.STORAGE_PROVIDER==='d1')return Response.json({error:'WEBULL_LOCAL_ONLY'},{status:409,headers:privateHeaders});
  const symbol = new URL(request.url).searchParams.get('symbol');
  const run = await labRun();
  if (!symbol) return Response.json(run, { headers: privateHeaders });
  if (!LAB_UNIVERSE.includes(symbol)) return Response.json({ error: 'INVALID_SYMBOL' }, { status: 400, headers: privateHeaders });
  const value = await labBars(symbol, run.runId);
  if (!value) return Response.json({ error: 'BARS_UNAVAILABLE' }, { status: 404, headers: privateHeaders });
  return Response.json(value, { headers: privateHeaders });
}
export async function POST(request) {
  if (!isAdmin(await currentMember()) || !sameOrigin(request)) return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
  if(process.env.STORAGE_PROVIDER==='d1')return Response.json({error:'WEBULL_LOCAL_ONLY'},{status:409,headers:privateHeaders});
  if (!labConfigured()) return Response.json({ error: 'SANDBOX_US_REQUIRED' }, { status: 409, headers: privateHeaders });
  const run = await labRun();
  const due = !run.startedAt || Date.now() - Date.parse(run.startedAt) >= 300_000 || run.status === 'INTERRUPTED';
  if (run.status === 'RUNNING' || !due) return Response.json({ accepted: false, run }, { headers: privateHeaders });
  try {
    const child = spawn(process.execPath, [resolve(process.cwd(), 'scripts', 'scan-webull.mjs')], {
      cwd: process.cwd(), env: process.env, stdio: 'ignore', shell: false, detached: true,
    });
    await new Promise((accept, reject) => { child.once('spawn', accept); child.once('error', reject); });
    child.unref();
    return Response.json({ accepted: true }, { status: 202, headers: privateHeaders });
  } catch { return Response.json({ error: 'SCANNER_START_FAILED' }, { status: 503, headers: privateHeaders }); }
}
