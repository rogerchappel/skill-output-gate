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
skill-output-gate <summary.md|summary.json> [--format json|markdown] [--output path] [--required-artifacts positive-integer]
```

`--required-artifacts` defaults to `1`. When supplied, it must be a positive
integer; missing, zero, negative, fractional, and non-numeric values are usage
errors. Use `--output` to write the report to a file instead of standard output.
Options may appear before or after the summary file. Unknown options, extra
positional arguments, and missing or unsupported option values are usage errors.
The command exits with `0` for acceptable output, `1` for invalid options or
unreadable input, and `2` when the output has blocking findings.

## What It Checks

- verification commands are present and tied to the reported work
- negated success wording (for example, `Tests did not pass`) is treated as a
  failed verification, even when another check passed
- explicit failure wording and common inflections (for example, `1 test
  failing`, `tests failed`, `build errors`, or `verification unsuccessful`)
  produce a blocking `failed_verification` finding; ordinary nonfailure phrases
  such as `no errors`, `no tests failed`, `0 tests skipped`, `none skipped`,
  and `error-handling tests passed` are excluded
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

`npm run package:smoke` runs a dry-run package build and fails if required
runtime files, fixtures, examples, or support documents are missing from the
tarball. Run it when changing fixtures, examples, or release documentation so
the published package still carries the material users need to understand the
gate.

## Safety Notes

This package is local-only. It does not send final messages, touch GitHub, publish packages, or mutate external systems.

It is a preflight heuristic, not a proof of correctness. A passing result means
the output has the expected evidence shape; it does not prove the underlying code
change is correct or that every verification command was run honestly. Failure
classification is phrase-based rather than a full natural-language analysis, so
unusual or ambiguous wording may need to be rewritten as an explicit pass or
failure result.
