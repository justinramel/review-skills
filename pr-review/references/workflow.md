# Review workflow

Use this procedure after the main skill selects `pr-review`.
Review existing changes only.

## Prerequisites

The harness needs:

1. A way to run independent reviewers in parallel.
2. A PR resolver or git access that can produce the complete diff.
3. The model control described in [`model-policy.md`](model-policy.md).

If parallel agents are unavailable, run the same reviewers sequentially and keep the report contract unchanged.

## 1. Pin the change

### GitHub pull request

Read `pr://<owner>/<repo>/<n>` for the title, body, linked issue, declared base, declared head, and head SHA.
Read `pr://<owner>/<repo>/<n>/diff/all` for the unified diff.
Use the PR's declared base and head rather than assuming a default branch.
Fetch every PR commit's complete message through the resolver or GitHub pull-request commits API.
Fetch the current check-run or status rollup for the head SHA when available.
Record completed success, failure, pending, and missing evidence separately.
Treat verification claims in the PR body as context rather than proof that checks passed.

### Local range

For `review since <ref>`, set `base` to `<ref>` and `target` to `HEAD`.
For a named branch or ref, set `target` to that ref and resolve the repository's default branch as `base`.
Verify both refs resolve.
Capture `git diff <base>...<target>`, `git log <base>..<target> --oneline`, and complete commit messages with `git log <base>..<target> --format='%B%x00'`.

Stop before spawning reviewers when a ref does not resolve or the diff is empty.

## 2. Gather review inputs

### Repository standards

Find the target revision's `AGENTS.md`, `CONTRIBUTING.md`, and other coding-standard documents.
Read each source completely.
Paste the content, labeled with path and target revision, into every Standards brief.
When a source is too large to paste, provide an immutable target-revision URL and explicitly authorize that URL.
Never give a reviewer only a path or mutable branch URL.

### Specification

Use the first source that resolves:

1. Scan the PR title, head branch, and every complete commit message for a Jira key matching `[A-Z]+-\d+`.
2. Fetch a matching ticket with `scripts/jira-ticket.sh <KEY>` and include its summary, description, and acceptance criteria.
3. Otherwise use a linked or referenced GitHub issue.
4. Otherwise use a spec path supplied by the user or a spec file that matches the branch.

If Jira credentials are missing, tell the user to run `scripts/setup-jira.sh`, then continue with reachable review work.
If no spec exists, state that fact and omit the Spec axis.

## 3. Choose a decomposition

Use locality by default for changes spanning multiple modules or concerns.
Keep each implementation file with its tests and group files that changed for one reason.
Aim for at most six reviewers and merge thin buckets.
Give each bucket a short CamelCase name such as `ConfigInfra`.

Use the two-axis panel for a small, focused change with a spec.
Follow [`two-axis.md`](two-axis.md) and assign one `standards-only` reviewer and one `spec-only` reviewer.

State the chosen decomposition and reason in the report's first line.

## 4. Build reviewer briefs

Every brief must contain only the reviewer's required context:

- One mode: `locality`, `standards-only`, or `spec-only`.
- Exact owned files and their complete diff hunks.
- Permission to read the full diff only for necessary cross-file context.
- Complete standards content or an immutable explicitly authorized URL for every Standards pass.
- Complete spec content for every Spec pass.
- The full reviewer role and review contract, or direct bundled references the reviewer can read.
- An instruction to return the exact structured result from the contract.

Do not let reviewers read the target's local working tree or target-repository files outside their scope.
Do not let reviewers edit files, run formatters, run tests, or write to git.

## 5. Start the panel

Apply the model policy before fan-out.
Set each reviewer model and effort explicitly when the runner exposes those controls.
For Oh My Pi, pass `effort: "hi"` when the task schema exposes it.
Otherwise use the configured reviewer profile and report unavailable runtime evidence as `not exposed`.
Never change the user's model configuration during a review.

Start every reviewer in one fan-out call.
Use one task per independent locality bucket or review axis.

## 6. Validate and aggregate results

Confirm every result matches the schema in [`review-contract.md`](review-contract.md).
A completed worker is not accepted evidence until its assigned file list, verdict, severity, and findings match the contract.
Do not merge or rerank findings across reviewers.
Follow [`reporting.md`](reporting.md) for the deterministic overall verdict, risk band, merge readiness, and final report.

## 7. Draft or publish a PR comment

Do this only when the user requested a comment draft or publication.
Start one non-verdict-bearing general-purpose worker named `Gitkeeper` after the technical report is settled.
Give it the PR URL, final report, changed-file list, publication authorization, and [`gitkeeper-role.md`](gitkeeper-role.md).
The Gitkeeper may read the full PR diff only to quote a small example already supported by a finding.

Use a top-level PR comment rather than a formal approval or request-changes review.
Update the authenticated user's prior comment containing `<!-- pr-review-skill -->` instead of creating a duplicate.
Without explicit authorization or a write-capable GitHub client, return the complete draft without changing GitHub.
