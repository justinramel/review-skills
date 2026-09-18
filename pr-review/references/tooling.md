# Review tools

The bundled `scripts/review-tools.mjs` performs repeatable review mechanics.
It does not judge findings or publish to GitHub.
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

## Compile the fixed panel

Write the complete diff URI and any explicit specification or architecture context as the plan:

```json
{
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
  ]
}
```

`specification` is optional when the evidence includes PR title, body, or complete commit messages.
`architectureContext` is optional; the Architecture & DDD reviewer uses the bundled lens when repository-specific material does not exist.

Compile task-ready briefs:

```bash
node scripts/review-tools.mjs compile-panel \
  --evidence /tmp/pr-review-evidence.json \
  --plan /tmp/pr-review-plan.json \
  --out /tmp/pr-review-panel.json
```

The compiler:

- creates exactly Standards, Spec, and Architecture & DDD reviewers;
- assigns `standards-only`, `spec-only`, and `architecture-only` respectively;
- gives every reviewer every changed file and the complete diff;
- rejects custom reviewers, review depth, unknown plan fields, and incomplete inputs;
- uses declared PR or commit intent when no stronger specification is supplied;
- embeds each reviewer's applicable sources;
- returns `profile`, `task`, `outputSchema`, and `schemaMode: "strict"`.

The orchestrator maps `profile` to the runner configuration and starts all three reviewers in one fan-out.

## Aggregate results

Create an aggregation input after every strict reviewer result has returned:

```json
{
  "reviewers": [],
  "checks": { "state": "success", "runs": [] },
  "validation": [
    { "name": "CI", "status": "passed | failed | pending | not-run | not-applicable" }
  ],
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

The aggregator requires exactly one valid result named Standards, Spec, and Architecture & DDD.
It validates structure and verdict/finding consistency, preserves reviewer results, counts severities, applies the fixed verdict and status rules, and returns `mergeStatus` with its `decidingRule` plus `mergeReady` with its independent `mergeReadyReason`.
It does not merge, deduplicate, rerank, or rewrite findings; the developer report may consolidate only exact duplicates while retaining their provenance.
A missing, duplicate, unsupported, or malformed reviewer result produces `GRAY` and `valid: false`; it is never translated into the expected schema.

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
