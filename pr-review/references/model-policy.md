# Model policy

This policy is capability-based and provider-neutral.
Choose the least expensive profile that can reliably perform each role; reserve the deepest profile for work whose verdict depends on cross-module reasoning.

## Capability profiles

### Orchestrator

Use the strongest general-purpose coding and reasoning profile available in the harness.
Set reasoning or thinking effort to **high** or the nearest provider equivalent.
Higher effort is allowed.

The orchestrator must sustain long-context tool use, decomposition, prompt construction, result validation, and deterministic aggregation.
The skill cannot change the model already running the parent session, so the caller or harness must start the orchestrator with this profile.

### Review

Use a strong long-context code-review profile for `locality`, `standards-only`, and `spec-only`.
Set reasoning or thinking effort to **high** or the nearest provider equivalent.
This profile may be cheaper than the orchestrator when it can still hold the complete assigned hunks, standards, and specification in context and return reliable structured verdicts.
Do not use a lightweight summarization or short-context profile for verdict-bearing work.

### Deep review

Use the strongest code and reasoning profile for `architecture-only`.
Set reasoning or thinking effort to **high** or the nearest provider equivalent.
Architecture and DDD findings depend on cross-module ownership, dependency direction, and invariant reasoning, so cost alone is not a reason to downgrade this axis.

Escalate any other reviewer from Review to Deep review when a previous review missed a defect exposed by a failed fix, or when the assigned scope requires a long causal chain across modules.

### Publication

Gitkeeper is not verdict-bearing.
Use the least expensive profile that can reliably follow its fixed transformation and publication contract, with **low** reasoning effort or the nearest provider equivalent.
The settled report is its source of truth; it must not reinterpret findings or make review decisions.

## Mode routing

| Work | Required profile |
|---|---|
| `locality` review | Review |
| `standards-only` review | Review |
| `spec-only` review | Review |
| `architecture-only` review | Deep review |
| Gitkeeper publication | Publication |

When a panel mixes profiles, start every reviewer in the same fan-out but select each task's profile independently.
When the runner cannot select profiles per task, use the deepest profile required by that panel rather than downgrading any reviewer.

## Runner configuration

Set model and effort explicitly when the runner exposes those controls.
Role aliases should describe capabilities rather than a provider or model family, so installations can map them to their own catalogue.
Never change the user's model configuration during a review.

### Oh My Pi example

OMP can map agent types to capability roles and expose per-task effort.
Choose local models that meet each placeholder:

```yaml
modelRoles:
  review: "<long-context-review-model>:high"
  deepReview: "<deep-reasoning-model>:high"
  economy: "<economical-tool-use-model>:low"

task:
  enableEffort: true
  agentModelOverrides:
    reviewer: "@review"
    task: "@deepReview"
    sonic: "@economy"
```

Use the bundled `reviewer` agent for Review work, the bundled `task` agent for Deep review work, and the bundled `sonic` agent for Gitkeeper when it has the required GitHub tools.
If the task schema exposes `effort`, request its high setting for verdict-bearing reviewers and its low setting for Gitkeeper.

## Unavailable settings

If the harness cannot provide or select a required profile, use the strongest model and highest reasoning effort it exposes.
Do not claim that a requested model or effort was effective when the runtime did not expose the resolved value.
This limitation affects review-environment evidence, not the deterministic verdict or risk calculation.

## Reporting

Separate requested policy from observed runtime values:

```text
Review environment: requested <role>=<profile>/<effort>; observed <model>/<effort>
```

Prefer runtime metadata.
If that is unavailable, use the worker's exact self-report.
Never infer effort from a model name or configured role.
Use `not exposed` whenever the exact resolved model or effort is unavailable, including when inheritance is known.
