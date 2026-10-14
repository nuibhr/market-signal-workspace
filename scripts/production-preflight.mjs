import { launchConfiguration } from '../src/admin/launch-config.mjs';
const { checks } = launchConfiguration();
for (const result of checks) process.stdout.write(`${result.status === 'ready' ? 'PASS' : 'BLOCKED'} ${result.label}\n`);
process.stdout.write('Configuration checks only. Also verify customer cutover, hosting limits, offsite restore, provider access, scanner health, hosted LINE consent and device speech.\n');
if (checks.some(item => item.status !== 'ready')) process.exitCode = 1;
