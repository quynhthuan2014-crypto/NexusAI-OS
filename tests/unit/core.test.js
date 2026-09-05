import test from 'node:test';
import assert from 'node:assert/strict';
import { transition } from '../../packages/core/state.js';
import { evaluateQualityGate } from '../../packages/core/quality-gate.js';

test('forward stage transition is valid', () => assert.equal(transition('planner','builder'),'builder'));
test('stage skipping is rejected', () => assert.throws(() => transition('planner','verifier')));
test('quality gate requires passing required evidence', () => {
  assert.equal(evaluateQualityGate({ evidence:[{name:'x',required:true,passed:true}], reviewFindings:[] }).verified,true);
  assert.equal(evaluateQualityGate({ evidence:[{name:'x',required:true,passed:false}], reviewFindings:[] }).verified,false);
});
test('blocking findings fail verification', () => assert.equal(evaluateQualityGate({evidence:[{required:true,passed:true}],reviewFindings:[{severity:'blocking'}]}).verified,false));
