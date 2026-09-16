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

## Unavailable settings

If the harness cannot provide or select the required profile, use the strongest model and highest reasoning effort it exposes.
State the limitation in the report before presenting verdicts.
Do not claim that the requested model policy was enforced when the runner does not expose the actual settings.

## Reporting

Report the effective settings when the runner exposes them:

```text
Models: orchestrator <model>/<effort>; reviewers <model>/<effort>
```

Use `inherited` when reviewers inherit the orchestrator profile.
Use `not exposed` when the harness does not reveal a model or effort value.
