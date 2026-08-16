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

test('explicit artifact absence cannot satisfy required artifact counts', () => {
  for (const artifacts of [
    ['None'],
    ['None listed'],
    ['No artifacts provided'],
    ['N/A'],
    ['Not applicable'],
    ['None', 'src/index.js'],
  ]) {
    const report = completeReport({ artifacts });
    const concreteCount = artifacts.includes('src/index.js') ? 1 : 0;

    assert.deepEqual(report.artifacts, artifacts);
    assert.equal(evaluateGate(report).status, concreteCount ? 'pass' : 'fail', artifacts.join('; '));
    assert.equal(
      evaluateGate(report, { requiredArtifacts: 2 }).findings.some(item => item.code === 'missing_artifacts'),
      true,
      artifacts.join('; ')
    );
  }
});

test('renders markdown and JSON reports', () => {
  const report = parseRunSummary(fs.readFileSync('fixtures/good-summary.md', 'utf8'), 'fixtures/good-summary.md');
  assert.match(renderMarkdown(report), /Status: pass/);
  assert.equal(toJsonReport(report).gate.status, 'pass');
});

test('fenced examples cannot supply required handoff evidence', () => {
  for (const fence of ['```markdown', '~~~~ md example']) {
    const marker = fence[0].repeat(fence.match(/^(`+|~+)/)[0].length);
    const report = parseRunSummary(`# Example\n\n${fence}\n## Summary\n\nImplemented the requested feature.\n\n## Verification\n\n- npm test: passed\n\n## Artifacts\n\n- src/index.js\n\n## Risks\n\n- None known\n\n## Next Actions\n\n- No follow-up\n${marker}`);
    const gate = evaluateGate(report);

    assert.equal(report.summary, '');
    assert.deepEqual(report.verification, []);
    assert.deepEqual(report.artifacts, []);
    assert.deepEqual(report.risks, []);
    assert.deepEqual(report.nextActions, []);
    assert.equal(gate.status, 'fail');
    assert.ok(gate.findings.some(item => item.code === 'missing_summary'));
    assert.ok(gate.findings.some(item => item.code === 'missing_verification'));
    assert.ok(gate.findings.some(item => item.code === 'missing_artifacts'));
    assert.ok(gate.findings.some(item => item.code === 'missing_risk_note'));
    assert.ok(gate.findings.some(item => item.code === 'missing_next_action'));
  }
});

test('mixed documents collect only evidence outside longer fenced blocks', () => {
  const report = parseRunSummary([
    '# Result', '', '## Summary', '', 'Implemented the actual change.', '',
    '`````markdown example', '## Summary', 'Fabricated fenced summary.',
    '## Verification', '- fenced check passed', '## Artifacts', '- fenced.txt',
    '## Risks', '- fenced risk', '## Next Actions', '- fenced action', '``````', '',
    '## Verification', '- npm test: passed', '', '~~~~~text',
    '- fence delimiter content', '~~~~~~~', '', '## Artifacts', '- src/index.js', '',
    '## Risks', '- None known', '', '## Next Actions', '- No follow-up',
  ].join('\n'));

  assert.equal(report.summary, 'Implemented the actual change.');
  assert.deepEqual(report.verification, ['npm test: passed']);
  assert.deepEqual(report.artifacts, ['src/index.js']);
  assert.deepEqual(report.risks, ['None known']);
  assert.deepEqual(report.nextActions, ['No follow-up']);
  assert.equal(evaluateGate(report).status, 'pass');
  for (const items of [report.verification, report.artifacts, report.risks, report.nextActions]) {
    assert.ok(items.every(item => !item.includes('```') && !item.includes('~~~')));
  }
});

test('unrelated heading substrings cannot supply required evidence', () => {
  const markdown = [
    '# Result', '', '## Summary', '', 'Implemented the requested parser correction.', '',
    '## Testsuite roadmap', '', '- tests passed', '',
    '## Filesystems', '', '- src/index.js', '',
    '## Risks', '', '- None known', '', '## Handoff', '', '- No follow-up',
  ].join('\n');
  const report = parseRunSummary(markdown);
  const gate = evaluateGate(report);

  assert.deepEqual(report.verification, []);
  assert.deepEqual(report.artifacts, []);
  assert.equal(gate.status, 'fail');
  assert.ok(gate.findings.some(item => item.code === 'missing_verification'));
  assert.ok(gate.findings.some(item => item.code === 'missing_artifacts'));
});

test('accepts documented Markdown evidence heading variants', () => {
  for (const [verificationHeading, artifactHeading] of [
    ['Verification', 'Artifacts'],
    ['Verification Results', 'Artifact References'],
    ['Checks Performed:', 'Files Changed ###'],
    ['Test Results', 'Outputs'],
  ]) {
    const report = parseRunSummary([
      '# Result', '', '## Summary', '', 'Implemented the requested parser correction.', '',
      `## ${verificationHeading}`, '', '- npm test: passed', '',
      `## ${artifactHeading}`, '', '- src/index.js', '',
      '## Risk Assessment', '', '- None known', '',
      '## Next Actions', '', '- No follow-up',
    ].join('\n'));

    assert.deepEqual(report.verification, ['npm test: passed'], verificationHeading);
    assert.deepEqual(report.artifacts, ['src/index.js'], artifactHeading);
    assert.equal(evaluateGate(report).status, 'pass', `${verificationHeading}; ${artifactHeading}`);
  }
});

test('keeps evidence beneath nested subsections until the parent section ends', () => {
  const report = parseRunSummary([
    '# Result', '', '## Summary', '', 'Implemented nested section parsing.', '',
    '## Verification', '', '### Node 20', '', '- npm test: passed', '',
    '### Node 22', '', '- npm run release:check: passed', '',
    '## Artifacts', '', '### Parser', '', '- src/index.js', '',
    '### Coverage', '', '- test/index.test.js', '',
    '## Risks', '', '- None known', '', '## Next Actions', '', '- No follow-up',
  ].join('\n'));

  assert.deepEqual(report.verification, ['npm test: passed', 'npm run release:check: passed']);
  assert.deepEqual(report.artifacts, ['src/index.js', 'test/index.test.js']);
  assert.deepEqual(report.risks, ['None known']);
  assert.equal(evaluateGate(report).status, 'pass');
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

test('cli rejects explicit artifact absence at configured counts', () => {
  const summary = new URL('../.tmp-absent-artifacts.md', import.meta.url);
  fs.writeFileSync(summary, [
    '# Result', '', '## Summary', '', 'Completed the requested implementation.', '',
    '## Verification', '', '- npm test: passed', '',
    '## Artifacts', '', '- None', '- src/index.js', '',
    '## Risks', '', '- None', '', '## Next Actions', '', '- None',
  ].join('\n'));

  try {
    const result = runCli([summary.pathname, '--format', 'json', '--required-artifacts', '2']);
    assert.equal(result.status, 2);
    assert.equal(result.stderr, '');
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.report.artifacts, ['None', 'src/index.js']);
    assert.deepEqual(output.report.risks, ['None']);
    assert.deepEqual(output.report.nextActions, ['None']);
    assert.ok(output.gate.findings.some(item => item.code === 'missing_artifacts'));
  } finally {
    fs.rmSync(summary, { force: true });
  }
});

test('cli rejects unrelated heading substrings as missing evidence', () => {
  const summary = new URL('../.tmp-false-headings.md', import.meta.url);
  fs.writeFileSync(summary, [
    '# Result', '', '## Summary', '', 'Implemented the requested parser correction.', '',
    '## Testsuite roadmap', '', '- tests passed', '',
    '## Filesystems', '', '- src/index.js', '',
    '## Risks', '', '- None known', '', '## Handoff', '', '- No follow-up',
  ].join('\n'));

  try {
    const result = runCli([summary.pathname, '--format', 'markdown']);
    assert.equal(result.status, 2);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /missing_verification/);
    assert.match(result.stdout, /missing_artifacts/);
  } finally {
    fs.rmSync(summary, { force: true });
  }
});

test('cli accepts evidence grouped into nested subsections', () => {
  const summary = new URL('../.tmp-nested-sections.md', import.meta.url);
  fs.writeFileSync(summary, [
    '# Result', '', '## Summary', '', 'Implemented nested section parsing.', '',
    '## Verification', '', '### Runtime', '', '- npm test: passed', '',
    '### Packaging', '', '- npm run package:smoke: passed', '',
    '## Artifacts', '', '### Source', '', '- src/index.js', '',
    '### Tests', '', '- test/index.test.js', '',
    '## Risks', '', '- None known', '', '## Next Actions', '', '- No follow-up',
  ].join('\n'));

  try {
    const result = runCli([summary.pathname, '--format', 'json']);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.report.verification, ['npm test: passed', 'npm run package:smoke: passed']);
    assert.deepEqual(output.report.artifacts, ['src/index.js', 'test/index.test.js']);
    assert.equal(output.gate.status, 'pass');
  } finally {
    fs.rmSync(summary, { force: true });
  }
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

test('fails explicit incomplete verification statuses', () => {
  for (const verification of [
    'npm test timed out',
    'Build timeout',
    'Lint was cancelled',
    'Checks canceled by the operator',
    'Verification aborted',
    'Test run interrupted',
    'Build incomplete',
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
    'Tests passed; no tests failed',
    'Tests passed; zero checks failing',
    'Tests passed; 0 tests skipped',
    'Tests passed; none skipped',
    'Timeout-handling tests passed',
    'Cancellation path tests passed',
    'Abort case passed',
  ]) {
    assert.equal(evaluateGate(completeReport({ verification: [verification] })).status, 'pass', verification);
  }
});

test('rejects invalid JSON report shapes and section members', () => {
  for (const [input, message] of [
    [[], 'JSON report must be an object'],
    [{ summary: 'Complete result summary.', verification: {}, artifacts: [], risks: [], nextActions: [] }, 'verification must be an array of strings'],
    [{ summary: 'Complete result summary.', verification: ['Tests passed'], artifacts: [{}], risks: [], nextActions: [] }, 'artifacts must be an array of strings'],
    [{ summary: 'Complete result summary.', verification: ['Tests passed'], artifacts: ['README.md'], risks: [null], nextActions: [] }, 'risks must be an array of strings'],
    [{ summary: 'Complete result summary.', verification: ['Tests passed'], artifacts: ['README.md'], risks: [], nextActions: [42] }, 'nextActions must be an array of strings'],
  ]) {
    assert.throws(() => parseRunSummary(JSON.stringify(input), 'summary.json'), new RegExp(message));
  }
});

test('cli reports invalid JSON shape as a concise input error', () => {
  const summary = new URL('../.tmp-invalid-summary.json', import.meta.url);
  fs.writeFileSync(summary, JSON.stringify({
    summary: 'Completed the requested implementation.',
    verification: [{ command: 'npm test', status: 'passed' }],
    artifacts: ['src/index.js'],
    risks: ['None known'],
    nextActions: ['None'],
  }));

  try {
    const result = runCli([summary.pathname, '--format', 'json']);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^skill-output-gate: verification must be an array of strings\n$/);
    assert.doesNotMatch(result.stderr, /\[object Object\]/);
  } finally {
    fs.rmSync(summary, { force: true });
  }
});

test('zero-result wording does not hide adjacent verification failures', () => {
  for (const verification of [
    'No tests failed; 1 test skipped',
    '0 tests skipped; build failed',
    'None skipped, but tests are failing',
    'Zero checks failing; verification was not run',
  ]) {
    const gate = evaluateGate(completeReport({ verification: [verification] }));
    assert.equal(gate.status, 'fail', verification);
    assert.ok(gate.findings.some(item => item.code === 'failed_verification'));
  }
});

test('cli accepts zero failed and skipped verification counts', () => {
  for (const verification of ['Tests passed; no tests failed', 'Tests passed; 0 tests skipped', 'Tests passed; none skipped']) {
    const summary = new URL('../.tmp-zero-result-summary.md', import.meta.url);
    fs.writeFileSync(summary, `# Result\n\n## Summary\n\nCompleted the requested implementation.\n\n## Verification\n\n- ${verification}\n\n## Artifacts\n\n- src/index.js\n\n## Risks\n\n- None known\n\n## Next Actions\n\n- None\n`);

    try {
      const result = runCli([summary.pathname, '--format', 'json']);
      assert.equal(result.status, 0, verification);
      assert.equal(result.stderr, '');
      assert.equal(JSON.parse(result.stdout).gate.status, 'pass');
    } finally {
      fs.rmSync(summary, { force: true });
    }
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
