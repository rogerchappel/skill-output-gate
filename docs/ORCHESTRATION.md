# Orchestration

1. Collect the agent final summary, artifact links, command results, risk notes, and next actions.
2. Run `skill-output-gate <summary> --format markdown`.
3. Treat `fail` findings as blockers before sending the final response.
4. Carry `warn` findings into the final note when they are intentional.

The gate is designed for local-only preflight checks and evidence discipline.
