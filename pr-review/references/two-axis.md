# Standards and Spec axes

Every review runs two independent whole-diff reviewers:

- **Standards** receives `Review mode: standards-only`.
  It judges the complete diff against repository rules and the smell baseline in [`review-contract.md`](review-contract.md).
  It does not assess requirement coverage.
- **Spec** receives `Review mode: spec-only`.
  It judges the complete diff against the strongest available requirement source.
  It does not assess repository standards or smells.

Use Jira, a linked issue, or a user-supplied specification when available.
Otherwise use the PR title, PR body, and complete commit messages as declared intent; for a local range, use complete commit messages.
Label this fallback honestly, but always run Spec.

Architecture & DDD runs beside these two axes as a third independent whole-diff reviewer.
Start all three in one fan-out.

## Why the axes stay separate

A change can pass one axis and fail another:

- Code can follow every standard while implementing the wrong behaviour.
- Code can implement the requested behaviour while breaking repository conventions.
- Both can pass while module ownership, dependency direction, or domain invariants regress.

Keep every reviewer result and its finding provenance.
Compute the overall verdict from the worst result:
`request-changes` > `approve-with-nits` > `approve`.
