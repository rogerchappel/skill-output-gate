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

test('cli accepts documented options before the summary file', () => {
  const result = runCli(['--format', 'markdown', '--required-artifacts', '1', 'fixtures/good-summary.md']);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Status: pass/);
});

test('cli rejects unknown options and extra summary files', () => {
  for (const args of [
    ['fixtures/good-summary.md', '--bogus'],
    ['fixtures/good-summary.md', 'fixtures/bad-summary.md'],
  ]) {
    const result = runCli(args);
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /skill-output-gate:/);
    assert.match(result.stderr, /Usage:/);
    assert.doesNotMatch(result.stdout, /"status": "pass"/);
  }
});

test('cli rejects missing or unsupported format values', () => {
  for (const args of [
    ['fixtures/good-summary.md', '--format'],
    ['fixtures/good-summary.md', '--format', 'yaml'],
  ]) {
    const result = runCli(args);
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /--format must be json or markdown/);
    assert.match(result.stderr, /Usage:/);
  }
});

test('cli rejects a missing output path', () => {
  const result = runCli(['fixtures/good-summary.md', '--output']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--output requires a path/);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, '');
});

test('fails negated and mixed verification statuses', () => {
  for (const verification of [
    ['Tests did not pass'],
    ['Lint passed', 'Tests did not pass'],
    ['Build succeeded', 'Tests were not successful'],
  ]) {
    const gate = evaluateGate(completeReport({ verification }));
    assert.equal(gate.status, 'fail', verification.join('; '));
    assert.ok(gate.findings.some(item => item.code === 'failed_verification'));
  }
});

test('fails common verification failure inflections', () => {
  for (const verification of [
    '1 test failing',
    '2 tests fail',
    'Tests are failing',
    'Build errors',
    'Verification was unsuccessful',
  ]) {
    const gate = evaluateGate(completeReport({ verification: [verification] }));
    assert.equal(gate.status, 'fail', verification);
    assert.ok(gate.findings.some(item => item.code === 'failed_verification'));
  }
});

test('does not mistake nearby nonfailure wording for failed verification', () => {
  for (const verification of [
    'Tests passed with no errors',
    'Tests passed without errors',
    'Tests passed; 0 errors',
    'Error-handling tests passed',
    'The previously failing test passed',
  ]) {
    assert.equal(evaluateGate(completeReport({ verification: [verification] })).status, 'pass', verification);
  }
});

test('cli exits with 2 for failure inflections', () => {
  const summary = new URL('../.tmp-failing-summary.md', import.meta.url);
  fs.writeFileSync(summary, '# Result\n\n## Summary\n\nCompleted the requested implementation.\n\n## Verification\n\n- 1 test failing\n\n## Artifacts\n\n- src/index.js\n\n## Risks\n\n- None known\n\n## Next Actions\n\n- Fix the test\n');

  try {
    const result = runCli([summary.pathname, '--format', 'json']);
    assert.equal(result.status, 2);
    assert.equal(result.stderr, '');
    const output = JSON.parse(result.stdout);
    assert.equal(output.gate.status, 'fail');
    assert.ok(output.gate.findings.some(item => item.code === 'failed_verification'));
  } finally {
    fs.rmSync(summary, { force: true });
  }
});

test('accepts unambiguous passing verification statuses', () => {
  for (const verification of [['Tests passed'], ['Build succeeded'], ['Lint OK']]) {
    assert.equal(evaluateGate(completeReport({ verification })).status, 'pass');
  }
});

test('rejects invalid required artifact thresholds through the API', () => {
  for (const requiredArtifacts of ['abc', -2, 1.5, 0]) {
    assert.throws(
      () => evaluateGate(completeReport(), { requiredArtifacts }),
      /requiredArtifacts must be a positive integer/
    );
  }
});

test('rejects invalid --required-artifacts values with a CLI usage error', () => {
  for (const args of [
    ['fixtures/good-summary.md', '--required-artifacts'],
    ['fixtures/good-summary.md', '--required-artifacts', 'abc'],
    ['fixtures/good-summary.md', '--required-artifacts', '-2'],
    ['fixtures/good-summary.md', '--required-artifacts', '1.5'],
    ['fixtures/good-summary.md', '--required-artifacts', '0'],
  ]) {
    const result = spawnSync(process.execPath, ['src/cli.js', ...args], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /--required-artifacts must be a positive integer/);
    assert.match(result.stderr, /Usage:/);
  }
});

function completeReport(overrides = {}) {
  return {
    summary: 'A sufficiently detailed result summary.',
    artifacts: ['README.md'],
    verification: ['Tests passed'],
    risks: ['None known'],
    nextActions: ['No follow-up'],
    ...overrides,
  };
}

function runCli(args) {
  return spawnSync(process.execPath, ['src/cli.js', ...args], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
}
