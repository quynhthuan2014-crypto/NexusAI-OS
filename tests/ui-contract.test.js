import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, 'apps', 'web', file), 'utf8');

test('NexusAI-OS web shell exposes the premium workspace contract', () => {
  const html = read('index.html');
  assert.match(html, /data-view=\"workspace\"/);
  assert.match(html, /data-view=\"projects\"/);
  assert.match(html, /data-view=\"tasks\"/);
  assert.match(html, /data-view=\"runs\"/);
  assert.match(html, /data-view=\"settings\"/);
  assert.match(html, /id=\"command-palette\"/);
  assert.match(html, /id=\"toast-region\"/);
});

test('NexusAI-OS web stylesheet defines the responsive product shell', () => {
  const css = read('styles.css');
  assert.match(css, /\.app-shell\{/);
  assert.match(css, /\.sidebar\{/);
  assert.match(css, /@media \(max-width:980px\)/);
  assert.match(css, /@media \(max-width:700px\)/);
});

test('NexusAI-OS app keeps navigation and command palette state local', () => {
  const js = read('app.js');
  assert.match(js, /command-palette/);
  assert.match(js, /shortcut-panel/);
  assert.match(js, /showToast/);
  assert.match(js, /setView\(/);
});
