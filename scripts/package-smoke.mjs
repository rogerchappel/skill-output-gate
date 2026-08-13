import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'skill-output-gate-package-smoke-'));
const packageDirectory = join(temporaryDirectory, 'package');
const consumerDirectory = join(temporaryDirectory, 'consumer');

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

try {
  mkdirSync(packageDirectory);
  mkdirSync(consumerDirectory);
  const pack = run('npm', ['pack', '--json', '--pack-destination', packageDirectory]);
  const metadata = JSON.parse(pack.stdout);
  const packedFiles = new Set(metadata[0].files.map(({ path }) => path));
  const missing = requiredEntries.filter((entry) => !packedFiles.has(entry));
  if (missing.length > 0) {
    throw new Error(`package smoke missing entries:\n${missing.join('\n')}`);
  }

  const tarball = join(packageDirectory, metadata[0].filename);
  run('npm', ['init', '--yes'], { cwd: consumerDirectory });
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
    cwd: consumerDirectory,
  });

  const binary = join(
    consumerDirectory,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'skill-output-gate.cmd' : 'skill-output-gate',
  );
  const installedPackage = join(consumerDirectory, 'node_modules', 'skill-output-gate');
  const help = run(binary, ['--help'], { cwd: consumerDirectory });
  if (!help.stdout.startsWith('Usage: skill-output-gate')) {
    throw new Error(`installed binary returned unexpected help output:\n${help.stdout}`);
  }

  run(binary, [join(installedPackage, 'fixtures', 'good-summary.md'), '--format', 'json'], {
    cwd: consumerDirectory,
  });
  run(
    binary,
    [join(installedPackage, 'fixtures', 'bad-summary.md'), '--format', 'json'],
    { cwd: consumerDirectory, expectedStatus: 2 },
  );

  process.stdout.write('package consumer smoke passed\n');
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

function run(command, args, options = {}) {
  const { expectedStatus = 0, ...spawnOptions } = options;
  const result = spawnSync(command, args, { encoding: 'utf8', ...spawnOptions });
  if (result.error) throw result.error;
  if (result.status !== expectedStatus) {
    throw new Error(
      `${command} ${args.join(' ')} exited ${result.status}; expected ${expectedStatus}\n` +
        `${result.stdout || ''}${result.stderr || ''}`,
    );
  }
  return result;
}
