import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { resolveSafe, readFile, writeFile } from '../tools/sandbox.js';

export async function createCheckpoint(projectRoot, files) {
  const entries = [];
  for (const file of files) {
    const target = resolveSafe(projectRoot, file);
    try {
      const content = await fs.readFile(target, 'utf8');
      entries.push({ path: file, existed: true, sha256: crypto.createHash('sha256').update(content).digest('hex'), content });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      entries.push({ path: file, existed: false, content: null });
    }
  }
  return { id: `cp_${crypto.randomUUID()}`, createdAt: new Date().toISOString(), files: entries };
}

export async function rollbackCheckpoint(projectRoot, checkpoint) {
  for (const entry of checkpoint.files) {
    const target = resolveSafe(projectRoot, entry.path);
    if (entry.existed) await writeFile(projectRoot, entry.path, entry.content);
    else { try { await fs.unlink(target); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  }
  return true;
}
