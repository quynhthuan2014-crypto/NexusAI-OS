# Runtime Architecture

```text
Browser UI
   │ JSON + SSE
   ▼
HTTP API
   │
   ▼
AgentOrchestrator ───── Provider
   │                     │
   │ structured edits    │ no side effects
   ▼                     │
Tool Gateway ◀───────────┘
   │
   ├── sandboxed filesystem
   └── named process commands
   │
   ▼
Repositories → local JSON state
```

## Run lifecycle

1. A project is registered with an absolute local root.
2. A task points to a registered project.
3. Planner asks the provider for a structured decision.
4. Builder applies only supported edits through the sandbox.
5. Reviewer evaluates the structured decision and can provide actionable findings.
6. Fixer may apply provider-supplied fixes when a blocking finding exists.
7. Verifier performs deterministic checks and creates evidence records.
8. Quality Gate evaluates evidence and unresolved findings.
9. The run becomes `verified` only after the gate passes.

## Why the boundaries matter

A provider is intentionally unable to call `fs`, spawn a process, or perform a git mutation. This separation makes it possible to replace the deterministic provider with a legitimate model adapter while keeping project permissions in one place.

The first UI uses Server-Sent Events instead of a custom websocket implementation. The event contract is deliberately transport-neutral so a websocket transport can be introduced later without rewriting the orchestration layer.

## Persistence

`JsonStore` is a replaceable adapter. The repositories expose a small CRUD surface so SQLite can be introduced later without forcing API or runtime changes.

## Checkpoints

The current checkpoint captures the original contents of planned files before mutation. Rollback restores those files or removes newly-created ones. Future git-native checkpoints can expand this with commit/index metadata.
