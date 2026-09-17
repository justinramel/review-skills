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
- `AMBER`: no RED or GRAY condition exists, but minor or nit findings remain, available relevant validation did not run, or the Spec axis was unavailable for a behavior-changing change.
- `GREEN`: every reviewer approved with no findings, intended scope was covered, every applicable check passed or no applicable automated or runtime validation exists, Spec was reviewed or was not needed, and the Architecture & DDD axis ran or was skipped by its gate.

Render the selected band with its coloured marker: 🔴 `RED`, ⚪ `GRAY`, 🟠 `AMBER`, or 🟢 `GREEN`. The text label remains canonical; the emoji is presentation only.

Risk is not an average, confidence score, or finding count.
No applicable validation is neutral rather than AMBER. Record that none exists. Validation that exists and is relevant but did not run remains AMBER.

## Merge readiness

Mark the result merge-ready only when all of these conditions hold:

- No RED or GRAY condition applies.
- Every applicable validation ran and passed, or the review established that no applicable automated or runtime validation exists.
- The Spec axis ran or was not needed.
- The Architecture & DDD axis ran or the recorded architecture gate selected `skip`.

Minor or nit findings alone do not block merging.

## Final report order

Lead with evidence and put the verdict table and traffic-light risk at the end. Write the report in this order:

1. Two to five diff-grounded change-summary bullets, followed by the decomposition choice and architecture-gate result with their reasons.
2. Findings grouped by reviewer with location, severity, and evidence.
3. Two to five changed functions, scripts, or sections worth human inspection, each with a concrete reason. Make every referenced file a Markdown link to the local reviewed file at the relevant line or range, using an absolute `file:///...#L...` URL. Use a commit-pinned GitHub blob URL only when the reviewed file is not available locally. Link each file separately when an item spans files.
4. Exact validation evidence, including checks that did not run.
5. Smallest next action and any human checks still required.
6. Requested orchestrator and reviewer profiles, followed by observed model and effort values.
7. A final `Verdict and merge risk` section containing, in order:
   - overall verdict plus blocker, major, minor, and nit counts;
   - merge-ready recommendation;
   - one verdict-table row per reviewer;
   - the coloured merge-risk band and its single deciding rule as the report's final line.

Use this table shape:

```text
| Agent | Files | Verdict | Confidence (self-estimate) |
|---|---|---|---|
```

Use "Nothing found" for an empty reviewer finding group rather than padding it.
Ground change summaries and inspection areas in the diff rather than copying the PR description.
Nothing follows the merge-risk line, so the final scan always lands on the table and risk decision.
