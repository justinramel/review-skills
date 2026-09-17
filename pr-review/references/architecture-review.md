# Architecture and DDD review

Use this lens only when the workflow's architecture gate selects it. It is an independent review axis over the architecture-relevant diff, not a second Standards or Spec pass.

## Architecture gate

Run this axis when the diff does at least one of these:

- changes domain concepts, business rules, invariants, state transitions, or domain events;
- adds, removes, or changes a module interface, dependency direction, adapter seam, integration contract, persistence seam, or transaction boundary;
- moves responsibility or dependencies across modules in a structural refactor.

Skip it when the change preserves domain behaviour, interfaces, dependency direction, and module ownership. Typical skips are documentation, copy or styling, generated files, lockfiles, tool configuration, and an isolated leaf change behind an unchanged interface.

Record `run` or `skip` and one concrete diff-grounded reason. File count alone never decides the gate.

## Architecture lens

Judge fit with the repository's documented architecture first. Then examine:

- **Depth**: a module should hide meaningful behaviour behind a small interface. Flag shallow pass-through layers and interfaces that make callers learn implementation details.
- **Seams**: invariants, ordering, errors, configuration, and performance expectations should be explicit where callers cross an interface.
- **Locality**: knowledge and likely follow-up changes should stay with the module that owns them, rather than spreading through callers.
- **Dependencies**: direction should match module ownership, avoid cycles, and keep policy independent of replaceable mechanisms where the repository makes that distinction.
- **Abstraction fitness**: an abstraction should remove complexity or support real variation. One adapter is evidence to question a seam; two adapters make variation concrete.
- **Test surface**: important behaviour should be testable through the same interface callers use. Dependencies should be controllable at the seam without exposing internals.

## DDD lens

Apply this part only when the changed area expresses business concepts or the repository uses DDD language. DDD is a modelling lens, not a requirement to introduce tactical patterns.

- **Ubiquitous language**: names in code, tests, and the spec should express the same domain concepts without overloaded or infrastructure-led terminology.
- **Invariant ownership**: the module that owns a rule should make invalid state difficult to create. Flag rules duplicated in controllers, jobs, persistence mapping, or callers.
- **Consistency boundaries**: state changed atomically should have a clear owner. Flag cross-aggregate mutation or transactions that silently span unrelated concepts.
- **Value concepts**: identifiers, money, ranges, status transitions, and similar concepts should carry their domain rules when primitives let invalid values leak across seams.
- **Domain/infrastructure separation**: business decisions should not depend on transport, ORM, or vendor details unless the repository deliberately models them together.
- **Context seams**: when concepts cross bounded contexts or external systems, translations should be explicit enough to prevent one model leaking into another.
- **Domain events**: events should describe domain facts, follow successful invariant enforcement, and have clear delivery and side-effect semantics when those matter to correctness.

Prefer the smallest design correction that restores ownership or clarifies a seam. Do not demand aggregates, repositories, value objects, events, or layers merely because DDD names them.

## Findings

Report only actionable architecture or modelling problems introduced or materially exposed by the diff. Every finding needs an exact changed location, evidence, consequence, and fix direction. Use the shared severity, verdict, and JSON output contract. Return `Nothing found` through an empty findings array when the design is sound.
