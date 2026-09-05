export function evaluateQualityGate({ evidence = [], reviewFindings = [] }) {
  const required = evidence.filter((item) => item.required !== false);
  const failedEvidence = required.filter((item) => item.passed !== true);
  const blocking = reviewFindings.filter((item) => item.severity === 'blocking' || item.resolved !== true);
  const reasons = [];
  if (required.length === 0) reasons.push('no-required-evidence');
  if (failedEvidence.length) reasons.push(`failed-evidence:${failedEvidence.map((e) => e.name).join(',')}`);
  if (blocking.length) reasons.push('unresolved-review-findings');
  return { verified: reasons.length === 0, reasons };
}
