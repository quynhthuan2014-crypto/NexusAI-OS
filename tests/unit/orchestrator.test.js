import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRepositories } from '../../packages/storage/repositories.js';
import { LocalProvider } from '../../packages/providers/local-provider.js';
import { AgentOrchestrator } from '../../packages/runtime/orchestrator.js';

test('demo run reaches verified state through required stages', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-run-'));
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-data-'));
  const repos = createRepositories(data);
  const project = await repos.projects.create({ name:'demo', root });
  const task = await repos.tasks.create({ projectId:project.id, title:'demo', prompt:'DEMO: create verified artifact' });
  const run = await new AgentOrchestrator({ ...repos, provider:new LocalProvider() }).run(task, project);
  assert.equal(run.state, 'verified');
  assert.deepEqual(run.events.filter(e=>e.type==='stage.start').map(e=>e.stage), ['planner','builder','reviewer','verifier']);
  assert.equal(run.evidence[0].passed, true);
});
