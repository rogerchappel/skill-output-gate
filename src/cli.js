#!/usr/bin/env node
import fs from 'node:fs';
import { evaluateGate, loadRunSummary, renderMarkdown, toJsonReport } from './index.js';

const args = process.argv.slice(2);
const usage = 'Usage: skill-output-gate <summary.md|summary.json> [--format json|markdown] [--output path] [--required-artifacts positive-integer]';
if (args.length === 1 && args[0] === '--help') {
  console.log(usage);
  process.exit(0);
}
try {
  const { file, format, output, requiredArtifacts } = parseArguments(args);
  const report = loadRunSummary(file);
  const options = requiredArtifacts === undefined ? {} : { requiredArtifacts };
  const gate = evaluateGate(report, options);
  const rendered = format === 'markdown' ? renderMarkdown(report, gate) : JSON.stringify(toJsonReport(report, options), null, 2);
  if (output) fs.writeFileSync(output, `${rendered}\n`);
  else console.log(rendered);
  process.exit(gate.status === 'fail' ? 2 : 0);
} catch (error) {
  console.error(`skill-output-gate: ${error.message}`);
  process.exit(1);
}

function parseArguments(args) {
  const options = { format: 'json' };
  const seen = new Set();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith('-')) {
      if (options.file) throw usageError(`unexpected positional argument: ${argument}`);
      options.file = argument;
      continue;
    }
    if (!['--format', '--output', '--required-artifacts'].includes(argument)) {
      throw usageError(`unknown option: ${argument}`);
    }
    if (seen.has(argument)) throw usageError(`option may only be supplied once: ${argument}`);
    seen.add(argument);

    const value = args[index + 1];
    if (argument === '--output' && (value === undefined || value.startsWith('-'))) {
      throw usageError('--output requires a path');
    }
    if (argument === '--format' && !['json', 'markdown'].includes(value)) {
      throw usageError('--format must be json or markdown');
    }
    if (argument === '--required-artifacts' && !isPositiveInteger(value)) {
      throw usageError('--required-artifacts must be a positive integer');
    }
    options[optionName(argument)] = value;
    index += 1;
  }

  if (!options.file) throw usageError('a summary file is required');
  return options;
}

function optionName(flag) {
  return flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function usageError(message) {
  return new TypeError(`${message}\n${usage}`);
}

function isPositiveInteger(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}
