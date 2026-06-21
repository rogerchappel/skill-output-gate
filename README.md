# skill-output-gate

Preflight completed agent outputs for evidence, verification, and handoff quality.

## Quickstart

```bash
npm install
npm run smoke
node src/cli.js fixtures/good-summary.md --format json
```

## Install

```bash
npm install -g skill-output-gate
```

## CLI

```bash
skill-output-gate <summary.md|summary.json> [--format json|markdown] [--required-artifacts n]
```

The command exits with `2` when the output has blocking findings.

## Verify

Run the local release-readiness checks before publishing or promoting the CLI:

```bash
npm run check
npm test
npm run smoke
npm run package:smoke
npm run release:check
```

## Safety Notes

This package is local-only. It does not send final messages, touch GitHub, publish packages, or mutate external systems.
