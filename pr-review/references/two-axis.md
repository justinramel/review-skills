# The two-axis panel

For a small, single-purpose PR that has a linked issue or spec, a locality panel
is overkill. Run **two** reviewers instead, split by axis rather than by file:

- **Standards** — the whole diff, judged against the repo's documented rules and
  the smell baseline in [`review-contract.md`](review-contract.md). It answers:
  *does this match how this repo writes code?*
- **Spec** — the whole diff, judged against the originating issue / plan. It
  answers: *does it do what was asked, and only that?*

Both reviewers see the whole diff; they differ only in what they are looking
for. Both follow the same output contract and return the same structured result,
so the report still renders as a two-row verdict table:

```
| Agent | Files | Verdict | Confidence |
|---|---|---|---|
| Standards | (whole diff) | approve | 0.9 |
| Spec | (whole diff) | approve-with-nits | 0.8 |
```

## Why the axes stay separate

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing →
  **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's
  conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other. Do not merge or
rerank the two reviewers' findings; report the worst issue within each axis and
let the reader combine them.

## If there is no spec

Skip the Spec reviewer, run Standards only, and say plainly in the report that no
spec was available.
