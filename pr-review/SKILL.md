---
name: pr-review
description: >-
  Reviews pull requests and diffs with parallel independent reviewers, conditionally adding an architecture and DDD axis, then reports findings, confidence, verdicts, and merge risk.
  Use when the user asks to review a PR, URL, branch, diff, or changes since a ref, or explicitly asks to publish the completed review as a PR comment.
---

# PR Review

Review existing changes with independent reviewers that own separate slices or axes.
Do not edit application files, run formatters, or write to git during a review.

## Quick start

```text
review https://github.com/OWNER/REPO/pull/123
review since origin/main
review and comment on https://github.com/OWNER/REPO/pull/123
```

The last form authorizes a top-level PR comment.
A plain review request never authorizes publication.

## Required workflow

1. Read [`references/model-policy.md`](references/model-policy.md) and use the strongest available high-reasoning profile for every verdict-bearing agent.
2. Pin the declared base and target, collect the complete diff and commit messages, and inspect current check evidence.
3. Gather repository standards and the first available spec source.
4. Choose locality decomposition by default, or use the two-axis panel for a focused change with a spec.
5. Apply the architecture gate; only when it selects `run`, gather architecture and domain context and add an Architecture & DDD reviewer.
6. Start every reviewer in one fan-out with its exact mode, scope, hunks, applicable standards, spec, and review references.
7. Validate each structured result, then aggregate it without merging or reranking findings.
8. Publish through the Gitkeeper only when the user explicitly authorized an external change.

Follow the complete orchestration procedure in [`references/workflow.md`](references/workflow.md).
Use [`references/reporting.md`](references/reporting.md) for deterministic verdict, risk, merge-readiness, and report rules.

## Review modes

- `locality`: one coherent file bucket per reviewer; apply Standards and, when supplied, Spec.
- `standards-only`: review the whole assigned diff only against repository rules and the smell baseline.
- `spec-only`: review the whole assigned diff only against the originating issue or plan.
- `architecture-only`: review the architecture-relevant diff against the conditional architecture and DDD lens.

Use [`references/two-axis.md`](references/two-axis.md) for the Standards-only and Spec-only split. Use [`references/architecture-review.md`](references/architecture-review.md) to decide whether to add the Architecture & DDD axis and to brief it.

## Non-negotiable inputs

Every verdict-bearing brief must include:

- Exactly one review mode and the exact files it owns.
- The assigned diff hunks, pasted into the brief rather than rediscovered by the reviewer.
- Complete standards content at the target revision, or an immutable explicitly authorized URL, for modes that run Standards.
- Complete spec content for modes that run Spec.
- Architecture context and [`references/architecture-review.md`](references/architecture-review.md) for `architecture-only`.
- [`references/reviewer-role.md`](references/reviewer-role.md) and [`references/review-contract.md`](references/review-contract.md).
- Permission to read the full diff only for necessary cross-file context.

Reviewers must not read the target's local working tree, edit files, run formatters, run tests, or write to git.

## Bundled resources

- [`references/workflow.md`](references/workflow.md): target pinning, evidence gathering, decomposition, reviewer briefs, and publication flow.
- [`references/reporting.md`](references/reporting.md): result validation, aggregation, risk bands, report order, and merge readiness.
- [`references/reviewer-role.md`](references/reviewer-role.md): independent reviewer stance and scope limits.
- [`references/review-contract.md`](references/review-contract.md): Standards and Spec rubric, smells, severities, verdicts, and output contract.
- [`references/model-policy.md`](references/model-policy.md): model selection, effort, and runtime evidence.
- [`references/two-axis.md`](references/two-axis.md): focused Standards-only and Spec-only decomposition.
- [`references/architecture-review.md`](references/architecture-review.md): conditional gate and Architecture/DDD rubric.
- [`references/gitkeeper-role.md`](references/gitkeeper-role.md): safe draft or publication of the settled review.
- [`scripts/setup-jira.sh`](scripts/setup-jira.sh) and [`scripts/jira-ticket.sh`](scripts/jira-ticket.sh): optional Jira spec setup and retrieval.
