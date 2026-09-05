# Deterministic E2E

`npm run demo` creates an isolated temporary project and data directory, runs the same `AgentOrchestrator` used by the application, verifies the generated artifact with an evidence-backed quality gate, and then rolls the change back.

The E2E deliberately avoids a real external AI provider so the test remains deterministic in CI.
