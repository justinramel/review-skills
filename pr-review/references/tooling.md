# Review tools

The bundled `scripts/review-tools.mjs` performs repeatable review mechanics.
It does not choose a decomposition, decide the architecture gate, judge findings, or publish to GitHub.
Every command writes JSON to stdout unless `--out <file>` is supplied.

Run commands from the `pr-review` skill directory.
Node.js 20 or newer is required.
Private GitHub repositories require `GH_TOKEN` or `GITHUB_TOKEN` with read access.

## Collect evidence

### GitHub pull request

```bash
node scripts/review-tools.mjs collect \
  --pr https://github.com/OWNER/REPO/pull/123 \
  --wait-checks 120 \
  --out /tmp/pr-review-evidence.json
```

The bounded check wait is optional.
The command pins the declared base and head, fetches complete commit messages, the unified diff, check runs and statuses, target-revision standards candidates, and Jira/GitHub issue candidates.
It does not decide which candidate is authoritative.

### Local range

```bash
node scripts/review-tools.mjs collect \
  --range origin/main...HEAD \
  --repo /path/to/repository \
  --out /tmp/pr-review-evidence.json
```

The local collector reads committed objects with `git show` and `git ls-tree`; standards therefore come from the target revision rather than the working tree.
It rejects an empty range.

### Evidence shape

The common fields are:

```json
{
  "source": "github-pr | local-range",
  "pullRequest": {
    "url": "https://github.com/OWNER/REPO/pull/123",
    "title": "...",
    "body": "...",
    "baseRef": "main",
    "baseSha": "...",
    "headRef": "feature/example",
    "headSha": "..."
  },
  "commits": [{ "sha": "...", "message": "complete message" }],
  "diff": {
    "raw": "diff --git ...",
    "files": [
      {
        "path": "src/example.ts",
        "status": "modified",
        "targetLineRanges": [{ "start": 10, "end": 14, "count": 5 }],
        "targetBlobUrl": "https://github.com/OWNER/REPO/blob/SHA/src/example.ts#L10-L14",
        "diff": "complete owned file diff"
      }
    ]
  },
  "checks": {
    "state": "success | failure | pending | missing",
    "runs": []
  },
  "standards": [
    {
      "path": "AGENTS.md",
      "revision": "...",
      "immutableUrl": "...",
      "content": "complete content"
    }
  ],
  "specCandidates": {
    "jiraKeys": [],
    "linkedIssues": []
  }
}
```

Local evidence uses `range` instead of `pullRequest`.
`standardsDiscoveryTruncated: true` means GitHub truncated its recursive tree response; gather missing standards before briefing reviewers.

## Compile a panel

The orchestrator still chooses the review depth, decomposition, modes, files, specification, and architecture context.
Write those decisions as a plan. `reviewDepth` defaults to `fast`; set `thorough` only when the user explicitly requested it.

```json
{
  "reviewDepth": "fast",
  "fullDiffUri": "pr://OWNER/REPO/123/diff/all",
  "specification": {
    "path": "issue://OWNER/REPO/99",
    "content": "Complete issue or ticket text"
  },
  "architectureContext": [
    {
      "path": "docs/architecture.md",
      "content": "Complete applicable content"
    }
  ],
  "reviewers": [
    {
      "name": "Standards",
      "mode": "standards-only",
      "files": ["src/example.ts", "src/example.test.ts"]
    },
    {
      "name": "Spec",
      "mode": "spec-only",
      "files": ["src/example.ts", "src/example.test.ts"]
    }
  ]
}
```

Compile task-ready briefs:

```bash
node scripts/review-tools.mjs compile-panel \
  --evidence /tmp/pr-review-evidence.json \
  --plan /tmp/pr-review-plan.json \
  --out /tmp/pr-review-panel.json
```

The compiler:

- defaults to fast depth and rejects more than three verdict-bearing reviewers;
- permits up to six reviewers only for an explicitly thorough plan;
- rejects unknown files and incomplete whole-diff axes;
- requires every changed file to have exactly one locality owner when locality mode is used;
- requires a specification for `spec-only` and architecture context for `architecture-only`;
- embeds each reviewer's exact diff hunks and applicable sources;
- returns `reviewDepth`, `profile`, `task`, `outputSchema`, and `schemaMode: "strict"`.

The orchestrator maps `profile` to the runner configuration and starts the returned reviewers in one fan-out.

## Aggregate results

Create an aggregation input after every strict reviewer result has returned:

```json
{
  "reviewers": [],
  "checks": { "state": "success", "runs": [] },
  "spec": {
    "status": "reviewed | not-needed | unavailable",
    "behaviorChanging": true
  },
  "architecture": {
    "gate": "run | skip",
    "reviewed": true
  },
  "validation": [
    { "name": "CI", "status": "passed | failed | pending | not-run | not-applicable" }
  ],
  "criticalScopeReviewed": true,
  "conflictingEvidence": false,
  "securityOrDataLossRisk": false
}
```

Run:

```bash
node scripts/review-tools.mjs aggregate \
  --input /tmp/pr-review-results.json \
  --out /tmp/pr-review-aggregate.json
```

The aggregator validates structure and verdict/finding consistency, preserves reviewer results, counts severities, applies the fixed verdict and status rules, and returns `mergeStatus`, merge readiness, and one deciding rule.
It does not merge, deduplicate, rerank, or rewrite findings; the developer report may consolidate only exact duplicates while retaining their provenance.
A malformed reviewer result produces `GRAY` and `valid: false`; it is never translated into the expected schema.

## Materialize an immutable target

Use a snapshot only when exact-head runtime validation adds evidence beyond available checks:

```bash
node scripts/review-tools.mjs snapshot \
  --pr https://github.com/OWNER/REPO/pull/123 \
  --out /tmp/pr-review-snapshot.json
```

The command resolves the current PR head SHA, downloads its GitHub archive, and extracts it into a new temporary directory without modifying git.
The result contains the directory, head SHA, and source PR.

Supply `--destination <empty-directory>` when the location must be stable.
The command rejects a non-empty destination and leaves cleanup to the orchestrator after validation.
