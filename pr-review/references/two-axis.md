# The two-axis panel

For a small, single-purpose PR that has a linked issue or spec, a locality panel is overkill.
Run two reviewers with explicit, non-overlapping modes:

- **Standards** receives `Review mode: standards-only`.
  It judges the whole diff against the repo's documented rules and the smell baseline in [`review-contract.md`](review-contract.md).
  It must not assess the Spec axis.
- **Spec** receives `Review mode: spec-only`.
  It judges the whole diff against the originating issue or plan.
  It must not assess Standards or smells.

Each brief MUST state its review mode.
The assigned mode selects which parts of [`reviewer-role.md`](reviewer-role.md) and [`review-contract.md`](review-contract.md) apply.
Both reviewers see the whole diff and return the same structured result. If the gate in [`architecture-review.md`](architecture-review.md) selects `run`, add a third independent `architecture-only` reviewer for the architecture-relevant hunks. The base panel still renders as two rows:

```
| Agent | Files | Verdict | Confidence (self-estimate) |
|---|---|---|---|
| Standards | (whole diff) | approve | 0.9 |
| Spec | (whole diff) | approve-with-nits | 0.8 |
```

## Why the axes stay separate

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing results in a Standards pass and Spec failure.
- Code that implements the spec but breaks repository conventions results in a Spec pass and Standards failure.

Keep every row and its findings separate, including the conditional Architecture & DDD row.
Do not merge or rerank findings across axes.
Compute the overall verdict from the worse row using this fixed order:
`request-changes` > `approve-with-nits` > `approve`.
A `request-changes` verdict from either axis makes the overall review not merge-ready.

## If there is no spec

Skip the Spec-only reviewer, run Standards-only, and say plainly in the report that no spec was available.
