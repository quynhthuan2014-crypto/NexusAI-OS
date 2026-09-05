# NexusAI-OS

**One workspace. Plan, build, test, verify.**

NexusAI-OS is a local-first AI engineering workspace designed around a strict rule: an agent saying "done" is not evidence that a change works.

```text
Request
  ↓
Planner → Builder → Reviewer → Fixer → Verifier
  ↓
Evidence → Quality Gate → Verified / Failed
```

## What is in this milestone

- Local Node.js control center on `127.0.0.1:4000`
- Project registration with filesystem-root boundaries
- Task and run persistence in JSON
- Deterministic local provider for a complete safe demo without an API key
- Sandboxed file access with traversal and absolute-path protection
- Explicit process command allowlist
- Multi-stage agent orchestrator
- Evidence ledger and evidence-based quality gate
- Checkpoint-backed rollback
- Live Server-Sent Events for run events
- Responsive dark technical dashboard
- Unit, integration and deterministic end-to-end tests
- GitHub Actions CI on pushes and pull requests

## Start

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open `http://127.0.0.1:4000`.

Runtime data is stored under `.nexusai-data/` and is ignored by git.

## First run

Register an existing local project directory in **Projects**. Then create a task:

```text
DEMO: create verified artifact
```

Press **Run**. The deterministic provider writes `.nexusai/demo-output.txt` through the sandbox, records evidence, passes the quality gate, and exposes a rollback action.

General natural-language coding tasks are intentionally blocked in this first milestone until a legitimate external provider is configured. This prevents a fake "AI" mode from pretending it can safely edit arbitrary code.

## API

- `GET /api/health`
- `GET/POST /api/projects`
- `GET /api/projects/:id`
- `GET/POST /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/run`
- `GET /api/runs`
- `GET /api/runs/:id`
- `GET /api/runs/:id/events` (SSE)
- `GET /api/runs/:id/evidence`
- `POST /api/runs/:id/rollback`

Errors use:

```json
{ "error": { "code": "stable-code", "message": "Human-readable message" } }
```

## Reliability model

Providers return structured decisions only. They cannot access the filesystem or spawn processes directly. All side effects pass through the tool gateway.

The quality gate requires at least one required passing evidence record and no unresolved review blocker. A successful run therefore has machine-checkable proof independent from the agent's prose.

## Security boundaries

NexusAI-OS is intended to run locally. Project paths are resolved against a registered root and path escapes are rejected. Process execution uses named allowlisted commands rather than arbitrary shell input. Do not expose the development server directly to the public internet.

See `SECURITY.md` for the current threat model and extension guidance.

## Verification

```bash
npm test
npm run check
npm run demo
```

CI repeats the same verification on GitHub Actions. Browser-level interaction has not been represented as a passing automated test; the dashboard should be manually exercised in a browser after local startup.

## Architecture

See:

- `docs/superpowers/specs/2026-09-05-nexusai-os-design.md`
- `docs/superpowers/plans/2026-09-05-nexusai-os-implementation.md`
- `docs/architecture/runtime.md`

## Roadmap

Next layers can add legitimate model providers, richer project memory, AST-aware edits, permission manifests, plugins, desktop packaging, multi-project queues and LAN collaboration without changing the core safety boundaries.
