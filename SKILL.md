# Skill Output Gate

Use this skill after an agent finishes work and before the final result is sent, merged, or handed off.

## Required Inputs

- A Markdown or JSON run summary
- Verification command results
- Artifact references
- Risks, limitations, or explicit none-known note
- Next action or explicit no-follow-up note

## Side-Effect Boundaries

The skill reads local files and emits reports. It must not send messages, merge pull requests, publish releases, or perform external writes.

## Workflow

1. Run `skill-output-gate <summary> --format markdown`.
2. Fix `fail` findings before final handoff.
3. Include intentional `warn` findings in the final response.
4. Attach JSON output to audit evidence when useful.

## Validation

Run `npm test`, `npm run check`, and `npm run smoke` before packaging changes.
