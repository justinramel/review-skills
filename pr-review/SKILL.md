---
name: pr-review
description: >-
  Fast PR review with a fixed parallel panel: Standards, Spec, and Architecture & DDD. Produces actionable developer findings and deterministic merge status.
  MUST use for a GitHub pull-request URL, "review PR", "review since <ref>", or a request to publish a completed review as a PR comment.
---

# PR Review

Review every change through three independent axes over the complete diff.
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

1. Read [`references/model-policy.md`](references/model-policy.md): use the Review profile for Standards and Spec, the Deep review profile for Architecture & DDD, and the Publication profile for Gitkeeper.
2. Pin the declared base and target, preferably with the bundled evidence collector, and capture the complete diff, commit messages, standards candidates, specification candidates, and current checks.
3. Gather repository standards and the strongest available specification. Fall back to the PR description and complete commit messages when no external issue or user-supplied specification resolves.
4. Gather repository architecture and domain context when it exists; absence never removes the Architecture & DDD axis.
5. Compile the fixed three-reviewer panel and start Standards, Spec, and Architecture & DDD in one fan-out over the complete diff.
6. Enforce [`schemas/reviewer-result.schema.json`](schemas/reviewer-result.schema.json) at invocation time, require exactly one valid result from each axis, then aggregate without losing finding provenance.
7. Publish through the Gitkeeper only when the user explicitly authorized an external change.

Follow the complete fixed-panel procedure in [`references/workflow.md`](references/workflow.md).
Use [`references/reporting.md`](references/reporting.md) for deterministic verdict, merge status, merge readiness, and the developer report.

## Fixed review panel

- `standards-only`: Standards reviews the complete diff against repository rules and the smell baseline.
- `spec-only`: Spec reviews the complete diff against the originating requirement or declared intent.
- `architecture-only`: Architecture & DDD reviews the complete diff for module ownership, seams, dependencies, invariants, and domain modelling.

Use [`references/two-axis.md`](references/two-axis.md) for the Standards and Spec split. Use [`references/architecture-review.md`](references/architecture-review.md) for the Architecture & DDD lens.

## Non-negotiable inputs

Every verdict-bearing brief must include:

- Exactly one fixed review mode and the complete changed-file list.
- The complete diff, pasted into the brief rather than rediscovered by the reviewer.
- Complete standards content at the target revision, or an immutable explicitly authorized URL, for Standards.
- Complete specification content for Spec, using declared intent only as the final fallback.
- Available architecture context and [`references/architecture-review.md`](references/architecture-review.md) for Architecture & DDD.
- [`references/reviewer-role.md`](references/reviewer-role.md) and [`references/review-contract.md`](references/review-contract.md).
- The strict invocation-level schema in [`schemas/reviewer-result.schema.json`](schemas/reviewer-result.schema.json).
- Permission to read the pinned full diff only for necessary cross-file context.

Reviewers must not read the target's local working tree, edit files, run formatters, run tests, or write to git.

## Bundled resources

- [`references/workflow.md`](references/workflow.md): target pinning, input gathering, fixed reviewer briefs, fan-out, aggregation, and publication.
- [`references/tooling.md`](references/tooling.md): evidence, fixed-panel compilation, aggregation, and immutable-snapshot tool interfaces.
- [`references/reporting.md`](references/reporting.md): result validation, aggregation, status bands, report order, and merge readiness.
- [`references/reviewer-role.md`](references/reviewer-role.md): independent reviewer stance and scope limits.
- [`references/review-contract.md`](references/review-contract.md): Standards and Spec rubric, smells, severities, verdicts, and output contract.
- [`references/model-policy.md`](references/model-policy.md): model selection, effort, and runtime evidence.
- [`references/two-axis.md`](references/two-axis.md): fixed Standards and Spec axes.
- [`references/architecture-review.md`](references/architecture-review.md): fixed Architecture & DDD axis.
- [`references/gitkeeper-role.md`](references/gitkeeper-role.md): safe draft or publication of the settled review.
- [`schemas/reviewer-result.schema.json`](schemas/reviewer-result.schema.json): strict invocation-level contract for every verdict-bearing reviewer.
- [`scripts/review-tools.mjs`](scripts/review-tools.mjs): deterministic review mechanics used by the workflow.
- [`scripts/setup-jira.sh`](scripts/setup-jira.sh) and [`scripts/jira-ticket.sh`](scripts/jira-ticket.sh): optional Jira spec setup and retrieval.
