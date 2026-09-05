import crypto from 'node:crypto';
import path from 'node:path';
import { JsonStore } from './json-store.js';

function id(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function makeRepo(store, key, prefix) {
  return {
    async all() { const data = await store.load(); return data[key] ?? []; },
    async get(itemId) { return (await this.all()).find((item) => item.id === itemId) ?? null; },
    async create(value) { const data = await store.load(); const item = { id: id(prefix), createdAt: new Date().toISOString(), ...value }; data[key] ??= []; data[key].push(item); await store.save(data); return item; },
    async update(itemId, patch) { const data = await store.load(); const list = data[key] ?? []; const index = list.findIndex((item) => item.id === itemId); if (index < 0) return null; list[index] = { ...list[index], ...patch, updatedAt: new Date().toISOString() }; await store.save(data); return list[index]; }
  };
}

export function createRepositories(dataDir) {
  const store = new JsonStore(path.join(dataDir, 'nexusai.json'), { projects: [], tasks: [], runs: [] });
  return { projects: makeRepo(store, 'projects', 'prj'), tasks: makeRepo(store, 'tasks', 'tsk'), runs: makeRepo(store, 'runs', 'run') };
}
