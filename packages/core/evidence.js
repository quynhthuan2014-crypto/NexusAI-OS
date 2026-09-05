export function makeEvidence({ name, tool, startedAt, endedAt, exitCode, passed, required = true, summary }) {
  return { id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name, tool, startedAt, endedAt, exitCode, passed: Boolean(passed), required, summary: String(summary ?? '') };
}

export function appendEvidence(run, evidence) {
  return { ...run, evidence: [...(run.evidence ?? []), evidence] };
}
