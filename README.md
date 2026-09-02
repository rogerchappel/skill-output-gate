# skill-output-gate

Preflight completed agent outputs for evidence, verification, and handoff quality.

## Quickstart

```bash
npm ci
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
npm install -g github:rogerchappel/skill-output-gate
```

The package is not yet published to the npm registry. Until the first registry
release, install the current source directly from GitHub as shown above.

## CLI

```bash
skill-output-gate <summary.md|summary.json> [--format json|markdown] [--output path] [--required-artifacts positive-integer]
```

`--required-artifacts` defaults to `1`. When supplied, it must use the canonical
decimal spelling of a positive integer (`1`, `2`, ...); missing, signed,
zero-padded, exponent, zero, fractional, and non-numeric values are usage errors.
Use `--output` to write the report to a file instead of standard output.
Options may appear before or after the summary file. Unknown options, extra
positional arguments, and missing or unsupported option values are usage errors.
Standalone `--help` prints usage; combining it with any other argument is a
usage error.
The command exits with `0` for acceptable output, `1` for invalid options or
unreadable input, and `2` when the output has blocking findings.

JSON input must be an object. `source`, `title`, and `summary`, when present,
must be strings. `verification`, `artifacts`, `risks`, and `nextActions`, when
present, must be arrays containing only strings. Invalid containers or members
are input errors: the CLI prints a concise message to standard error and exits
with status `1` without producing a gate report.

## What It Checks

- verification commands are present and tied to the reported work
- negated success wording (for example, `Tests did not pass`) is treated as a
  failed verification, even when another check passed
- explicit failure wording and common inflections (for example, `1 test
  failing`, `tests failed`, `build errors`, or `verification unsuccessful`)
  produce a blocking `failed_verification` finding; ordinary nonfailure phrases
  such as `no errors`, qualified zero-error results (`no build errors`, `no lint
  errors`, or `no TypeScript errors`), `no tests failed`, `0 tests skipped`,
  `none skipped`, and `error-handling tests passed` are excluded
- explicit nonzero process results (`exited with status 1` or `returned
  non-zero`), positive failure counts (`3 failures`), and `did not complete`
  wording also produce a blocking `failed_verification`; zero statuses and zero
  failure counts remain acceptable when accompanied by a passing result
- explicit incomplete results such as a timeout, cancellation, aborted or
  interrupted run, or incomplete verification also produce a blocking
  `failed_verification` finding; descriptions of passing timeout handling,
  cancellation paths, and abort cases remain acceptable
- explicit non-execution results such as `Tests were not executed`, `Tests were
  never run`, `Tests could not be run`, and `Tests were omitted` also produce a
  blocking `failed_verification`; positive execution wording remains acceptable
  when it reports a passing result
- artifact references are concrete enough for review; explicit absence
  placeholders such as `None`, `No artifacts provided`, `N/A`, and `Not
  applicable` do not count
- handoff text includes remaining risks or follow-up when needed
- concrete artifact counts meet the configured threshold; absence placeholders
  remain available in parsed output but cannot satisfy the gate

For Markdown input, headings and list content inside backtick or tilde fenced
code blocks are treated as examples and ignored. This includes fences longer
than three characters and opening fences with info strings. Only unfenced prose
can satisfy the summary, verification, artifact, risk, and next-action checks.

Markdown sections are matched by their complete heading, not by words embedded
in an unrelated heading. Accepted headings are:

- summary: `Summary`, `Result`, `Results`, or `Changes`
- verification: `Verification`, `Verification Results`, `Checks`, `Checks
  Performed`, `Tests`, or `Test Results`
- artifacts: `Artifacts`, `Artifact References`, `Files`, `Files Changed`,
  `Links`, or `Outputs`
- risks: `Risks`, `Risk Assessment`, `Failures`, `Limitations`, or `Known Issues`
- next actions: `Next`, `Next Actions`, `Follow-up`, `Follow Up`, or `Handoff`

Heading matching is case-insensitive, accepts zero to three leading spaces, and
accepts a trailing colon or optional closing Markdown hash marks. Four-space
indentation is a code block rather than an ATX heading. For example, `Testsuite
roadmap` is not a `Tests` section, and `Filesystems` is not a `Files` section.

Content beneath nested subheadings remains part of the recognized parent
section until another heading at the parent's level or higher begins. This
allows evidence to be grouped under labels such as `### Node 20`, `### Node
22`, or `### Package contents` without losing the verification or artifact
entries below them. A document's initial level-one heading is treated as its
title rather than as a report section.

## Verify

Run the local release-readiness checks before publishing or promoting the CLI:

```bash
npm run check
npm test
npm run smoke
npm run package:smoke
npm run release:check
```

`npm run package:smoke` builds a tarball in a disposable directory, verifies
its required runtime files and support documents, installs it into a clean
consumer project, and exercises the installed binary against the bundled
passing and blocking fixtures. Run it when changing fixtures, examples, or
release documentation so the published package remains independently usable.

## Safety Notes

This package is local-only. It does not send final messages, touch GitHub, publish packages, or mutate external systems.

It is a preflight heuristic, not a proof of correctness. A passing result means
the output has the expected evidence shape; it does not prove the underlying code
change is correct or that every verification command was run honestly. Failure
classification is phrase-based rather than a full natural-language analysis, so
unusual or ambiguous wording may need to be rewritten as an explicit pass or
failure result. Markdown parsing recognizes fenced code blocks, but it is not a
complete CommonMark parser; other Markdown constructs are interpreted using the
tool's heading-and-list heuristics.
