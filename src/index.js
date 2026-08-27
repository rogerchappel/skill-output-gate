import fs from 'node:fs';

const PASS_WORDS = ['pass', 'passed', 'ok', 'success', 'succeeded'];
const FAIL_WORDS = ['fail', 'fails', 'failed', 'failing', 'error', 'errors', 'blocked', 'not run', 'skipped', 'unsuccessful', 'timeout', 'timed out', 'cancelled', 'canceled', 'aborted', 'interrupted', 'incomplete'];
const NEGATED_PASS = /\b(?:did|does|do|has|have|had|was|were|is|are)?\s*(?:not|never)\s+(?:pass(?:ed)?|succeed(?:ed)?|successful|ok)\b/i;
const NON_FAILURE_PHRASES = [
  /\b(?:no|none|zero|0)\s+(?:(?:tests?|checks?)\s+)?(?:fail(?:s|ed|ing)?|failures?|skipped)\b/gi,
  /\b(?:no|zero|0)\s+(?:(?:build|lint|typescript)\s+)?(?:fail(?:s|ed|ing)?|errors?)\b/gi,
  /\bwithout\s+(?:fail(?:s|ed|ing)?|errors?)\b/gi,
  /\berror[- ]free\b/gi,
  /\berror[- ](?:handling|path|case)s?\b/gi,
  /\b(?:previously|formerly)\s+failing\b/gi,
  /\b(?:timeout|cancell?ation|abort)(?:[- ](?:handling|path|case))s?\b/gi,
];
const MARKDOWN_SECTION_HEADINGS = {
  verification: ['verification', 'verification results', 'checks', 'checks performed', 'tests', 'test results'],
  artifacts: ['artifacts', 'artifact references', 'files', 'files changed', 'links', 'outputs'],
  risks: ['risks', 'risk assessment', 'failures', 'limitations', 'known issues'],
  nextActions: ['next', 'next actions', 'follow-up', 'follow up', 'handoff'],
  summary: ['summary', 'result', 'results', 'changes'],
};
const RECOGNIZED_MARKDOWN_HEADINGS = new Set(Object.values(MARKDOWN_SECTION_HEADINGS).flat());
const ARTIFACT_ABSENCE = /^(?:none(?:\s+(?:listed|provided|reported|available|created|changed))?|no\s+(?:artifacts?|files?|links?|outputs?)(?:\s+(?:listed|provided|reported|available|created|changed))?|n\/?a|not applicable)[.!]?$/i;

export function parseRunSummary(text, source = 'inline') {
  const body = String(text || '').replace(/\r\n/g, '\n');
  if (!body.trim()) throw new Error('Run summary is empty');
  if (source.endsWith('.json')) {
    const report = JSON.parse(body);
    validateJsonReport(report);
    return normalize(report, source);
  }
  const prose = stripFencedCode(body);
  const sections = splitSections(prose);
  const title = firstHeading(prose) || basename(source);
  const verification = collectNamed(sections, MARKDOWN_SECTION_HEADINGS.verification);
  const artifacts = collectNamed(sections, MARKDOWN_SECTION_HEADINGS.artifacts);
  const risks = collectNamed(sections, MARKDOWN_SECTION_HEADINGS.risks);
  const nextActions = collectNamed(sections, MARKDOWN_SECTION_HEADINGS.nextActions);
  const summary = collectNamed(sections, MARKDOWN_SECTION_HEADINGS.summary).join(' ') || firstParagraph(prose);
  return normalize({ source, title, summary, verification, artifacts, risks, nextActions }, source);
}

function stripFencedCode(text) {
  const lines = [];
  let fence;

  for (const line of text.split('\n')) {
    if (fence) {
      const closing = line.match(/^ {0,3}(`+|~+)\s*$/);
      if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) fence = undefined;
      lines.push('');
      continue;
    }

    const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (opening && (opening[1][0] !== '`' || !opening[2].includes('`'))) {
      fence = { marker: opening[1][0], length: opening[1].length };
      lines.push('');
      continue;
    }

    lines.push(line);
  }

  return lines.join('\n');
}

export function loadRunSummary(path) {
  return parseRunSummary(fs.readFileSync(path, 'utf8'), path);
}

export function evaluateGate(report, options = {}) {
  const findings = [];
  const requiredArtifacts = parseRequiredArtifacts(options.requiredArtifacts);
  const artifacts = concreteArtifacts(report.artifacts);
  if (!report.summary || report.summary.length < 12) findings.push(fail('missing_summary', 'A concise result summary is required.'));
  if (artifacts.length < requiredArtifacts) findings.push(fail('missing_artifacts', `Expected at least ${requiredArtifacts} concrete artifact reference(s).`));
  if (report.verification.length === 0) findings.push(fail('missing_verification', 'Verification commands or results are required.'));
  if (report.verification.some(item => hasFailedVerification(item))) findings.push(fail('failed_verification', 'A verification entry reports failure or was not run.'));
  if (!report.verification.some(item => hasWord(item, PASS_WORDS))) findings.push(warn('no_passing_check', 'No verification entry clearly reports a passing result.'));
  if (report.risks.length === 0) findings.push(warn('missing_risk_note', 'Add a risk, limitation, or explicit none-known note.'));
  if (report.nextActions.length === 0) findings.push(warn('missing_next_action', 'Add next recommended action or explicit no-follow-up note.'));
  const status = findings.some(item => item.level === 'fail') ? 'fail' : findings.length ? 'warn' : 'pass';
  return { status, findings };
}

function parseRequiredArtifacts(value) {
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) {
    throw new TypeError('requiredArtifacts must be a positive integer');
  }
  const requiredArtifacts = Number(value ?? 1);
  if (!Number.isInteger(requiredArtifacts) || requiredArtifacts < 1) {
    throw new TypeError('requiredArtifacts must be a positive integer');
  }
  return requiredArtifacts;
}

export function readinessScore(report, gate = evaluateGate(report)) {
  const base = gate.status === 'pass' ? 100 : gate.status === 'warn' ? 80 : 40;
  const evidence = Math.min(20, report.verification.length * 5 + concreteArtifacts(report.artifacts).length * 5);
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
  let sectionLevel;
  let sawHeading = false;
  for (const raw of text.split('\n')) {
    const heading = raw.match(/^ {0,3}(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      if (!sawHeading && level === 1) {
        sawHeading = true;
        continue;
      }
      sawHeading = true;
      if (sectionLevel !== undefined && level > sectionLevel) continue;

      current = normalizeHeading(heading[2]);
      if (!sections.has(current)) sections.set(current, []);
      sectionLevel = RECOGNIZED_MARKDOWN_HEADINGS.has(current) ? level : undefined;
      continue;
    }
    sections.get(current).push(raw);
  }
  return sections;
}

function collectNamed(sections, names) {
  const items = [];
  for (const [name, lines] of sections) if (names.includes(name)) items.push(...extractItems(lines));
  return unique(items);
}

function normalizeHeading(heading) {
  return heading.toLowerCase().replace(/\s+#+\s*$/, '').replace(/\s*:\s*$/, '').trim();
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

function validateJsonReport(report) {
  if (report === null || typeof report !== 'object' || Array.isArray(report)) {
    throw new TypeError('JSON report must be an object');
  }
  for (const field of ['source', 'title', 'summary']) {
    if (field in report && typeof report[field] !== 'string') {
      throw new TypeError(`${field} must be a string`);
    }
  }
  for (const field of ['verification', 'artifacts', 'risks', 'nextActions']) {
    if (field in report && (!Array.isArray(report[field]) || report[field].some(item => typeof item !== 'string'))) {
      throw new TypeError(`${field} must be an array of strings`);
    }
  }
}

function hasWord(text, words) { return words.some(word => new RegExp(`\\b${word.replace(' ', '\\s+')}\\b`, 'i').test(text)); }
function hasFailedVerification(text) {
  if (NEGATED_PASS.test(text)) return true;
  const statusText = NON_FAILURE_PHRASES.reduce((result, phrase) => result.replace(phrase, ''), text);
  return hasWord(statusText, FAIL_WORDS);
}
function concreteArtifacts(items) { return items.filter(item => !ARTIFACT_ABSENCE.test(String(item).trim())); }
function unique(items) { return [...new Set(items.map(item => String(item).trim()).filter(Boolean))]; }
function firstHeading(text) { return text.match(/^ {0,3}#\s+(.+)$/m)?.[1]?.trim(); }
function firstParagraph(text) { return text.split('\n').map(line => line.trim()).find(line => line && !line.startsWith('#') && !line.startsWith('-')) || ''; }
function basename(path) { return path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'run-summary'; }
function fail(code, message) { return { level: 'fail', code, message }; }
function warn(code, message) { return { level: 'warn', code, message }; }
