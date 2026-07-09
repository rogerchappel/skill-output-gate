import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['pack', '--dry-run'], { encoding: 'utf8' });
const output = `${result.stdout || ''}\n${result.stderr || ''}`;

if (result.status !== 0) {
  process.stderr.write(output);
  process.exit(result.status || 1);
}

const requiredEntries = [
  'src/cli.js',
  'src/index.js',
  'fixtures/good-summary.md',
  'fixtures/bad-summary.md',
  'examples/report.json',
  'docs/GATE_RULES.md',
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
];

const missing = requiredEntries.filter((entry) => !output.includes(entry));
if (missing.length > 0) {
  process.stderr.write(`package smoke missing entries:\n${missing.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('package smoke passed\n');
