# Review contract

This is the rubric every reviewer applies. Pair it with the stance in
[`reviewer-role.md`](reviewer-role.md) — that file is who you are and how you
approach your slice; this file is what you check and the shape you return.

## What to review

Review your slice on two questions at once:

1. **Standards** — does this diff match how this repo writes code?
2. **Spec** — does it do what the issue / plan asked, and only that?

### Standards, in priority order

1. **The repo's own rules** — its `AGENTS.md`, `CONTRIBUTING.md`, or coding
   standards. Cite the file and rule for each finding. A breach here can be a
   **hard violation**.
2. **The smell baseline below** — applies even when the repo documents nothing.
   Every baseline finding is a **judgement call** ("possible Feature Envy"),
   never a hard violation. A documented repo standard always wins: where the
   repo endorses something the baseline would flag, suppress it. Skip anything
   the repo's tooling already enforces — a linter finding is not a review
   finding.

Match each against the diff — *what it is* → *how to fix*:

- **Mysterious Name**: a name that doesn't reveal what it does or holds. → rename
  it; if no honest name comes, the design is murky.
- **Duplicated Code**: the same logic shape in more than one hunk or file. →
  extract the shared shape, call it from both.
- **Feature Envy**: a method that reaches into another object's data more than
  its own. → move it onto the data it envies.
- **Data Clumps**: the same few fields/params keep travelling together. → bundle
  them into one type.
- **Primitive Obsession**: a primitive standing in for a domain concept. → give
  the concept its own small type.
- **Repeated Switches**: the same `switch`/`if`-cascade on the same type recurs.
  → replace with polymorphism, or one shared map.
- **Shotgun Surgery**: one logical change forces scattered edits across many
  files. → gather what changes together.
- **Divergent Change**: one file edited for several unrelated reasons. → split so
  each module changes for one reason.
- **Speculative Generality**: abstraction/hooks for needs the spec doesn't have.
  → delete it; inline until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation. → hide the walk behind one
  method on the first object.
- **Middle Man**: a class/function that mostly just delegates. → cut it, call the
  real target.
- **Refused Bequest**: an implementation that ignores most of what it inherits. →
  prefer composition.
- **Bolted-on Branch**: a special case inserted into a flow that had none — a
  one-off boolean, a nullable mode, a "temporary" `if`. → push it behind its own
  abstraction, or make it the default flow with fewer exceptions. This is how a
  clean flow becomes spaghetti one PR at a time; treat it as design, not style.
- **Papered-over Boundary**: a cast, an `any`, or an optional standing in for an
  invariant nobody made explicit, so a silent fallback hides the real contract.
  → make the boundary explicit.

Tests get three smells of their own:

- **Implementation-coupled**: mocks internal collaborators, tests private
  methods, or asserts through a side channel (querying the DB instead of the
  interface). The tell: it breaks on refactor when behaviour did not.
- **Tautological**: the assertion recomputes the expected value the way the code
  does, so it passes by construction. Expected values must come from an
  independent source — a known-good literal, a worked example, the spec.
- **Wrong seam**: the test sits below the public behaviour boundary it claims to
  defend.

### Spec

The linked issue / plan is the source of truth. Report, quoting the spec line:

- **Missing**: requested behaviour absent or partial.
- **Creep**: behaviour or files nobody asked for.
- **Wrong**: a requirement that looks implemented but whose behaviour does not
  hold up.

If no spec was supplied, say so and review Standards only.

## Severity

- **blocker** — must fix before merge: wrong behaviour, a security hole, data
  loss, a documented-standard violation with real consequence.
- **major** — should fix before merge: a structural problem (Bolted-on Branch,
  Papered-over Boundary, unjustified Speculative Generality), a missing spec
  requirement, an implementation-coupled test guarding load-bearing behaviour.
- **minor** — worth fixing: a smell that is a judgement call, a narrow test, a
  naming problem.
- **nit** — cosmetic; take it or leave it.

## Verdict

- `approve` — no blockers, no majors.
- `approve-with-nits` — no blockers, no majors, only minors/nits.
- `request-changes` — at least one blocker or major.

## Output

Return exactly this shape:

```json
{
  "name": "<your bucket name>",
  "files": ["<file>", "..."],
  "verdict": "approve | approve-with-nits | request-changes",
  "confidence": 0.0,
  "findings": [
    { "severity": "blocker|major|minor|nit",
      "location": "path:line",
      "evidence": "what is wrong and why, grounded in the hunk" }
  ]
}
```

`confidence` is a number in `[0, 1]`: **your own estimate that your verdict is
right**, given how much of the context you could see. It is a self-estimate, not
a calibrated score. Lower it when you had to guess at cross-file behaviour the
diff didn't show.
