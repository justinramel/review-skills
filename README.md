# review-skills

Agent skills for reviewing pull requests with a **panel of independent reviewers
running in parallel**, reported side by side as a verdict + confidence table.

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

These are [agent skills](https://github.com/obra/skills) — install with the
`skills` CLI:

```bash
skills add justinramel/review-skills
```

That makes the skills available to every agent the CLI targets (Claude Code,
Codex, Gemini CLI, GitHub Copilot, OpenCode, and Oh My Pi). Then just ask your
agent to review a PR:

```
review https://github.com/OWNER/REPO/pull/123
```

or

```
review since origin/main
```

## Jira (optional)

If your PRs reference Jira tickets, the Spec axis can read the ticket a PR
implements. Run the one-time setup — it walks you through creating an Atlassian
API token and stores the credentials locally (`~/.config/pr-review/jira.env`,
`chmod 600`, never committed):

```bash
pr-review/scripts/setup-jira.sh
```

After that, when a PR title, branch, or commit carries a Jira key (`FGP-1392`),
the reviewer fetches that ticket as the spec. No Jira? The skill falls back to
the linked GitHub issue. Needs `curl` and `jq`.

## What's in here

| Skill | What it does |
|---|---|
| [`pr-review`](pr-review/SKILL.md) | Panel review of a PR or diff → verdict + confidence table. Two decomposition modes: **by locality** (default, one reviewer per module) and **by axis** (Standards + Spec, for focused PRs). |

Every reviewer adopts the same stance and applies the same bar, pinned in two
files: [`reviewer-role.md`](pr-review/references/reviewer-role.md) (who the
reviewer is and how it approaches a slice) and
[`review-contract.md`](pr-review/references/review-contract.md) (the Fowler smell
baseline, the test-quality smells, the severity/verdict definitions, and the
structured output shape).

## Requirements

This is a **methodology packaged as instructions**, not a standalone program. To
run the panel as designed, the agent's harness needs two capabilities:

1. **Parallel subagents** — a way to start N background reviewers in one fan-out
   (e.g. Oh My Pi's `task` tool, or any runner with concurrent subagents).
   Without them the reviewers run sequentially; the report is identical, only
   slower.
2. **Diff access** — either a PR resolver (`pr://<owner>/<repo>/<n>/diff/all`) or
   plain `git diff <base>...HEAD`.

Nothing here depends on a specific IDE, desktop app, or model provider.

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
