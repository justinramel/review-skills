# Review workflow

Use this procedure after the main skill selects `pr-review`.
Review existing changes only.

## Prerequisites

The harness needs parallel reviewers, complete diff access, the model control in [`model-policy.md`](model-policy.md), and invocation-level JSON Schema enforcement.
If parallel agents are unavailable, run the same fixed reviewers sequentially and keep the report contract unchanged.

## Tool-assisted path

Prefer [`review-tools.mjs`](../scripts/review-tools.mjs) for evidence collection, fixed-panel compilation, aggregation, and immutable target snapshots when Node.js 20 or newer is available.
Read [`tooling.md`](tooling.md) for its JSON interfaces and commands.
The tools perform repeatable mechanics; the orchestrator selects source material, validates results, and writes the human-facing report.

## 1. Pin the change

### GitHub pull request

Read `pr://<owner>/<repo>/<n>` for the title, body, linked issue, declared base, declared head, and head SHA.
Read `pr://<owner>/<repo>/<n>/diff/all` for the complete unified diff.
Fetch every PR commit's complete message and the current check rollup for the head SHA.
Use the declared base and head rather than assuming a default branch.
Treat verification claims in the PR body as context rather than proof.

### Local range

For `review since <ref>`, use `<ref>` as base and `HEAD` as target.
For a named branch or ref, use it as target and resolve the repository's default branch as base.
Capture the complete three-dot diff and complete commit messages.

Stop before spawning reviewers when a ref does not resolve or the diff is empty.

## 2. Gather fixed-panel inputs

### Repository standards

Read the target revision's `AGENTS.md`, `CONTRIBUTING.md`, and other coding-standard documents completely.
Supply their complete content or an immutable target-revision URL to Standards.

### Specification

Use the first source that resolves:

1. A Jira ticket referenced by the title, branch, or complete commit messages.
2. A linked or referenced GitHub issue.
3. A user-supplied specification or matching repository spec.
4. The PR title, PR body, and complete commit messages as declared-intent fallback.

For a local range, use complete commit messages as the final fallback.
Always run Spec and label the fallback source honestly.

### Architecture and domain context

Gather applicable architecture decisions, ADRs, module maps, and domain glossaries from the target revision.
When none exist, say so in the brief and apply the bundled Architecture & DDD lens directly to the complete diff.
Always run Architecture & DDD.

## 3. Compile the fixed panel

The panel is always:

1. Standards — `standards-only`, Review profile.
2. Spec — `spec-only`, Review profile.
3. Architecture & DDD — `architecture-only`, Deep review profile.

All three receive the complete changed-file list and complete diff.
Each receives only the source material for its axis.
The panel compiler creates these reviewers; the orchestrator does not choose modes, buckets, owners, depth, or reviewer count.

## 4. Start the panel

Load [`../schemas/reviewer-result.schema.json`](../schemas/reviewer-result.schema.json) once.
Pass it as every task's strict invocation-level output schema.
Start all three reviewers in one fan-out.
On Oh My Pi, use the bundled `reviewer` agent for Standards and Spec and the bundled `task` agent for Architecture & DDD.
Set high effort when the runner exposes it.
Never change the user's model configuration during a review.

Reviewers may read the pinned full diff only for necessary cross-file context.
They must not read the target's local working tree, edit files, run formatters, run builds, run linters, run tests, or write to git.

## 5. Validate and aggregate

Require exactly one structurally and semantically valid result named `Standards`, `Spec`, and `Architecture & DDD`.
Reject wrappers, renamed axes, duplicate axes, missing axes, and malformed results.
Preserve every finding's reviewer and location. Consolidate exact duplicates into one developer action only when all provenance remains visible.
Use the deterministic aggregator for verdict, finding counts, merge status, and merge readiness.
Follow [`reporting.md`](reporting.md) for the developer report.

Use an immutable snapshot only when exact-head runtime validation adds evidence beyond available checks.
Remove the snapshot after validation.

## 6. Draft or publish a PR comment

Do this only when the user requested a comment draft or publication.
Start one non-verdict-bearing Gitkeeper after the technical report is settled.
Give it the PR URL, final report, changed-file list, publication authorization, and [`gitkeeper-role.md`](gitkeeper-role.md).

Use a top-level PR comment rather than a formal approval or request-changes review.
Update the authenticated user's prior comment containing `<!-- pr-review-skill -->` instead of creating a duplicate.
Without explicit authorization or a write-capable GitHub client, return the complete draft without changing GitHub.
