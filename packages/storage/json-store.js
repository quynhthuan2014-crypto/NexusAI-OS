import fs from 'node:fs/promises';
import path from 'node:path';

export class JsonStore {
  constructor(filePath, fallback = {}) { this.filePath = filePath; this.fallback = fallback; }
  async load() {
    try { return JSON.parse(await fs.readFile(this.filePath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(this.fallback); return structuredClone(this.fallback); }
  }
  async save(value) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
    await fs.rename(tmp, this.filePath);
  }
}
