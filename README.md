# review-skills

Agent skills for reviewing pull requests with a **panel of independent reviewers
running in parallel**, followed by a change summary, merge-risk band, findings,
areas worth human inspection, and a verdict + confidence table.

```
| Agent | Files | Verdict | Confidence |
|---|---|---|---|
| ConfigInfra     | .env.example, config.ts, vitest.config.ts   | approve | 0.95 |
| RedriveFlash    | redrive-event.route.ts + test               | approve | 0.98 |
| EventPageView   | event-page.view-model.ts + test, ...        | approve | 0.96 |
| EventsListLinks | events-page.view-model.ts + test            | approve | 0.91 |
```

Each reviewer starts with fresh context and owns one slice of the change, so
independent slices are reviewed at the same time and no reviewer's context
pollutes another's.

## Install

These are [agent skills](https://github.com/vercel-labs/skills).
Install them with the maintained `skills` CLI:

```bash
npx skills add justinramel/review-skills
```

That makes the skills available to every agent the CLI targets (Claude Code,
Codex, Gemini CLI, GitHub Copilot, OpenCode, and Oh My Pi). Then just ask your
agent to review a PR:

```
review https://github.com/OWNER/REPO/pull/123
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
| [`pr-review`](pr-review/SKILL.md) | Parallel PR review with locality or Standards/Spec decomposition, a deterministic merge-risk band, focused inspection areas, and an optional developer-facing PR comment. |

The skill keeps its trigger file concise and loads focused references only when needed:

- [`workflow.md`](pr-review/references/workflow.md) defines target pinning, evidence gathering, decomposition, reviewer briefs, and publication.
- [`reporting.md`](pr-review/references/reporting.md) defines structured results, deterministic aggregation, merge risk, merge readiness, and report order.
- [`reviewer-role.md`](pr-review/references/reviewer-role.md) defines reviewer scope and behavior.
- [`review-contract.md`](pr-review/references/review-contract.md) defines smells, severity, verdicts, runtime evidence, and structured output.
- [`model-policy.md`](pr-review/references/model-policy.md) defines model selection, reasoning effort, and OMP configuration.
- [`two-axis.md`](pr-review/references/two-axis.md) defines the focused Standards-only and Spec-only panel.
- [`gitkeeper-role.md`](pr-review/references/gitkeeper-role.md) turns an authorized settled report into a developer-facing PR comment.

## Requirements

This is a **methodology packaged as instructions**, not a standalone program.
The agent harness needs three review capabilities:

1. **Parallel subagents**: a way to start N background reviewers in one fan-out, such as Oh My Pi's `task` tool or another concurrent subagent runner.
   Without parallel execution, the reviewers may run sequentially and produce the same report more slowly.
2. **Diff access**: either a PR resolver such as `pr://<owner>/<repo>/<n>/diff/all` or plain `git diff <base>...<target>`.
3. **High-reasoning model control**: the orchestrator and every verdict-bearing reviewer must run with high reasoning or the nearest provider equivalent.
   Per-agent settings are preferred; compliant inheritance from the orchestrator is acceptable.

Publishing the optional PR comment also needs an authenticated, write-capable GitHub client such as `gh`.
Without it, the gitkeeper returns the complete draft without changing GitHub.

The model policy is capability-based and does not require a specific model provider.

## About the confidence column

`confidence` is each reviewer's **own estimate that its verdict is right**, given
how much context it could see. It is a self-reported number, **not a calibrated
metric** — useful for spotting where a reviewer was unsure, not as a quality
score. The skill labels it as a self-estimate wherever it is reported.

## Lineage

The two-axis (Standards + Spec) split and the Fowler code-smell baseline are
long-standing ideas — the smells are from Martin Fowler's _Refactoring_ (ch. 3),
and a similar two-axis skill ships in
[Matt Pocock's skills](https://github.com/mattpocock/skills). This repo's
contribution is the **parallel locality panel** and the **verdict + confidence
table** as a reporting contract, plus a single reviewer contract shared across
whichever decomposition you pick.

## License

[MIT](LICENSE) © Justin Ramel
