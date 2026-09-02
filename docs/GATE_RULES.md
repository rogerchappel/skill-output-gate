# Gate Rules

Blocking findings:

- Missing concise summary
- Missing concrete artifact references. Explicit absence placeholders such as
  `None`, `No artifacts provided`, `N/A`, and `Not applicable` do not count.
- Missing verification results
- Verification that failed, was skipped, or was not run. Negated success
  phrases such as `Tests did not pass` and `Tests were not successful` count as
  failures; a passing check elsewhere in the report does not override them.
  Common explicit non-execution forms—`not executed`, `never run`, `could not
  be run`, and `Tests were omitted`—are blocking as well.
  Explicit zero-result phrases such as `no tests failed`, `0 tests skipped`,
  and `none skipped` are nonfailures, while any adjacent nonzero failure,
  skipped, or not-run result remains blocking.
- Fewer concrete artifact references than `--required-artifacts` requests.
  Absence placeholders remain in parsed report output, but do not contribute to
  this count. The option defaults to `1` and accepts canonical decimal positive
  integer spellings only (no signs, leading zeroes, fractions, or exponents).
  Missing, zero, negative, fractional, and non-numeric values are CLI usage
  errors.

Warning findings:

- No clearly passing verification entry
- Missing risk or limitation note
- Missing next action or no-follow-up note
