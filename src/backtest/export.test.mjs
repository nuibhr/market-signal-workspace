import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
test('CSV export refuses a nonempty destination before fetching or overwriting existing research data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nugaom-export-guard-'));
  try {
    writeFileSync(join(directory, 'existing.csv'), 'fixture content\n');
    const result = spawnSync(process.execPath, ['scripts/export-swing-csv.mjs', directory], { encoding: 'utf8', timeout: 20000 });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /EXPORT_DIRECTORY_MUST_BE_EMPTY/);
    assert.equal(readFileSync(join(directory, 'existing.csv'), 'utf8'), 'fixture content\n');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
