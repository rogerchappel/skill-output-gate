# skill-output-gate

Preflight completed agent outputs for evidence, verification, and handoff quality.

## Quickstart

```bash
npm install
npm run smoke
node src/cli.js fixtures/good-summary.md --format json
```

## CLI

```bash
skill-output-gate <summary.md|summary.json> [--format json|markdown] [--required-artifacts n]
```

The command exits with `2` when the output has blocking findings.

## Safety Notes

This package is local-only. It does not send final messages, touch GitHub, publish packages, or mutate external systems.
