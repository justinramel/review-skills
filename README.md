# review-skills

Agent skills for fast, parallel pull-request review with an optional Architecture & DDD axis. Reports keep actionable developer findings near the evidence and end with the reviewer table plus a deterministic merge-status band.

```markdown
## Required changes

- [ ] **Prevent inherited Inbox handler lookup** - [`InboxSubscriber.handleEvent`](https://github.com/OWNER/REPO/blob/HEAD_SHA/src/inbox.subscriber.js#L165-L168)
  Use an own-property-safe dispatch map so an event type such as `toString` cannot be marked complete without being handled.

## Verdict and merge status

Overall verdict: request-changes - 0 blockers, 1 major, 0 minor, 0 nits.
Merge-ready: No - Blocking findings, risks, or failed validation must be resolved before merge.

| Review area | Files | Verdict | Findings |
|---|---|---|---:|
| Inbox lifecycle | 6 files | request-changes | 1 major |

🔴 RED - A reviewer requested changes or a blocker or major finding remains.
```

Each reviewer starts with fresh context and owns one concern or review axis. Fast depth is the default and limits the panel to three verdict-bearing reviewers, including the conditional Architecture & DDD axis.

## Install

These are [agent skills](https://github.com/vercel-labs/skills).
Install them with the maintained `skills` CLI:

```bash
npx skills add justinramel/review-skills
```

That makes the skills available to every agent the CLI targets (Claude Code, Codex, Gemini CLI, GitHub Copilot, OpenCode, and Oh My Pi).
Then just ask your agent to review a PR:

```
review https://github.com/OWNER/REPO/pull/123
```

Reviews use fast depth by default. Ask `review thoroughly ...` to permit a panel of up to six reviewers.

Skill selection uses the harness's installed skill registry; a repository clone alone may not register `pr-review`.
Start a new agent session after installation and confirm that `pr-review` is available.
If another installed review skill overlaps, select this one explicitly:

```
use the pr-review skill to review https://github.com/OWNER/REPO/pull/123
```

For a local branch:

```
review since origin/main
```

Ask explicitly when you also want the completed review published as a PR comment:

```
review and comment on https://github.com/OWNER/REPO/pull/123
```

## Jira (optional)

If your PRs reference Jira tickets, the Spec axis can read the ticket a PR implements.
The bundled setup script loads helper files next to it, so run setup from a repository clone rather than from the project where the skill was installed:

```bash
git clone https://github.com/justinramel/review-skills.git
cd review-skills
./pr-review/scripts/setup-jira.sh
```

From an existing clone, run only the final command.
Setup stores credentials as non-executable JSON at `~/.config/pr-review/jira.json` by default with permissions `0600`.
The installed skill reads that same user-level configuration, so you may delete the setup clone afterward.

When a PR title, branch, or commit carries a Jira key such as `FGP-1392`, the reviewer fetches that ticket as the spec.
Without Jira, the skill falls back to the linked GitHub issue.
Setup and ticket fetching require `curl` and `jq`.

## What's in here

| Skill | What it does |
|---|---|
| [`pr-review`](pr-review/SKILL.md) | Fast-by-default parallel review with locality or Standards/Spec decomposition, a conditional Architecture & DDD reviewer, deterministic merge status, and an optional developer-facing PR comment. |

The skill keeps its trigger file concise and loads focused references only when needed:

- [`workflow.md`](pr-review/references/workflow.md) defines target pinning, evidence gathering, decomposition, reviewer briefs, and publication.
- [`reporting.md`](pr-review/references/reporting.md) defines structured results, deterministic aggregation, merge status, merge readiness, and the developer report.
- [`reviewer-role.md`](pr-review/references/reviewer-role.md) defines reviewer scope and behavior.
- [`review-contract.md`](pr-review/references/review-contract.md) defines smells, severity, verdicts, runtime evidence, and structured output.
- [`model-policy.md`](pr-review/references/model-policy.md) defines model selection, reasoning effort, and OMP configuration.
- [`two-axis.md`](pr-review/references/two-axis.md) defines the focused Standards-only and Spec-only panel.
- [`architecture-review.md`](pr-review/references/architecture-review.md) defines when architecture review is warranted and its Architecture/DDD lens.
- [`gitkeeper-role.md`](pr-review/references/gitkeeper-role.md) turns an authorized settled report into a developer-facing PR comment.
- [`tooling.md`](pr-review/references/tooling.md) defines the bundled evidence, panel, aggregation, and immutable-snapshot interfaces.
- [`reviewer-result.schema.json`](pr-review/schemas/reviewer-result.schema.json) enforces the verdict-bearing result shape at task invocation time.

## Requirements

The skill combines a review methodology with a dependency-free Node.js tool for repeatable review mechanics.
The agent harness needs four review capabilities:

1. **Parallel subagents**: a way to start N background reviewers in one fan-out, such as Oh My Pi's `task` tool or another concurrent subagent runner.
   Without parallel execution, the reviewers may run sequentially and produce the same report more slowly.
2. **Diff access**: either a PR resolver such as `pr://<owner>/<repo>/<n>/diff/all` or plain `git diff <base>...<target>`.
3. **Capability-based model control**: the orchestrator uses the strongest general reasoning profile, ordinary verdict axes use a strong long-context review profile, and Architecture & DDD uses the deepest review profile.
   Model names are installation-specific; per-agent settings are preferred, and compliant inheritance is acceptable when it meets the required capability.
4. **Invocation-level schema enforcement**: a way to apply [`reviewer-result.schema.json`](pr-review/schemas/reviewer-result.schema.json) as each verdict task's strict output schema and reject structurally invalid results before aggregation.

The bundled review tool requires Node.js 20 or newer.
Private GitHub evidence collection and snapshots require `GH_TOKEN` or `GITHUB_TOKEN` with repository read access.

Publishing the optional PR comment also needs an authenticated, write-capable GitHub client such as `gh`.
Without it, the gitkeeper returns the complete draft without changing GitHub.

The model policy is capability-based and does not require a specific model provider.

## Lineage

The two-axis (Standards + Spec) split and the Fowler code-smell baseline are long-standing ideas - the smells are from Martin Fowler's _Refactoring_ (ch. 3), and a similar two-axis skill ships in [Matt Pocock's skills](https://github.com/mattpocock/skills).
The conditional architecture lens uses deep-module and seam vocabulary alongside pragmatic DDD checks; it does not require tactical DDD patterns.
This repo's contribution is the fast-by-default parallel locality panel, conditional Architecture & DDD axis, deterministic merge status, and actionable developer report, plus a single reviewer contract shared across whichever decomposition you pick.

## License

[MIT](LICENSE) © Justin Ramel
