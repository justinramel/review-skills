# Review reporting

Use these rules after every reviewer returns a structured result.

## Reviewer results

Validate every result structurally against [`../schemas/reviewer-result.schema.json`](../schemas/reviewer-result.schema.json), then semantically against [`review-contract.md`](review-contract.md).
Each result must include the reviewer name, exact files, verdict, observed runtime fields, and grounded findings that already contain a developer-facing summary and fix.
Reject a result that omits assigned files, uses an unsupported verdict or severity, reports inferred runtime values, or arrives in an agent-specific wrapper.

Runtime values are observations rather than policy declarations.
Prefer runner metadata, then the reviewer's exact report.
Never infer a model or effort value.
Use `not exposed` when runtime evidence is unavailable.

## Overall verdict

Keep every reviewer result and its provenance.
Compute the overall verdict from the worst reviewer verdict in this order:

```text
request-changes > approve-with-nits > approve
```

Exact duplicate findings may become one developer action only when every source reviewer and location remains visible. Preserve differing evidence or fixes as separate actions.

## Merge status

Apply the first matching status in this order:

- `RED`: any reviewer requested changes, any blocker or major exists, a required check failed, or a security or data-loss risk remains.
- `GRAY`: a reviewer failed, critical scope was not reviewed, or conflicting evidence prevents an honest rating.
- `AMBER`: no RED or GRAY condition exists, but minor or nit findings remain, available relevant validation did not run, or the Spec axis was unavailable for a behavior-changing change.
- `GREEN`: every reviewer approved with no findings, intended scope was covered, every applicable check passed or no applicable automated or runtime validation exists, Spec was reviewed or was not needed, and the Architecture & DDD axis ran or was skipped by its gate.

Render the selected status as the report title:

- 🔴 `Changes required`
- ⚪ `Review incomplete`
- 🟠 `Merge with follow-ups`
- 🟢 `Ready to merge`

The text band remains canonical; the emoji is presentation only.
Status is not an average or finding count.
No applicable validation is neutral rather than AMBER. Record that none exists. Validation that exists and is relevant but did not run remains AMBER.

## Merge readiness

Mark the result merge-ready only when all of these conditions hold:

- No RED or GRAY condition applies.
- Every applicable validation ran and passed, or the review established that no applicable automated or runtime validation exists.
- The Spec axis ran or was not needed.
- The Architecture & DDD axis ran or the recorded architecture gate selected `skip`.

Minor or nit findings alone do not block merging.
The title communicates readiness; do not repeat it as separate verdict, merge-ready, and risk statements.

## Developer report

Write the report for the developer who must act on it:

1. Start with `# <marker> <status title>`.
2. Follow with one sentence containing the blocker, major, minor, and nit counts, pinned target, and validation state.
3. Add `## Required changes` when blocker or major findings exist. Render each as one checklist item with its linked location, summary, evidence and consequence, then its exact fix. Order by severity, then source order.
4. Add `## Non-blocking suggestions` only when minor or nit findings exist. Use the same compact action shape without checkboxes.
5. Add `## Validation` with exact checks, checks that did not run, the pinned target, and any human prerequisite.
6. Add `## Change summary` with two to five diff-grounded bullets.
7. End with a collapsed `Review details` appendix containing the decomposition and architecture-gate reasons, reviewer coverage table, requested and observed runtime profiles, and up to three inspection areas not already represented by findings.

Use this reviewer coverage table:

```text
| Review area | Files | Verdict | Findings |
|---|---|---|---:|
```

Omit empty finding sections rather than printing one "Nothing found" section per reviewer.
Use descriptive Markdown link labels rather than bare URLs. Link local reviewed files at the relevant line or range with an absolute `file:///...#L...` URL. Use a commit-pinned GitHub blob URL only when the reviewed file is unavailable locally.
Ground change summaries and inspection areas in the diff rather than copying the PR description.
The developer report must not expose agent names, model details, review-depth mechanics, or other orchestration notes outside the collapsed appendix.
