# Plan documentation instructions

These instructions apply to implementation plans under `docs/plans/`.

## Purpose

- Define how an accepted Architecture will be implemented through concrete implementation direction, ordering, phases, and reviewable units.
- Bridge Architecture and implementation without redefining Requirements, Design, or Architecture decisions.
- Keep plans focused on how the work will be carried out, validated, and divided into Issues.

## Documentation hierarchy

Use the documentation layers with the following responsibilities:

- **Requirements**: Define what must be achieved and why it matters.
- **Design**: Define how the product behaves from the user's perspective.
- **Architecture**: Define the internal responsibilities, boundaries, state ownership, contracts, responsibility dependencies, lifecycle, and invariants needed to realize the design.
- **Plan**: Define the implementation direction, implementation phases, ordering, implementation dependencies, validation approach, and Issue breakdown used to realize the accepted Architecture.
- **Issue**: Define one concrete, reviewable unit of work with the scope, context, completion conditions, and validation needed to complete it.

Treat Requirements, Design, and Architecture as authoritative inputs to the Plan. Do not redefine, override, or introduce competing versions of their decisions in the Plan.

A Plan may briefly restate accepted decisions when that context is necessary to explain implementation direction, sequencing, dependencies, validation, or Issue boundaries. Such restatement is contextual only; the referenced Requirements, Design, or Architecture document remains the source of truth.

Prefer local comprehensibility over eliminating all repetition. Avoid forcing readers to repeatedly switch between documents when a concise restatement makes the implementation plan materially easier to understand.

## Abstraction boundary

Plan documents may describe:

- implementation direction and important implementation choices;
- implementation phases and the outcome of each phase;
- implementation ordering;
- implementation dependencies between phases, implementation units, or Issues;
- validation strategy and questions that can be resolved during implementation;
- how the work should be divided into reviewable Issues;
- the current implementation state and the implementation gap to the accepted Architecture;
- how accepted architectural responsibilities map to concrete files, modules, types, adapters, integration points, or other implementation units;
- migration steps from the current implementation to the target implementation;
- implementation alternatives, selection criteria, and implementation-level tradeoffs that do not change accepted Requirements, Design, or Architecture decisions;
- concise Requirements, Design, or Architecture context needed to make an implementation phase understandable without redefining that context.

Plan documents must not redefine Architecture-owned concerns, including:

- architectural responsibilities or responsibility boundaries;
- state ownership;
- contracts between architectural responsibilities;
- dependencies between architectural responsibilities;
- lifecycle rules;
- invariants.

When a Plan restates an accepted architectural decision for implementation context, keep the restatement limited to what is necessary for the implementation discussion. Do not expand it into an independent specification of the responsibility, contract, lifecycle, or invariant.

If a Plan disagrees with a referenced Requirements, Design, or Architecture decision, the document that owns that decision is authoritative and the Plan must be corrected.

If implementation planning reveals that an Architecture decision must change, update the Architecture document first. The Plan may then be updated to reflect the accepted Architecture.

## Current and target implementation

A Plan may describe both the current implementation state and the target implementation needed to realize the accepted Architecture.

Use this comparison when it helps explain why a change is needed, what existing implementation can remain, what must move or be removed, and how the migration should be staged.

Keep the target implementation consistent with the accepted Architecture. If describing the target requires a new architectural responsibility, boundary, contract, state ownership rule, lifecycle rule, or invariant, update the Architecture first.

## Architecture impact

Use an Architecture impact section only when the planned work affects an existing Architecture document or when implementation may reveal the need for an Architecture update.

- Identify the relevant Architecture document or responsibility.
- Describe the expected impact without redefining the Architecture itself.
- If an Architecture decision is required, record that the Architecture must be updated before implementation proceeds.

Do not use the Plan as a substitute Architecture document.

## Decisions and validation questions

### Decide before implementation

Record implementation choices that must be settled before a phase or implementation unit can begin. When useful, include the relevant implementation alternatives, constraints, and selection criteria so that the reason for the chosen direction is reviewable.

- Keep these decisions at the implementation level.
- Do not decide matters owned by Requirements, Design, or Architecture.
- When a question requires an Architecture decision or change, return it to the Architecture document instead of resolving it in the Plan.

### Validate during implementation

Record questions that can be answered safely through a spike, prototype, measurement, or implementation result.

- State what evidence is needed to answer the question.
- Update the Plan after validation when the result changes implementation direction, ordering, or Issue breakdown.
- If the result requires an Architecture change, update the Architecture document before continuing with a Plan that depends on the new decision.

## Implementation phases

- Organize work into phases only when the work benefits from staged implementation.
- Each phase should have a clear outcome and be reviewable or provide evidence needed for the next phase.
- Describe implementation dependencies explicitly when the order matters.
- Do not turn phases into descriptions of architectural responsibility relationships.

A phase may include the accepted architectural context that justifies the phase, the concrete implementation changes to make, dependencies that must already be satisfied, the resulting implementation capability, and the evidence used to validate it.

Describe concrete implementation work when it improves execution clarity, including creating, changing, moving, splitting, connecting, replacing, or removing files, modules, types, adapters, or integration paths.

Do not reduce a phase to a restatement of architectural responsibilities. The phase should explain what changes in the implementation and why that ordering is useful.

## Local comprehensibility

A reader should be able to understand the implementation purpose, direction, dependencies, and expected outcome of a phase from the Plan without reconstructing them from multiple referenced documents.

Reference upper-layer documents for authority and full context, but include enough local context to explain why the planned implementation work exists and how it contributes to the accepted Architecture.

Do not copy large sections of Requirements, Design, or Architecture merely to make the Plan self-contained. Restate only the context that materially supports implementation planning.

## Issue breakdown

- Use Issues as concrete implementation units, not copies of the full Plan.
- Keep each Issue small enough to be reviewed as a coherent change.
- Include only the scope, context, completion conditions, and validation required for that Issue.
- Reference the Plan for broader implementation direction and sequencing instead of duplicating it.
- Use Issue-to-Issue dependencies only for implementation ordering or delivery dependencies.

## Validation

- Define the validation needed to confirm the planned implementation works as intended.
- Keep command details aligned with `docs/development/testing.md` instead of duplicating repository-wide validation instructions.
- Separate decisions that must be made before implementation from questions that can be validated during implementation.

## Template

- Use `docs/plans/TEMPLATE.md` as the starting structure for a Plan.
- Remove sections that do not apply rather than filling them with placeholders.
- Add detail only when it helps explain implementation direction, sequencing, validation, or Issue boundaries.
