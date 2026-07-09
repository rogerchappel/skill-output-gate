import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

test('cli emits JSON for passing summaries', () => {
  const result = spawnSync(process.execPath, ['src/cli.js', 'fixtures/good-summary.md', '--format', 'json'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.equal(report.gate.status, 'pass');
  assert.equal(report.report.source, 'fixtures/good-summary.md');
});

test('cli exits with 2 for blocking findings', () => {
  const result = spawnSync(process.execPath, ['src/cli.js', 'fixtures/bad-summary.md', '--format', 'markdown'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });

  assert.equal(result.status, 2);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Status: fail/);
  assert.match(result.stdout, /missing_artifacts/);
});

test('cli writes output files for downstream handoff', () => {
  const out = new URL('../.tmp-gate-report.md', import.meta.url);
  const result = spawnSync(process.execPath, ['src/cli.js', 'fixtures/good-summary.md', '--format', 'markdown', '--output', out.pathname], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  assert.match(fs.readFileSync(out, 'utf8'), /Status: pass/);
  fs.rmSync(out, { force: true });
});

test('cli help is available without a summary file', () => {
  const result = spawnSync(process.execPath, ['src/cli.js', '--help'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Usage: skill-output-gate/);
});
