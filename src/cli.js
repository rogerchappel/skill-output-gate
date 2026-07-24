#!/usr/bin/env node
import fs from 'node:fs';
import { evaluateGate, loadRunSummary, renderMarkdown, toJsonReport } from './index.js';

const args = process.argv.slice(2);
const file = args.find(arg => !arg.startsWith('-'));
const format = valueAfter(args, '--format') || 'json';
const output = valueAfter(args, '--output');
const requiredArtifacts = valueAfter(args, '--required-artifacts');
const usage = 'Usage: skill-output-gate <summary.md|summary.json> [--format json|markdown] [--required-artifacts positive-integer]';
if (args.includes('--help')) {
  console.log(usage);
  process.exit(0);
}
if (!file) {
  console.log(usage);
  process.exit(1);
}
try {
  if (args.includes('--required-artifacts') && !isPositiveInteger(requiredArtifacts)) {
    throw new TypeError(`--required-artifacts must be a positive integer\n${usage}`);
  }
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
function valueAfter(args, flag) { const index = args.indexOf(flag); return index === -1 ? undefined : args[index + 1]; }
function isPositiveInteger(value) {
  const number = Number(value);
  return value !== undefined && Number.isInteger(number) && number > 0;
}
