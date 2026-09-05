import fs from 'node:fs/promises';
import path from 'node:path';

export function resolveSafe(root, candidate = '.') {
  const base = path.resolve(root);
  const resolved = path.resolve(base, candidate);
  const relative = path.relative(base, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('sandbox-violation');
  return resolved;
}

export async function readFile(root, file) { return fs.readFile(resolveSafe(root, file), 'utf8'); }
export async function writeFile(root, file, content) {
  const target = resolveSafe(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
  return target;
}
export async function listDirectory(root, relativeDir = '.') {
  const entries = await fs.readdir(resolveSafe(root, relativeDir), { withFileTypes: true });
  return entries.map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' })).sort((a, b) => a.name.localeCompare(b.name));
}
