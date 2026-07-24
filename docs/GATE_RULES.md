# Gate Rules

Blocking findings:

- Missing concise summary
- Missing artifact references
- Missing verification results
- Verification that failed, was skipped, or was not run. Negated success
  phrases such as `Tests did not pass` and `Tests were not successful` count as
  failures; a passing check elsewhere in the report does not override them.
- Fewer artifact references than `--required-artifacts` requests. The option
  defaults to `1` and accepts positive integers only. Missing, zero, negative,
  fractional, and non-numeric values are CLI usage errors.

Warning findings:

- No clearly passing verification entry
- Missing risk or limitation note
- Missing next action or no-follow-up note
