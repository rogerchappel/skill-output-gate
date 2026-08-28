# Changelog

## Unreleased

- Recognize explicit nonzero exits and returns, positive failure counts, and
  did-not-complete wording as failed verification results.
- Exclude explicit artifact-absence placeholders from required artifact counts.
- Accept explicit zero-failure and zero-skip verification results.
- Treat negated success phrases as failed verification results.
- Reject invalid required-artifact thresholds in the API and CLI.
- Treat timeout, cancellation, aborted, interrupted, and incomplete checks as
  failed verification while preserving passing status-wording exceptions.
- Reject malformed JSON report containers and non-string section members.

## 0.1.0

- Initial parser, gate engine, CLI, fixtures, tests, and skill documentation.
