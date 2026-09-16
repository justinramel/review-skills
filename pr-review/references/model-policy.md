# Model policy

This review produces merge guidance, so every verdict-bearing agent needs strong reasoning rather than a lightweight scan or summary model.

## Orchestrator

Use the strongest general-purpose coding and reasoning model available in the harness.
Set reasoning or thinking effort to **high** or the nearest provider equivalent.
Higher effort is allowed.

The orchestrator must be capable of long-context tool use, decomposition, prompt construction, result validation, and deterministic aggregation.
The skill cannot change the model already running the parent session, so the caller or harness must start the orchestrator with this profile.

## Reviewers

Use the strongest code-review-capable coding and reasoning model available in the harness.
Set reasoning or thinking effort to **high** or the nearest provider equivalent for every reviewer.
Higher effort is allowed.
Do not downgrade verdict-bearing reviewers to a lightweight, fast, or summarization model solely to reduce latency or token use.

When the runner supports per-agent configuration, set the reviewer model and effort explicitly before the fan-out.
When it does not, reviewers may inherit the orchestrator settings only if the orchestrator meets this policy.
The gitkeeper is not verdict-bearing, so this requirement does not apply to its publication-only work.

## Oh My Pi setup

OMP can pin the bundled `reviewer` agent to a model role and expose per-task effort.
Set the strong model available in that installation in `~/.omp/agent/config.yml`:

```yaml
modelRoles:
  review: "<strong-review-model>:high"

task:
  enableEffort: true
  agentModelOverrides:
    reviewer: "@review"
```

After changing this setting, start a session whose task schema exposes `effort`.
Pass `effort: "hi"` on every verdict-bearing reviewer item.
The role mapping selects the model, and the task item requests the highest reasoning level that model supports.

## Unavailable settings

If the harness cannot provide or select the required profile, use the strongest model and highest reasoning effort it exposes.
Do not claim that a requested model or effort was effective when the runtime did not expose the resolved value.
This limitation affects review-environment evidence, not the deterministic verdict or risk calculation.

## Reporting

Separate requested policy from observed runtime values:

```text
Review environment: requested reviewers <profile>/high; observed <model>/<effort>
```

Prefer runtime metadata.
If that is unavailable, use the reviewer's exact self-report.
Never infer effort from a model name or configured role.
Use `not exposed` whenever the exact resolved model or effort is unavailable, including when inheritance is known.
