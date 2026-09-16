---
name: pr-review
description: Review a pull request or a diff with a panel of independent reviewers running in parallel, then report their verdicts side by side as a verdict + confidence table. Use when the user asks to review a PR, a GitHub PR URL, a branch, or "review since X", and wants a fast, breadth-first panel review rather than a single pass.
---

# PR Review

Review a diff with a **panel of independent reviewers running in parallel**, then
aggregate their verdicts into a single table. This is the flow that produces:

```
| Agent | Files | Verdict | Confidence |
|---|---|---|---|
| ConfigInfra | .env.example, config.ts, ... | approve | 0.95 |
| RedriveFlash | redrive-event.route.ts + test | approve | 0.98 |
```

Each reviewer starts with **fresh context** and owns a slice of the change, so
no reviewer's context pollutes another's, and independent slices are reviewed at
the same time instead of one after another.

Review **existing changes only**. Do not edit application files, run formatters,
or perform git writes.

## When to use which decomposition

Pick one before spawning anything:

- **By locality (default, breadth-first).** Group the changed files into buckets
  by directory / module / feature, one reviewer per bucket. Best for large PRs
  that span several modules. This is what produces the multi-row verdict table.
- **By axis (focused PRs with a spec).** Two reviewers receive explicit,
  non-overlapping modes: **Standards-only** and **Spec-only**. Best for a small,
  single-purpose PR that has a linked issue or spec. See
  `references/two-axis.md`.

State which you chose and why in the first line of the report.

## Prerequisites

This skill needs a harness that can:

1. **Run subagents in parallel** — one fan-out call that starts N background
   reviewers (e.g. omp's `task` tool, or any agent runner with concurrent
   subagents). Without parallel subagents, run the reviewers sequentially; the
   report is identical, only slower.
2. **Read the diff** — either a PR resolver (`pr://<owner>/<repo>/<n>/diff/all`
   and per-file `pr://<owner>/<repo>/<n>/diff/<index>`) or plain
   `git diff <base>...<target>`. Nothing here depends on a specific IDE or app.

## Process

### 1. Pin the change and get the diff

- **GitHub PR URL / `owner/repo#n`** → read `pr://<owner>/<repo>/<n>` for
  metadata (title, body, linked issue, base branch, and head branch) and
  `pr://<owner>/<repo>/<n>/diff/all` for the unified diff. Use the PR's declared
  base and head; never replace its base with an assumed `main`. Fetch every PR
  commit's complete message through the PR resolver or GitHub pull-request
  commits API before selecting the spec source. The diff does not contain commit
  messages.
- **`review since <ref>`** → set `base` to `<ref>` and `target` to `HEAD`.
- **Named branch / ref** → set `target` to the supplied ref and `base` to the
  repository's default branch. Resolve the default branch from repository or
  remote metadata; never assume it is `main`.

Verify both refs resolve, then capture `git diff <base>...<target>` (three-dot,
against the merge-base), `git log <base>..<target> --oneline` for the report,
and `git log <base>..<target> --format='%B%x00'` for complete, delimited commit
messages used during spec discovery.

Stop here if either ref does not resolve or the diff is empty — fail before
spawning reviewers, not inside them.

### 2. Find the inputs each reviewer needs

- **Standards sources**: find the repo's `AGENTS.md`, `CONTRIBUTING.md`, and
  other coding-standards docs. Read their complete contents at the target
  revision before spawning reviewers. Paste the contents, labeled with path and
  revision, into every brief that performs a Standards pass. If a source is too
  large to paste, provide an immutable target-revision URL and explicitly allow
  the reviewer to read that URL. Never pass only a path or a mutable branch URL.
- **Spec source** (for the Spec-only reviewer, or every locality reviewer), in
  order:
  1. **Jira ticket** — scan the PR title, head branch name, and every complete
     commit message for a Jira key (`[A-Z]+-\d+`, e.g. `FGP-1392`). A key in a
     commit trailer is in the message body, so an oneline commit list is not
     sufficient. Fetch that ticket with
     [`scripts/jira-ticket.sh <KEY>`](scripts/jira-ticket.sh) and paste its
     output (summary, description, acceptance criteria) into every brief that
     performs a Spec pass. If the script reports no credentials, tell the user
     to run [`scripts/setup-jira.sh`](scripts/setup-jira.sh) once, then continue.
  2. **GitHub issue** — a linked or referenced issue (`issue://<owner>/<repo>/<n>`).
  3. **A path the user gave**, or a spec file matching the branch.

  Use the first that resolves. If none exists, say so and skip the Spec axis.

### 3. Decompose

For a **locality** panel, bucket the changed files:

- Keep a test file in the same bucket as the implementation it covers.
- Group files that change for one reason (a feature, a module, a config theme).
- Cap the panel at a sensible width — **aim for ≤6 reviewers**; merge thin
  buckets rather than spawning a reviewer for one trivial file.
- Give each bucket a short CamelCase name (`ConfigInfra`, `RedriveFlash`) — it
  becomes the row label in the table.

### 4. Spawn the panel in parallel

Start every reviewer in **one fan-out**, not one at a time. Each reviewer's
brief MUST contain, and MUST be limited to:

- Exactly one review mode: `locality`, `standards-only`, or `spec-only`.
  Locality reviewers run both axes when a spec exists and Standards only when it
  does not. Axis reviewers run only the named axis.
- The exact files it owns, and the **diff hunks** for them (paste them, so the
  reviewer never re-runs git).
- Permission to read the full diff via `pr://…/diff/all` or `pr://…/diff/<index>`
  **only** for cross-file context, plus any immutable standards URLs explicitly
  supplied under the previous step. Never allow access to the local working tree
  or other buckets' files.
- The complete standards contents, labeled with path and target revision, or an
  immutable URL with explicit read permission, for every reviewer that performs
  a Standards pass. Include the spec path/contents for every reviewer that
  performs a Spec pass.
- The reviewer role and contract:
  [`references/reviewer-role.md`](references/reviewer-role.md) (the stance) and
  [`references/review-contract.md`](references/review-contract.md) (the rubric
  and output shape). Paste them or point the reviewer at them — the reviewer has
  no other access to them.
- The instruction to return the **structured result** in §5.

Never let a reviewer edit files, run formatters, or write to git.

### 5. Reviewer output contract

Every reviewer returns exactly this shape (the contract spells out each field):

```json
{
  "name": "ConfigInfra",
  "files": ["src/common/config.ts", "vitest.config.ts"],
  "verdict": "approve | approve-with-nits | request-changes",
  "confidence": 0.0,
  "findings": [
    { "severity": "blocker|major|minor|nit",
      "location": "path:line",
      "evidence": "what is wrong and why, grounded in the hunk" }
  ]
}
```

`confidence` is the reviewer's **own self-estimate** that its verdict is right.
It is **not a calibrated metric** — report it, but label it as a self-estimate
and never treat it as a quality score.

### 6. Aggregate and report

Gather every reviewer's result. Do **not** merge or rerank findings across
reviewers; the panel exists so one slice or axis cannot mask another. Compute
the overall verdict from the worst reviewer verdict using this fixed order:
`request-changes` > `approve-with-nits` > `approve`. The result is merge-ready
if and only if no reviewer returned `request-changes`.

Then write the report:

1. **One-line header**: overall verdict + which decomposition you used + counts
   (blockers / majors / minors / nits).
2. **Verdict table**:

   ```
   | Agent | Files | Verdict | Confidence |
   |---|---|---|---|
   ```

   One row per reviewer. `Confidence` is the self-estimate from §5.
3. **Findings**, grouped by reviewer, each with `location`, `severity`, and
   `evidence`. "Nothing found" is a valid, useful result — never pad.
4. **Recommendation**: merge-ready or not, and any checks the reviewers said a
   human must confirm (things the diff alone cannot settle).

If tests were not run, say so plainly. The panel reviews the diff; it does not
prove the build.

## Notes

- The table borders and colour are the terminal's rendering of plain Markdown —
  the report is portable to any client.
- The Fowler smell baseline and test-quality smells live in the review contract,
  so every reviewer applies the same bar. A documented repo standard always
  overrides the baseline; baseline smells are judgement calls, never hard
  violations; skip anything the repo's own tooling already enforces.
