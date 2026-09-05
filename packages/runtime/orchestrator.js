import { transition, runStatusFromGate } from '../core/state.js';
import { evaluateQualityGate } from '../core/quality-gate.js';
import { makeEvidence, appendEvidence } from '../core/evidence.js';
import { createCheckpoint } from './checkpoint.js';
import { writeFile, readFile } from '../tools/sandbox.js';

export class AgentOrchestrator {
  constructor({ provider, runs, projects, emit }) { this.provider = provider; this.runs = runs; this.projects = projects; this.emit = emit ?? (() => {}); }

  async run(task, project) {
    let run = await this.runs.create({ taskId: task.id, projectId: project.id, state: 'running', stage: 'planner', events: [], evidence: [], changedFiles: [], checkpoint: null, reviewFindings: [] });
    const event = async (type, stage, message, data = {}) => {
      const payload = { id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), type, stage, message, data };
      run.events = [...(run.events ?? []), payload];
      run = await this.runs.update(run.id, { events: run.events, stage, plan: run.plan, provider: run.provider, evidence: run.evidence, changedFiles: run.changedFiles, checkpoint: run.checkpoint, reviewFindings: run.reviewFindings, qualityGate: run.qualityGate, state: run.state, summary: run.summary, error: run.error });
      this.emit(run.id, payload); return payload;
    };
    try {
      await event('stage.start', 'planner', 'Planner started');
      const decision = await this.provider.analyze({ task, project, stage: 'planner' });
      run = await this.runs.update(run.id, { plan: decision.plan, provider: decision.capability });
      await event('stage.complete', 'planner', decision.summary, { plan: decision.plan });
      transition('planner', 'builder');

      const plannedFiles = (decision.edits ?? []).map((edit) => edit.path).filter(Boolean);
      run = await this.runs.update(run.id, { checkpoint: await createCheckpoint(project.root, plannedFiles), stage: 'builder' });
      await event('stage.start', 'builder', 'Builder applying approved edits');
      for (const edit of decision.edits ?? []) {
        if (edit.action !== 'writeFile') throw new Error('unsupported-edit-action');
        await writeFile(project.root, edit.path, edit.content);
        run.changedFiles = [...run.changedFiles, edit.path];
        await event('tool.write', 'builder', `Wrote ${edit.path}`, { path: edit.path });
      }
      await event('stage.complete', 'builder', 'Builder completed', { changedFiles: run.changedFiles });
      transition('builder', 'reviewer');

      await event('stage.start', 'reviewer', 'Reviewer inspecting changes');
      const review = await this.provider.analyze({ task, project, stage: 'reviewer', decision });
      run.reviewFindings = review.reviewFindings ?? decision.reviewFindings ?? [];
      await event('stage.complete', 'reviewer', run.reviewFindings.length ? 'Reviewer found findings' : 'Reviewer found no blocking findings', { findings: run.reviewFindings });
      if (run.reviewFindings.some((finding) => finding.severity === 'blocking')) {
        transition('reviewer', 'fixer');
        await event('stage.start', 'fixer', 'Fixer resolving review findings');
        for (const edit of review.edits ?? []) {
          await writeFile(project.root, edit.path, edit.content);
          if (!run.changedFiles.includes(edit.path)) run.changedFiles = [...run.changedFiles, edit.path];
          await event('tool.write', 'fixer', `Applied fix to ${edit.path}`, { path: edit.path });
        }
        run.reviewFindings = (review.reviewFindings ?? []).filter((finding) => finding.resolved !== true);
        await event('stage.complete', 'fixer', 'Fixer completed', { remainingFindings: run.reviewFindings });
      } else {
        transition('reviewer', 'verifier');
      }
      if (run.reviewFindings.some((finding) => finding.severity === 'blocking')) throw new Error('blocking-review-findings');
      if (run.stage !== 'verifier') transition('fixer', 'verifier');
      run = await this.runs.update(run.id, { stage: 'verifier', changedFiles: run.changedFiles, reviewFindings: run.reviewFindings });

      await event('stage.start', 'verifier', 'Verifier running deterministic checks');
      for (const check of decision.checks ?? []) {
        const t0 = new Date().toISOString(); let passed = false; let summary = '';
        try { const content = await readFile(project.root, check.path); passed = content.includes(check.contains); summary = passed ? 'Expected marker found' : 'Expected marker missing'; }
        catch (error) { summary = error.message; }
        const evidence = makeEvidence({ name: check.name, tool: 'readFile', startedAt: t0, endedAt: new Date().toISOString(), exitCode: passed ? 0 : 1, passed, required: check.required !== false, summary });
        run = appendEvidence(run, evidence);
        await event('evidence', 'verifier', `${check.name}: ${passed ? 'PASS' : 'FAIL'}`, { evidence });
      }
      const gate = evaluateQualityGate({ evidence: run.evidence, reviewFindings: run.reviewFindings });
      await event('quality-gate', 'verifier', gate.verified ? 'Quality gate passed' : 'Quality gate failed', gate);
      run = await this.runs.update(run.id, { state: runStatusFromGate(gate.verified), stage: 'verifier', evidence: run.evidence, qualityGate: gate, completedAt: new Date().toISOString(), summary: gate.verified ? 'Run verified' : `Run failed: ${gate.reasons.join('; ')}` });
      await event('run.complete', 'verifier', run.summary, { state: run.state });
      return run;
    } catch (error) {
      run = await this.runs.update(run.id, { state: 'failed', error: error.message, completedAt: new Date().toISOString(), evidence: run.evidence, changedFiles: run.changedFiles, checkpoint: run.checkpoint, reviewFindings: run.reviewFindings });
      await event('run.failed', run.stage, error.message);
      return run;
    }
  }
}
