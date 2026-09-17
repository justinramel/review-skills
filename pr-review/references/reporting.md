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

Render the selected status only as the report's final line: 🔴 `RED`, ⚪ `GRAY`, 🟠 `AMBER`, or 🟢 `GREEN`, followed by the deciding reason.
The text label remains canonical; the emoji is presentation only.
Status is an attention band, not a merge recommendation, average, or finding count.
No applicable validation is neutral rather than AMBER. Record that none exists. Validation that exists and is relevant but did not run remains AMBER.

## Merge readiness

Mark the result merge-ready only when all of these conditions hold:

- No RED or GRAY condition applies.
- Every applicable validation ran and passed, or the review established that no applicable automated or runtime validation exists.
- The Spec axis ran or was not needed.
- The Architecture & DDD axis ran or the recorded architecture gate selected `skip`.

Minor or nit findings alone do not block merging.
Always report `Merge-ready: Yes` or `Merge-ready: No` with the aggregator's `mergeReadyReason` immediately before the reviewer table. This keeps AMBER findings that are safe to follow up separate from AMBER evidence gaps that still block merging.

## Developer report

Write the report for the developer who must act on it:

1. Start with `## Change summary`: two to five diff-grounded bullets.
2. State the selected review depth, decomposition, and architecture-gate result with one concrete reason each.
3. Add `## Required changes` when blocker or major findings exist. Render each as one checklist item with its linked location, summary, evidence and consequence, then its exact fix. Order by severity, then source order.
4. Add `## Non-blocking suggestions` only when minor or nit findings exist. Use the same compact action shape without checkboxes.
5. Add `## Areas worth human inspection`: two to five changed functions, scripts, or sections with a concrete reason. Do not repeat a finding without adding a distinct inspection concern.
6. Add `## Validation evidence` with exact checks, checks that did not run, the pinned target, and any human prerequisite.
7. Add `## Next action` with the smallest correction or decision that moves the pull request forward.
8. Add `## Review environment` with requested profiles and observed model and effort values.
9. End with `## Verdict and merge status`, containing:
   - the overall verdict and blocker, major, minor, and nit counts;
   - `Merge-ready: Yes|No` with the deciding reason;
   - the reviewer coverage table;
   - the coloured status band and its single deciding reason as the final line.

Use this reviewer coverage table:

```text
| Review area | Files | Verdict | Findings |
|---|---|---|---:|
```

Omit empty finding sections rather than printing one "Nothing found" section per reviewer.
Use descriptive Markdown link labels rather than bare URLs. Link local reviewed files at the relevant line or range with an absolute `file:///...#L...` URL. Use a commit-pinned GitHub blob URL only when the reviewed file is unavailable locally.
Ground change summaries and inspection areas in the diff rather than copying the PR description.
Use Markdown headings, prose, bullets or checklists, links, and tables. Never wrap report content in HTML or disclosure tags.
Nothing follows the final merge-status line.
