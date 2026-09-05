import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRepositories } from '../../packages/storage/repositories.js';
import { LocalProvider } from '../../packages/providers/local-provider.js';
import { AgentOrchestrator } from '../../packages/runtime/orchestrator.js';
import { rollbackCheckpoint } from '../../packages/runtime/checkpoint.js';

test('deterministic NexusAI-OS demo completes and rolls back', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-e2e-project-'));
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-e2e-data-'));
  const repos = createRepositories(data);
  const project = await repos.projects.create({ name:'E2E Demo', root });
  const task = await repos.tasks.create({ projectId:project.id, title:'Verified artifact', prompt:'DEMO: create verified artifact' });
  const run = await new AgentOrchestrator({ ...repos, provider:new LocalProvider() }).run(task, project);
  assert.equal(run.state, 'verified');
  assert.equal(run.qualityGate.verified, true);
  assert.equal(await fs.readFile(path.join(root,'.nexusai','demo-output.txt'),'utf8'), 'NexusAI-OS verified demo artifact.\n');
  await rollbackCheckpoint(root, run.checkpoint);
  await assert.rejects(fs.access(path.join(root,'.nexusai','demo-output.txt')));
  console.log(`NexusAI-OS demo: ${run.state}; evidence=${run.evidence.length}; rollback=ok`);
});
