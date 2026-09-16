# Review reporting

Use these rules after every reviewer returns a structured result.

## Reviewer results

Validate every result against the exact schema in [`review-contract.md`](review-contract.md).
Each result must include the reviewer name, exact files, verdict, confidence, observed runtime fields, and grounded findings.
Reject a result that omits assigned files, uses an unsupported verdict or severity, or reports inferred runtime values.

`confidence` is the reviewer's own estimate that its verdict is right.
It is not a calibrated quality score.

Runtime values are observations rather than policy declarations.
Prefer runner metadata, then the reviewer's exact report.
Never infer a model or effort value.
Use `not exposed` when runtime evidence is unavailable.

## Overall verdict

Keep every reviewer row and finding group separate.
Compute the overall verdict from the worst reviewer verdict in this order:

```text
request-changes > approve-with-nits > approve
```

Do not average verdicts or confidence values.

## Merge risk

Apply the first matching band in this order:

- `RED`: any reviewer requested changes, any blocker or major exists, a required check failed, or a security or data-loss risk remains.
- `GRAY`: a reviewer failed, critical scope was not reviewed, or conflicting evidence prevents an honest rating.
- `AMBER`: no RED or GRAY condition exists, but minor or nit findings remain, relevant validation did not run, or the Spec axis was unavailable for a behavior-changing change.
- `GREEN`: every reviewer approved with no findings, intended scope was covered, relevant checks passed, and Spec was reviewed or was not needed.

Risk is not an average, confidence score, or finding count.
A diff-only review without test evidence cannot be GREEN.

## Merge readiness

Mark the result merge-ready only when all of these conditions hold:

- No RED or GRAY condition applies.
- Relevant validation ran and passed.
- The Spec axis ran or was not needed.

Minor or nit findings alone do not block merging.

## Final report order

Write the report in this order:

1. One-line overall verdict, decomposition choice, and blocker, major, minor, and nit counts.
2. Merge-risk band with the single deciding rule.
3. Requested orchestrator and reviewer profiles, followed by observed model and effort values.
4. Two to five diff-grounded change-summary bullets.
5. One verdict-table row per reviewer.
6. Findings grouped by reviewer with location, severity, and evidence.
7. Two to five changed functions, scripts, or sections worth human inspection, each with a concrete reason.
8. Merge-ready recommendation, smallest next action, and any human checks still required.
9. Exact validation evidence, including checks that did not run.

Use this table shape:

```text
| Agent | Files | Verdict | Confidence |
|---|---|---|---|
```

Label confidence as a self-estimate wherever it appears.
Use "Nothing found" for an empty reviewer finding group rather than padding it.
Ground change summaries and inspection areas in the diff rather than copying the PR description.
