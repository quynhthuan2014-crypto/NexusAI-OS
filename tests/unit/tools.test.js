import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveSafe, readFile, writeFile, listDirectory } from '../../packages/tools/sandbox.js';
import { runAllowed } from '../../packages/tools/process.js';

test('sandbox rejects traversal and absolute escape', () => {
  assert.throws(() => resolveSafe('/tmp/nexus-project', '../outside'));
  assert.throws(() => resolveSafe('/tmp/nexus-project', '/etc/passwd'));
});

test('sandbox can write, read and list safely', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexusai-'));
  await writeFile(root, 'nested/demo.txt', 'hello');
  assert.equal(await readFile(root, 'nested/demo.txt'), 'hello');
  assert.deepEqual(await listDirectory(root, 'nested'), [{ name: 'demo.txt', type: 'file' }]);
});

test('process gateway rejects arbitrary commands', async () => {
  await assert.rejects(() => runAllowed(process.cwd(), 'unknown-command'));
});
