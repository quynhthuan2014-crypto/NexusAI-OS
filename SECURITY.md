# Security Notes

NexusAI-OS is a local developer tool, not a hardened multi-tenant service.

## Boundaries

- Project filesystem operations are rooted at the registered project directory.
- Parent traversal and absolute-path escapes are rejected.
- Process execution is limited to named commands in `packages/tools/process.js`.
- Providers return structured decisions; they do not get direct tool access.
- Runtime state is stored locally under `.nexusai-data/` and is excluded from version control.
- No API keys or credentials belong in source control.

## Deployment

Keep the first milestone bound to loopback. Do not port-forward or reverse-proxy it to an untrusted network until authentication, authorization, request-origin protection, process isolation and audit controls have been added.

## Reporting

For a security issue, provide a minimal reproducible description without including secrets or personal data. Fixes should add a regression test whenever practical.
