# review-skills

Agent skills for fast, parallel pull-request review through fixed Standards, Spec, and Architecture & DDD axes. Reports keep actionable developer findings near the evidence and end with the reviewer table plus a deterministic merge-status band.

## Example report

### Required changes

- [ ] **Prevent inherited Inbox handler lookup** — `InboxSubscriber.handleEvent`
  Use an own-property-safe dispatch map so an event type such as `toString` cannot be marked complete without being handled.

### Verdict and merge status

Overall verdict: **request-changes** — 0 blockers, 1 major, 0 minor, 0 nits.

Merge-ready: **No** — Blocking findings, risks, or failed validation must be resolved before merge.

| Review area | Files | Verdict | Findings |
|---|---|---|---:|
| Standards | 6 files | request-changes | 1 major |
| Spec | 6 files | approve | 0 |
| Architecture & DDD | 6 files | approve | 0 |

🔴 **RED** — A reviewer requested changes or a blocker or major finding remains.

Three reviewers start together with fresh context. Each owns one axis over the complete diff in one fixed workflow.

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
Without Jira, the skill falls back to the linked GitHub issue, then to declared intent from the PR title, body, and commit messages.
Setup and ticket fetching require `curl` and `jq`.

## What's in here

| Skill | What it does |
|---|---|
| [`pr-review`](pr-review/SKILL.md) | Fixed parallel Standards, Spec, and Architecture & DDD review over the complete diff, with deterministic merge status and an optional developer-facing PR comment. |

## Requirements

The skill combines a review methodology with a dependency-free Node.js tool for repeatable review mechanics.
The agent harness needs four review capabilities:

1. **Parallel subagents**: a way to start three background reviewers in one fan-out, such as Oh My Pi's `task` tool or another concurrent subagent runner.
   Without parallel execution, the reviewers may run sequentially and produce the same report more slowly.
2. **Diff access**: either a PR resolver such as `pr://<owner>/<repo>/<n>/diff/all` or plain `git diff <base>...<target>`.
3. **Capability-based model control**: the orchestrator uses the strongest general reasoning profile, ordinary verdict axes use a strong long-context review profile, and Architecture & DDD uses the deepest review profile.
   Model names are installation-specific; per-agent settings are preferred, and compliant inheritance is acceptable when it meets the required capability.
4. **Invocation-level schema enforcement**: a way to apply [`reviewer-result.schema.json`](pr-review/schemas/reviewer-result.schema.json) as each verdict task's strict output schema and reject structurally invalid results before aggregation.

The bundled review tool requires Node.js 20 or newer.
Private GitHub evidence collection and snapshots require `GH_TOKEN` or `GITHUB_TOKEN` with repository read access.

Publishing the optional PR comment also needs an authenticated, write-capable GitHub client such as `gh`.
Without it, the gitkeeper returns the complete draft without changing GitHub.

Model selection is capability-based and does not require a specific provider.

## Lineage

The two-axis (Standards + Spec) split and the Fowler code-smell baseline are long-standing ideas - the smells are from Martin Fowler's _Refactoring_ (ch. 3), and a similar two-axis skill ships in [Matt Pocock's skills](https://github.com/mattpocock/skills).
The architecture lens uses deep-module and seam vocabulary alongside pragmatic DDD checks; it does not require tactical DDD patterns.
This repo's contribution is the fixed three-axis parallel panel, deterministic merge status, and actionable developer report, plus one strict reviewer contract shared by every axis.

## License

[MIT](LICENSE) © Justin Ramel
