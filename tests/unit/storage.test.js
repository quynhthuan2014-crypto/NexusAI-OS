import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JsonStore } from '../../packages/storage/json-store.js';
import { makeEvidence, appendEvidence } from '../../packages/core/evidence.js';

test('JSON store survives reload', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-store-'));
  const file = path.join(dir, 'data.json');
  const first = new JsonStore(file, { projects: [] });
  await first.save({ projects:[{ id:'p1', name:'Demo' }] });
  const second = new JsonStore(file, {});
  assert.deepEqual(await second.load(), { projects:[{ id:'p1', name:'Demo' }] });
});

test('evidence has required fields and can be appended', () => {
  const evidence = makeEvidence({ name:'demo', tool:'readFile', startedAt:'a', endedAt:'b', exitCode:0, passed:true, summary:'ok' });
  const run = appendEvidence({ evidence:[] }, evidence);
  assert.equal(run.evidence.length, 1);
  assert.equal(run.evidence[0].required, true);
  assert.match(run.evidence[0].id, /^ev_/);
});
