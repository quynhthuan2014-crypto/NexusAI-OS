import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalProvider } from '../../packages/providers/local-provider.js';

test('local provider is deterministic and side-effect free', async () => {
  const provider = new LocalProvider();
  const result = await provider.analyze({ task:{prompt:'DEMO: create verified artifact'} });
  assert.equal(result.capability, 'local-demo');
  assert.equal(result.edits[0].path, '.nexusai/demo-output.txt');
});

test('ordinary task requires external provider', async () => {
  const result = await new LocalProvider().analyze({ task:{prompt:'Build a multiplayer feature'} });
  assert.equal(result.capability, 'external-provider-required');
  assert.deepEqual(result.edits, []);
});
