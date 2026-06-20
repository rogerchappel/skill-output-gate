#!/usr/bin/env node
import fs from 'node:fs';
import { evaluateGate, loadRunSummary, renderMarkdown, toJsonReport } from './index.js';

const args = process.argv.slice(2);
const file = args.find(arg => !arg.startsWith('-'));
const format = valueAfter(args, '--format') || 'json';
const output = valueAfter(args, '--output');
const requiredArtifacts = valueAfter(args, '--required-artifacts');
if (!file || args.includes('--help')) {
  console.log('Usage: skill-output-gate <summary.md|summary.json> [--format json|markdown] [--required-artifacts n]');
  process.exit(file ? 0 : 1);
}
try {
  const report = loadRunSummary(file);
  const options = requiredArtifacts ? { requiredArtifacts } : {};
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
