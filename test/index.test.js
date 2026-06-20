import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRunSummary, evaluateGate, readinessScore, renderMarkdown, toJsonReport } from '../src/index.js';

test('passes complete output summaries', () => {
  const report = parseRunSummary(fs.readFileSync('fixtures/good-summary.md', 'utf8'), 'fixtures/good-summary.md');
  const gate = evaluateGate(report);
  assert.equal(gate.status, 'pass');
  assert.ok(report.artifacts.includes('README.md'));
  assert.equal(readinessScore(report, gate), 100);
});

test('fails missing artifacts and failed verification', () => {
  const report = parseRunSummary(fs.readFileSync('fixtures/bad-summary.md', 'utf8'), 'fixtures/bad-summary.md');
  const gate = evaluateGate(report);
  assert.equal(gate.status, 'fail');
  assert.ok(gate.findings.some(item => item.code === 'missing_artifacts'));
  assert.ok(gate.findings.some(item => item.code === 'failed_verification'));
});

test('renders markdown and JSON reports', () => {
  const report = parseRunSummary(fs.readFileSync('fixtures/good-summary.md', 'utf8'), 'fixtures/good-summary.md');
  assert.match(renderMarkdown(report), /Status: pass/);
  assert.equal(toJsonReport(report).gate.status, 'pass');
});
