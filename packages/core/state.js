export const STAGES = Object.freeze(['planner', 'builder', 'reviewer', 'fixer', 'verifier']);
export const RUN_STATES = Object.freeze(['queued', 'running', 'blocked', 'failed', 'verified']);

const STAGE_NEXT = new Map([
  ['planner', 'builder'],
  ['builder', 'reviewer'],
  ['reviewer', 'verifier'],
  ['fixer', 'verifier']
]);

export function transition(current, next) {
  if (!STAGES.includes(current) || !STAGES.includes(next)) throw new Error('invalid-stage');
  if (STAGE_NEXT.get(current) !== next) throw new Error(`invalid-transition:${current}->${next}`);
  return next;
}

export function runStatusFromGate(verified, blocked = false) {
  if (verified) return 'verified';
  if (blocked) return 'blocked';
  return 'failed';
}
