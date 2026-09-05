import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRepositories } from '../packages/storage/repositories.js';
import { LocalProvider } from '../packages/providers/local-provider.js';
import { AgentOrchestrator } from '../packages/runtime/orchestrator.js';
import { rollbackCheckpoint } from '../packages/runtime/checkpoint.js';
import { parseJson, sendJson, sendError, serveStatic, DATA_DIR } from './http.js';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '127.0.0.1';
const repositories = createRepositories(DATA_DIR);
const provider = new LocalProvider();
const subscribers = new Map();

function publish(runId, event) { for (const res of subscribers.get(runId) ?? []) res.write(`event: nexus\ndata: ${JSON.stringify(event)}\n\n`); }
const orchestrator = new AgentOrchestrator({ ...repositories, provider, emit: publish });

function route(method, pathname) { return `${method} ${pathname}`; }
async function main(req, res) {
  const url = new URL(req.url, `http://${req.headers.host ?? HOST}`);
  try {
    if (url.pathname === '/api/health' && req.method === 'GET') return sendJson(res, 200, { ok: true, name: 'NexusAI-OS', version: '0.1.0', time: new Date().toISOString() });
    if (url.pathname === '/api/projects' && req.method === 'GET') return sendJson(res, 200, { projects: await repositories.projects.all() });
    if (url.pathname === '/api/projects' && req.method === 'POST') {
      const body = await parseJson(req); if (!body.root || typeof body.root !== 'string') return sendError(res, 400, 'invalid-project', 'root is required');
      const root = path.resolve(body.root); const stat = await fs.stat(root).catch(() => null); if (!stat?.isDirectory()) return sendError(res, 400, 'invalid-project', 'root must be an existing directory');
      return sendJson(res, 201, { project: await repositories.projects.create({ name: body.name?.trim() || path.basename(root), root }) });
    }
    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && req.method === 'GET') { const project = await repositories.projects.get(projectMatch[1]); return project ? sendJson(res, 200, { project }) : sendError(res, 404, 'not-found', 'project not found'); }
    if (url.pathname === '/api/tasks' && req.method === 'GET') return sendJson(res, 200, { tasks: await repositories.tasks.all() });
    if (url.pathname === '/api/tasks' && req.method === 'POST') {
      const body = await parseJson(req); if (!body.projectId || !body.prompt?.trim()) return sendError(res, 400, 'invalid-task', 'projectId and prompt are required');
      if (!await repositories.projects.get(body.projectId)) return sendError(res, 404, 'not-found', 'project not found');
      return sendJson(res, 201, { task: await repositories.tasks.create({ projectId: body.projectId, prompt: body.prompt.trim(), title: body.title?.trim() || body.prompt.trim().slice(0, 80) }) });
    }
    const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && req.method === 'GET') { const task = await repositories.tasks.get(taskMatch[1]); return task ? sendJson(res, 200, { task }) : sendError(res, 404, 'not-found', 'task not found'); }
    const runMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/run$/);
    if (runMatch && req.method === 'POST') {
      const task = await repositories.tasks.get(runMatch[1]); if (!task) return sendError(res, 404, 'not-found', 'task not found');
      const project = await repositories.projects.get(task.projectId); if (!project) return sendError(res, 404, 'not-found', 'project not found');
      const runPromise = orchestrator.run(task, project); runPromise.catch(() => {});
      return sendJson(res, 202, { accepted: true, taskId: task.id });
    }
    const runEventsMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/events$/);
    if (runEventsMatch && req.method === 'GET') {
      const run = await repositories.runs.get(runEventsMatch[1]); if (!run) return sendError(res, 404, 'not-found', 'run not found');
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
      res.write(`event: ready\ndata: ${JSON.stringify({ runId: run.id })}\n\n`);
      const list = subscribers.get(run.id) ?? []; list.push(res); subscribers.set(run.id, list);
      req.on('close', () => { const current = subscribers.get(run.id) ?? []; subscribers.set(run.id, current.filter((item) => item !== res)); });
      return;
    }
    const runGetMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
    if (runGetMatch && req.method === 'GET') { const run = await repositories.runs.get(runGetMatch[1]); return run ? sendJson(res, 200, { run }) : sendError(res, 404, 'not-found', 'run not found'); }
    const evidenceMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/evidence$/);
    if (evidenceMatch && req.method === 'GET') { const run = await repositories.runs.get(evidenceMatch[1]); return run ? sendJson(res, 200, { evidence: run.evidence ?? [] }) : sendError(res, 404, 'not-found', 'run not found'); }
    const rollbackMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/rollback$/);
    if (rollbackMatch && req.method === 'POST') {
      const run = await repositories.runs.get(rollbackMatch[1]); if (!run) return sendError(res, 404, 'not-found', 'run not found');
      const project = await repositories.projects.get(run.projectId); if (!project || !run.checkpoint) return sendError(res, 409, 'rollback-unavailable', 'No checkpoint is available for this run');
      await rollbackCheckpoint(project.root, run.checkpoint); const updated = await repositories.runs.update(run.id, { rolledBackAt: new Date().toISOString() }); return sendJson(res, 200, { run: updated, rolledBack: true });
    }
    if (!url.pathname.startsWith('/api/')) return (await serveStatic(res, url.pathname)) || sendError(res, 404, 'not-found', 'resource not found');
    return sendError(res, 404, 'not-found', `${route(req.method, url.pathname)} not found`);
  } catch (error) {
    const status = error.message === 'request-too-large' ? 413 : 500;
    return sendError(res, status, status === 413 ? 'request-too-large' : 'internal-error', status === 413 ? 'request body exceeds 1 MiB' : error.message);
  }
}

export const server = http.createServer((req, res) => { main(req, res); });
if (import.meta.url === `file://${process.argv[1]}`) server.listen(PORT, HOST, () => console.log(`NexusAI-OS listening on http://${HOST}:${PORT}`));
