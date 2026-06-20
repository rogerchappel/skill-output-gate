import fs from 'node:fs';

const PASS_WORDS = ['pass', 'passed', 'ok', 'success', 'succeeded'];
const FAIL_WORDS = ['fail', 'failed', 'error', 'blocked', 'not run', 'skipped'];

export function parseRunSummary(text, source = 'inline') {
  const body = String(text || '').replace(/\r\n/g, '\n');
  if (!body.trim()) throw new Error('Run summary is empty');
  if (source.endsWith('.json')) return normalize(JSON.parse(body), source);
  const sections = splitSections(body);
  const title = firstHeading(body) || basename(source);
  const verification = collectNamed(sections, ['verification', 'checks', 'tests']);
  const artifacts = collectNamed(sections, ['artifacts', 'files', 'links', 'outputs']);
  const risks = collectNamed(sections, ['risks', 'failures', 'limitations', 'known issues']);
  const nextActions = collectNamed(sections, ['next', 'follow-up', 'handoff']);
  const summary = collectNamed(sections, ['summary', 'result', 'changes']).join(' ') || firstParagraph(body);
  return normalize({ source, title, summary, verification, artifacts, risks, nextActions }, source);
}

export function loadRunSummary(path) {
  return parseRunSummary(fs.readFileSync(path, 'utf8'), path);
}

export function evaluateGate(report, options = {}) {
  const findings = [];
  const requiredArtifacts = Number(options.requiredArtifacts ?? 1);
  if (!report.summary || report.summary.length < 12) findings.push(fail('missing_summary', 'A concise result summary is required.'));
  if (report.artifacts.length < requiredArtifacts) findings.push(fail('missing_artifacts', `Expected at least ${requiredArtifacts} artifact reference(s).`));
  if (report.verification.length === 0) findings.push(fail('missing_verification', 'Verification commands or results are required.'));
  if (report.verification.some(item => hasWord(item, FAIL_WORDS))) findings.push(fail('failed_verification', 'A verification entry reports failure or was not run.'));
  if (!report.verification.some(item => hasWord(item, PASS_WORDS))) findings.push(warn('no_passing_check', 'No verification entry clearly reports a passing result.'));
  if (report.risks.length === 0) findings.push(warn('missing_risk_note', 'Add a risk, limitation, or explicit none-known note.'));
  if (report.nextActions.length === 0) findings.push(warn('missing_next_action', 'Add next recommended action or explicit no-follow-up note.'));
  const status = findings.some(item => item.level === 'fail') ? 'fail' : findings.length ? 'warn' : 'pass';
  return { status, findings };
}

export function readinessScore(report, gate = evaluateGate(report)) {
  const base = gate.status === 'pass' ? 100 : gate.status === 'warn' ? 80 : 40;
  const evidence = Math.min(20, report.verification.length * 5 + report.artifacts.length * 5);
  const penalties = gate.findings.filter(item => item.level === 'fail').length * 15;
  return Math.max(0, Math.min(100, base + evidence - penalties));
}

export function renderMarkdown(report, gate = evaluateGate(report)) {
  const list = (items, empty = '- None listed') => items.length ? items.map(item => `- ${item}`).join('\n') : empty;
  return `# ${report.title}\n\nStatus: ${gate.status}\nScore: ${readinessScore(report, gate)}\n\n## Summary\n\n${report.summary}\n\n## Verification\n\n${list(report.verification)}\n\n## Artifacts\n\n${list(report.artifacts)}\n\n## Risks\n\n${list(report.risks)}\n\n## Next Actions\n\n${list(report.nextActions)}\n\n## Findings\n\n${gate.findings.length ? gate.findings.map(item => `- ${item.level}: ${item.code} - ${item.message}`).join('\n') : '- pass: output is ready to hand off'}\n`;
}

export function toJsonReport(report, options) {
  const gate = evaluateGate(report, options);
  return { report, gate, score: readinessScore(report, gate) };
}

function splitSections(text) {
  const sections = new Map([['body', []]]);
  let current = 'body';
  for (const raw of text.split('\n')) {
    const heading = raw.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    sections.get(current).push(raw);
  }
  return sections;
}

function collectNamed(sections, names) {
  const items = [];
  for (const [name, lines] of sections) if (names.some(key => name.includes(key))) items.push(...extractItems(lines));
  return unique(items);
}

function extractItems(lines) {
  return lines.map(line => line.trim()).filter(Boolean).map(line => line.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '')).filter(line => line.length > 2);
}

function normalize(report, source) {
  return {
    source: report.source || source,
    title: report.title || basename(source),
    summary: report.summary || '',
    verification: unique(report.verification || []),
    artifacts: unique(report.artifacts || []),
    risks: unique(report.risks || []),
    nextActions: unique(report.nextActions || [])
  };
}

function hasWord(text, words) { return words.some(word => new RegExp(`\\b${word.replace(' ', '\\s+')}\\b`, 'i').test(text)); }
function unique(items) { return [...new Set(items.map(item => String(item).trim()).filter(Boolean))]; }
function firstHeading(text) { return text.match(/^#\s+(.+)$/m)?.[1]?.trim(); }
function firstParagraph(text) { return text.split('\n').map(line => line.trim()).find(line => line && !line.startsWith('#') && !line.startsWith('-')) || ''; }
function basename(path) { return path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'run-summary'; }
function fail(code, message) { return { level: 'fail', code, message }; }
function warn(code, message) { return { level: 'warn', code, message }; }
