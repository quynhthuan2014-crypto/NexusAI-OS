# NexusAI-OS Implementation Plan

> **For agentic workers:** Implement task-by-task with verification after every task.

**Goal:** Deliver a runnable local-first NexusAI-OS workspace with a safe agent pipeline, sandboxed tools, evidence-backed verification, rollback metadata, polished dashboard, and automated CI.

**Architecture:** Hybrid local-first Node.js service with a browser dashboard. The server owns API, orchestration, storage, provider and tool boundaries; the browser is a presentation layer only. The first provider is deterministic and safe so the complete lifecycle can run without an external model.

**Tech Stack:** Node.js 20+, vanilla HTML/CSS/ES modules, Node built-in `node:test`, filesystem JSON persistence, Server-Sent Events for live events, Git CLI through an explicit allowlist.

**Spec:** `docs/superpowers/specs/2026-09-05-nexusai-os-design.md`

## Global Constraints

- Never permit a tool call to escape a registered project root.
- No arbitrary shell strings; process execution uses an allowlist of named commands.
- Providers may propose decisions but never perform filesystem/process side effects directly.
- A run is `verified` only when required evidence passes and no blocking review finding remains.
- Secrets must never be committed.
- The UI must remain usable with only the deterministic local provider.
- CI must run unit tests, integration tests, syntax checks and the deterministic end-to-end demo.

---

### Task 1: Repository foundation

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `LICENSE`
- Create: `SECURITY.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces the Node.js project contract, scripts, CI entrypoints and documentation expected by later tasks.

- [ ] **Step 1: Define package scripts**

```json
{
  "scripts": {
    "start": "node server/index.js",
    "dev": "node server/index.js",
    "test": "node --test",
    "check": "node --check server/index.js && node --check apps/web/app.js",
    "demo": "node tests/e2e/demo-run.js"
  }
}
```

- [ ] **Step 2: Add CI**

```yaml
name: NexusAI-OS CI
on:
  push:
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm test
      - run: npm run check
      - run: npm run demo
```

- [ ] **Step 3: Document local startup and architecture**

Document `npm install` (which is a no-op dependency-wise), `npm start`, default `127.0.0.1:4000`, the safety model, API summary, and future provider extension points.

- [ ] **Step 4: Commit foundation**

```bash
git add package.json .gitignore README.md LICENSE SECURITY.md .github/workflows/ci.yml
git commit -m "chore: initialize NexusAI-OS"
```

---

### Task 2: Core domain and quality gates

**Files:**
- Create: `packages/core/state.js`
- Create: `packages/core/quality-gate.js`
- Create: `tests/unit/core.test.js`

**Interfaces:**
- `STAGES = ['planner','builder','reviewer','fixer','verifier']`
- `RUN_STATES = ['queued','running','blocked','failed','verified']`
- `transition(current, next)` returns next state or throws.
- `evaluateQualityGate({ evidence, reviewFindings })` returns `{ verified, reasons }`.

- [ ] **Step 1: Write failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { transition } from '../../packages/core/state.js';
import { evaluateQualityGate } from '../../packages/core/quality-gate.js';

test('allows forward agent stage transition', () => {
  assert.equal(transition('planner', 'builder'), 'builder');
});

test('rejects skipping agent stages', () => {
  assert.throws(() => transition('planner', 'verifier'));
});

test('quality gate requires passing required evidence', () => {
  assert.equal(evaluateQualityGate({ evidence: [{ required: true, passed: true }], reviewFindings: [] }).verified, true);
  assert.equal(evaluateQualityGate({ evidence: [{ required: true, passed: false }], reviewFindings: [] }).verified, false);
});

test('blocking review finding prevents verification', () => {
  assert.equal(evaluateQualityGate({ evidence: [{ required: true, passed: true }], reviewFindings: [{ severity: 'blocking' }] }).verified, false);
});
```

- [ ] **Step 2: Implement the minimal state machine and gate**

Keep transitions deterministic; allow `fixer` only after a blocking/non-blocking actionable review finding and allow `verifier` after reviewer/fixer.

- [ ] **Step 3: Run focused tests**

```bash
node --test tests/unit/core.test.js
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core tests/unit/core.test.js
git commit -m "feat: add run state machine and quality gate"
```

---

### Task 3: Sandboxed Tool Gateway

**Files:**
- Create: `packages/tools/sandbox.js`
- Create: `packages/tools/process.js`
- Create: `tests/unit/tools.test.js`

**Interfaces:**
- `resolveSafe(root, relativePath)` returns an absolute path inside root or throws.
- `readFile(root, file)` returns UTF-8 text.
- `writeFile(root, file, content)` creates parent directories only inside root.
- `listDirectory(root, relativeDir='.')` returns sorted entries.
- `runAllowed(root, commandName, args)` executes only named commands in an allowlist.

- [ ] **Step 1: Test traversal rejection**

```js
test('rejects path traversal', () => {
  assert.throws(() => resolveSafe('/tmp/project', '../outside.txt'));
  assert.throws(() => resolveSafe('/tmp/project', '/etc/passwd'));
});
```

- [ ] **Step 2: Test safe read/write/list**

Create a temporary project, write `notes/demo.txt`, read it back, and verify it appears in `listDirectory`.

- [ ] **Step 3: Test command allowlist**

Allow only `node-version`, `npm-test`, `npm-check`, and `git-diff`. Reject unknown names without spawning a process.

- [ ] **Step 4: Implement**

Use `path.resolve(root, relativePath)` plus `path.relative(root, resolved)` to prove containment. Never pass a full shell command through `exec`.

- [ ] **Step 5: Run tools tests and commit**

```bash
node --test tests/unit/tools.test.js
git add packages/tools tests/unit/tools.test.js
git commit -m "feat: add project-root sandbox and command gateway"
```

---

### Task 4: Persistence and evidence ledger

**Files:**
- Create: `packages/storage/json-store.js`
- Create: `packages/storage/repositories.js`
- Create: `packages/core/evidence.js`
- Create: `tests/unit/storage.test.js`

**Interfaces:**
- `JsonStore(filePath)` with `load()` and `save(value)`.
- `createRepositories(dataDir)` returns `{ projects, tasks, runs }` repositories.
- `appendEvidence(run, evidence)` returns a new run with stable evidence IDs.

- [ ] **Step 1: Test persistence survives reload**

Write project/task/run data, create a second repository instance and assert data remains identical.

- [ ] **Step 2: Test evidence shape**

Evidence fields: `id`, `name`, `tool`, `startedAt`, `endedAt`, `exitCode`, `passed`, `required`, `summary`.

- [ ] **Step 3: Implement atomic-ish temp-file replacement**

Write to `${file}.tmp` then rename to avoid leaving a half-written JSON file after process interruption.

- [ ] **Step 4: Run tests and commit**

```bash
node --test tests/unit/storage.test.js
git add packages/storage packages/core/evidence.js tests/unit/storage.test.js
git commit -m "feat: add persistent stores and evidence ledger"
```

---

### Task 5: Deterministic provider

**Files:**
- Create: `packages/providers/provider.js`
- Create: `packages/providers/local-provider.js`
- Create: `tests/unit/provider.test.js`

**Interfaces:**
- `Provider.analyze(context)` returns a structured decision object.
- `LocalProvider.analyze(context)` returns stage-specific decisions without side effects.

- [ ] **Step 1: Test provider is side-effect free**

Given a task beginning with `DEMO:`, return a plan that requests creation of `.nexusai/demo-output.txt` with deterministic contents. For ordinary tasks return `capability: 'external-provider-required'` rather than modifying files.

- [ ] **Step 2: Implement provider contract**

Provider outputs are plain JSON: `{ summary, plan, edits, reviewFindings, checks }`.

- [ ] **Step 3: Run tests and commit**

```bash
node --test tests/unit/provider.test.js
git add packages/providers tests/unit/provider.test.js
git commit -m "feat: add deterministic provider contract"
```

---

### Task 6: Agent orchestrator

**Files:**
- Create: `packages/runtime/orchestrator.js`
- Create: `packages/runtime/checkpoint.js`
- Create: `tests/unit/orchestrator.test.js`

**Interfaces:**
- `AgentOrchestrator.run(task, project, options)` returns a run object and persists events.
- `createCheckpoint(projectRoot, plannedFiles)` returns checkpoint metadata.
- `rollbackCheckpoint(projectRoot, checkpoint)` reverts files touched by the deterministic run when safe.

- [ ] **Step 1: Test full happy-path stage order**

Assert events occur in order `planner,builder,reviewer,verifier` for a clean DEMO task and the final state is `verified`.

- [ ] **Step 2: Test fixer path**

Feed a provider review result containing one actionable finding, confirm `fixer` runs before `verifier`.

- [ ] **Step 3: Implement orchestration**

Each stage emits a structured event. Builder may mutate only through Tool Gateway. Reviewer may inspect only through read-only tool adapters. Verifier records evidence then calls the quality gate.

- [ ] **Step 4: Implement checkpoint metadata**

Record pre-change file hashes/content for planned files. Rollback restores pre-existing files and removes newly created files from the checkpoint list.

- [ ] **Step 5: Run focused tests and commit**

```bash
node --test tests/unit/orchestrator.test.js
git add packages/runtime tests/unit/orchestrator.test.js
git commit -m "feat: add multi-stage agent orchestrator"
```

---

### Task 7: HTTP API and live event stream

**Files:**
- Create: `server/index.js`
- Create: `server/http.js`
- Create: `tests/integration/api.test.js`

**Interfaces:**
- JSON API from the design spec under `/api/*`.
- `GET /api/events?runId=<id>` returns an SSE stream.

- [ ] **Step 1: Write integration tests**

Exercise health, project creation, task creation, run start, run fetch, events, evidence, and rollback endpoints.

- [ ] **Step 2: Implement server**

Use Node's `http` module. Serve `apps/web` for static files. Parse JSON requests with an 1 MiB body limit. Return JSON errors with stable shape `{ error: { code, message } }`.

- [ ] **Step 3: Implement SSE**

Keep subscribers by run ID in memory. Send a first `ready` event and then one JSON event per orchestration event. Close cleanly when the client disconnects.

- [ ] **Step 4: Run integration tests**

```bash
node --test tests/integration/api.test.js
```

- [ ] **Step 5: Commit**

```bash
git add server tests/integration/api.test.js
git commit -m "feat: add NexusAI-OS API and live events"
```

---

### Task 8: Dashboard UI

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/styles.css`
- Create: `apps/web/app.js`
- Create: `apps/web/logo.svg`

**Interfaces:**
- Calls the API only; no direct filesystem or process access.
- Run screen renders live SSE events, evidence, changed files, quality gate and rollback action.

- [ ] **Step 1: Build semantic layout**

Sidebar: NexusAI-OS brand, Dashboard, Projects, Tasks, Runs, Settings. Main area: status cards, quick actions, task composer, recent runs, selected run inspector.

- [ ] **Step 2: Add functional interactions**

Register project path, create task, start run, switch runs, connect/disconnect SSE, render events and evidence, invoke rollback with confirmation.

- [ ] **Step 3: Add visual system**

Dark workspace aesthetic, responsive layout, keyboard-friendly controls, status chips, stage timeline, code/diff panel and error banners. Avoid fake metrics; all displayed numbers come from API data.

- [ ] **Step 4: Syntax-check browser JS**

```bash
node --check apps/web/app.js
```

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: add NexusAI-OS control center"
```

---

### Task 9: Deterministic end-to-end demo

**Files:**
- Create: `tests/e2e/demo-run.js`
- Create: `tests/e2e/README.md`

**Interfaces:**
- Uses a temporary project root and the same orchestrator used by the server.

- [ ] **Step 1: Test the complete lifecycle**

Create a temporary project, run `DEMO: create verified artifact`, assert all five agent stage events are present, assert `.nexusai/demo-output.txt` exists, assert verification evidence passes, assert final state is `verified`, then rollback and assert the generated file is gone.

- [ ] **Step 2: Run demo**

```bash
npm run demo
```

Expected: PASS with a human-readable summary of stage order, evidence and rollback.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e
git commit -m "test: add deterministic end-to-end demo"
```

---

### Task 10: Full verification and release hygiene

**Files:**
- Modify: `README.md`
- Modify: `SECURITY.md`
- Create: `docs/architecture/runtime.md`
- Create: `CHANGELOG.md`

- [ ] **Step 1: Run all local verification**

```bash
npm test
npm run check
npm run demo
```

- [ ] **Step 2: Inspect repository tree and API contract**

Check that no secret files, temporary stores or generated runtime data are tracked, that all API endpoints in the spec exist, and that provider/tool boundaries are respected.

- [ ] **Step 3: Push final implementation and monitor CI**

Verify the latest commit's workflow is green. If CI reports a failure, fix the specific defect, rerun all affected tests, commit, and verify CI again before claiming completion.

- [ ] **Step 4: Update documentation**

Document the exact current feature set, limitations, startup commands, security model, test commands, API endpoints and next-stage roadmap. Do not claim browser-level testing unless it was actually performed.

- [ ] **Step 5: Commit release hygiene**

```bash
git add README.md SECURITY.md docs/architecture/runtime.md CHANGELOG.md
git commit -m "docs: finalize NexusAI-OS milestone"
```

---

## Self-review checklist

- [ ] Every spec requirement maps to at least one task.
- [ ] No arbitrary shell execution exists.
- [ ] No provider can directly write files or spawn processes.
- [ ] Traversal and absolute-path escapes are rejected.
- [ ] Quality gate is evidence-based.
- [ ] Rollback is explicit and checkpoint-backed.
- [ ] UI works with deterministic provider.
- [ ] `npm test`, `npm run check`, and `npm run demo` are green locally/CI.
- [ ] Final report distinguishes automated verification from browser-level verification.
