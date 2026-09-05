# NexusAI-OS Design Specification

Date: 2026-09-05
Status: Proposed for user review

## 1. Vision

NexusAI-OS is a local-first AI workspace for turning natural-language requests into verified project changes. The defining workflow is:

`Request → Plan → Execute → Inspect → Test → Fix → Verify → Report`

The system must never treat an agent's own claim that work is complete as sufficient proof. Completion requires machine-checkable evidence from tests, build checks, validation rules, or explicit human approval.

## 2. Goals

The first production-oriented milestone will provide:

- A web control center served by a local Node.js runtime.
- Project registration and safe project-root boundaries.
- Task creation and task history.
- A multi-stage agent runtime with Planner, Builder, Reviewer, Fixer, and Verifier roles.
- A provider interface so the runtime can work with a deterministic local/mock model first and later connect to legitimate external model APIs without redesigning the core.
- Tool adapters for reading files, writing files, listing directories, running approved test commands, and inspecting git status/diff.
- Checkpoints and rollback metadata for changes made by an agent run.
- An evidence ledger that records each validation action and its result.
- Quality gates that distinguish planned, running, blocked, failed, and verified states.
- A polished dashboard showing projects, active runs, agent stages, evidence, diffs, and errors.
- Automated unit tests, integration tests, syntax checks, and CI.
- Clear permission boundaries so an agent cannot silently escape a registered project root.

## 3. Non-goals for the first milestone

To keep the core reliable, the first milestone will not attempt to be a full autonomous operating system, a hosted multi-tenant service, an unrestricted terminal agent, or an authentication-bypass system. Cloud model integrations, remote collaboration, advanced MCP orchestration, and desktop packaging remain extension points after the core passes the quality gates.

## 4. Architecture

### 4.1 Runtime layers

1. **UI layer** — browser dashboard and task views.
2. **Application API** — task/project/run endpoints and websocket/event stream.
3. **Agent Runtime** — orchestration state machine for Planner → Builder → Reviewer → Fixer → Verifier.
4. **Tool Gateway** — allowlisted, project-root-scoped file/process/git operations.
5. **Provider Gateway** — common interface for deterministic/mock and future model providers.
6. **Persistence** — JSON/SQLite-compatible repository boundary for projects, tasks, runs, events, checkpoints, and evidence.

### 4.2 Core boundaries

- `ProjectRegistry` owns registered project roots and validates paths.
- `TaskStore` owns durable task state.
- `RunStore` owns run state and event history.
- `AgentOrchestrator` owns stage transitions and retry policy.
- `Provider` produces structured agent decisions; it does not directly access the filesystem.
- `ToolGateway` performs side effects and enforces permissions.
- `EvidenceLedger` records validation evidence independently of the agent narrative.
- `QualityGate` decides whether a run can move to `verified`.

No layer may bypass the Tool Gateway for filesystem or process side effects.

## 5. Data flow

1. User registers or opens a project directory.
2. User creates a task with a natural-language request.
3. Planner inspects project metadata through read-only tools and creates a structured plan.
4. Builder performs approved edits through the Tool Gateway.
5. Reviewer inspects the resulting diff and identifies defects or unmet requirements.
6. Fixer applies targeted changes when Reviewer reports actionable defects.
7. Verifier runs deterministic checks defined by the project and records evidence.
8. QualityGate evaluates required evidence. A verified run must contain passing required checks and no unresolved blocking review findings.
9. The UI reports the result, including changed files, checks, evidence, and rollback information.

## 6. Safety and reliability

### Project sandbox

Every tool call resolves paths against the registered project root. Parent traversal and absolute-path escape attempts are rejected. Process execution uses an explicit command allowlist rather than arbitrary shell strings in the first milestone.

### Checkpoints

Before the first mutating action of a run, the runtime captures a checkpoint consisting of git status metadata and the list/content hashes of files it may modify. The system records enough information to undo agent changes safely when the project is under git.

### Rollback

Rollback is exposed as a deliberate user action in the first milestone. Automatic rollback is reserved for unrecoverable tool errors where a checkpoint is available and the operation is unambiguous.

### Evidence

Each evidence record contains the check name, command/tool identifier, start/end timestamps, exit status, summary, and a stable run-local ID. Agent-generated prose does not count as evidence.

## 7. Initial API surface

- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/run`
- `GET /api/runs/:id`
- `GET /api/runs/:id/events`
- `POST /api/runs/:id/rollback`
- `GET /api/runs/:id/evidence`

A websocket/event-stream channel will publish stage and tool events so the UI can render live execution.

## 8. UI design

The dashboard uses a dark technical workspace aesthetic with high contrast and restrained neon accents. Primary areas:

- Sidebar: NexusAI-OS logo, Projects, Tasks, Runs, Settings.
- Main dashboard: health summary, active runs, recent verified runs, failures requiring attention.
- Run view: timeline of agent stages, live event log, changed files, diff, evidence list, quality-gate state.
- Project view: root, detected stack, test commands, recent runs, checkpoints.

The UI must remain useful when no AI provider is configured. A local demo task can exercise the full state machine.

## 9. Provider model

The runtime uses a provider interface such as:

`analyze(context) -> structured decision`

Providers may return a plan, proposed edits, review findings, or verification strategy. They may not perform side effects directly. The deterministic provider will be intentionally simple and is used for development and CI coverage.

Future providers can include legitimate local models or API-backed models through explicit configuration. Secrets are never committed to the repository.

## 10. Testing strategy

The repository will enforce:

- Unit tests for path validation, state transitions, evidence logic, and quality gates.
- Integration tests for the API and orchestration pipeline.
- Syntax/type checking for application code.
- A deterministic end-to-end demo run that creates a temporary project, performs a safe edit, verifies it, and checks the final state.
- CI on every push and pull request.

A release-quality claim will be made only after the automated checks are green. Browser-level interaction testing is considered an additional validation layer when a browser environment is available.

## 11. Repository layout

```text
apps/
  web/                 # dashboard UI
packages/
  core/                # domain models and state machine
  runtime/             # agent orchestrator
  tools/               # sandboxed tool gateway
  providers/           # provider interfaces and local provider
  storage/             # persistence adapters
server/
  index.js             # HTTP/WebSocket application entrypoint
tests/
  unit/
  integration/
  e2e/
docs/
  superpowers/specs/
  architecture/
```

The first implementation may use a compact structure while preserving these boundaries. Extraction into packages is expected once interfaces stabilize.

## 12. Success criteria

The first milestone is successful when a user can:

1. Start NexusAI-OS locally.
2. Register a project directory.
3. Submit a task.
4. Watch Planner → Builder → Reviewer → Fixer → Verifier execute.
5. See the resulting diff.
6. See evidence from deterministic checks.
7. Receive a `verified` state only when the quality gate passes.
8. Roll back the run when a checkpoint is available.
9. Run the full test suite successfully in CI.

## 13. Future extensions

After the core is stable:

- Desktop packaging (Tauri).
- More provider adapters.
- MCP tool integration with explicit permission manifests.
- Workspace indexing and semantic project memory.
- Multi-project agent queues.
- Collaboration and LAN execution.
- Plugin/skill registry.
- Richer code intelligence and AST-aware edits.

These are deliberately separated from the first milestone so the reliability core remains testable.
