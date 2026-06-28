# skill-output-gate

Preflight completed agent outputs for evidence, verification, and handoff quality.

## Quickstart

```bash
npm install
npm run smoke
node src/cli.js fixtures/good-summary.md --format json
```

For a blocking report, run the bundled failing fixture:

```bash
node src/cli.js fixtures/bad-summary.md --format markdown
```

That command exits with status `2` and prints findings that a caller can surface
before an agent finalizes work.

## Install

```bash
npm install -g skill-output-gate
```

## CLI

```bash
skill-output-gate <summary.md|summary.json> [--format json|markdown] [--required-artifacts n]
```

The command exits with `0` for acceptable output, `1` for unreadable input, and
`2` when the output has blocking findings.

## What It Checks

- verification commands are present and tied to the reported work
- artifact references are concrete enough for review
- handoff text includes remaining risks or follow-up when needed
- required artifact counts meet the configured threshold

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

It is a preflight heuristic, not a proof of correctness. A passing result means
the output has the expected evidence shape; it does not prove the underlying code
change is correct or that every verification command was run honestly.
