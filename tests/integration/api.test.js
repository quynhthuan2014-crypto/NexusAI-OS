import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-api-data-'));
const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-api-project-'));
process.env.NEXUSAI_DATA_DIR = dataDir;
const { server } = await import('../../server/index.js');

let origin;
async function request(route, options = {}) { const response = await fetch(`${origin}${route}`, { ...options, headers: { 'content-type':'application/json', ...(options.headers??{}) } }); const json = await response.json(); return { response, json }; }

test.before(async () => await new Promise(resolve => server.listen(0, '127.0.0.1', () => { origin = `http://127.0.0.1:${server.address().port}`; resolve(); })));
test.after(async () => await new Promise(resolve => server.close(resolve)));

test('health, project, task and run APIs work end-to-end', async () => {
  const health = await request('/api/health'); assert.equal(health.response.status, 200); assert.equal(health.json.ok, true);
  const project = await request('/api/projects', { method:'POST', body:JSON.stringify({ name:'API Demo', root:projectDir }) }); assert.equal(project.response.status,201);
  const task = await request('/api/tasks', { method:'POST', body:JSON.stringify({ projectId:project.json.project.id, title:'Demo', prompt:'DEMO: create verified artifact' }) }); assert.equal(task.response.status,201);
  const accepted = await request(`/api/tasks/${task.json.task.id}/run`, { method:'POST', body:'{}' }); assert.equal(accepted.response.status,202);
  let runs = [];
  for(let i=0;i<40;i++){ runs=(await request('/api/runs')).json.runs; if(runs.length && (runs.at(-1).state==='verified' || runs.at(-1).state==='failed')) break; await new Promise(r=>setTimeout(r,25)); }
  assert.equal(runs.length,1); assert.equal(runs[0].state,'verified', JSON.stringify(runs[0]));
  const run = await request(`/api/runs/${runs[0].id}`); assert.equal(run.json.run.qualityGate.verified,true);
  const evidence = await request(`/api/runs/${runs[0].id}/evidence`); assert.equal(evidence.json.evidence.length,1);
  const rollback = await request(`/api/runs/${runs[0].id}/rollback`, {method:'POST',body:'{}'}); assert.equal(rollback.response.status,200);
});
