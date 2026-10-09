import test from 'node:test';
import assert from 'node:assert/strict';
import { LLMProvider } from '../packages/providers/llm-provider.js';

test('LLMProvider handles fallback on network / API error gracefully', async () => {
  const provider = new LLMProvider({ baseUrl: 'http://127.0.0.1:59999/invalid', model: 'test-model' });
  const decision = await provider.analyze({
    task: { prompt: 'Create new feature' },
    project: { root: '/tmp/test' },
    stage: 'planner'
  });

  assert.equal(decision.capability, 'llm-test-model-fallback');
  assert.equal(decision.reviewFindings.length, 1);
  assert.equal(decision.reviewFindings[0].severity, 'blocking');
});

test('LLMProvider handles reviewer stage correctly', async () => {
  const provider = new LLMProvider({ model: 'test-model' });
  const decision = await provider.analyze({
    task: { prompt: 'Create new feature' },
    project: { root: '/tmp/test' },
    stage: 'reviewer',
    decision: { reviewFindings: [] }
  });

  assert.equal(decision.capability, 'llm-test-model');
  assert.equal(decision.summary, 'LLM reviewer evaluated changes');
  assert.deepEqual(decision.reviewFindings, []);
});
