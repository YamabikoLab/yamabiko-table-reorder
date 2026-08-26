# Plan documentation instructions

These instructions apply to implementation plans under `docs/plans/`.

## Purpose

- Define how an accepted Architecture will be implemented through concrete implementation direction, ordering, phases, and reviewable units.
- Bridge Architecture and implementation without redefining Requirements, Design, or Architecture decisions.
- Keep plans focused on how the work will be carried out, validated, and organized into reviewable implementation phases.

## Documentation hierarchy

Use the documentation layers with the following responsibilities:

- **Requirements**: Define what must be achieved and why it matters.
- **Design**: Define how the product behaves from the user's perspective.
- **Architecture**: Define the internal responsibilities, boundaries, state ownership, contracts, responsibility dependencies, lifecycle, and invariants needed to realize the design.
- **Plan**: Define the implementation direction, implementation phases, ordering, implementation dependencies, and validation approach used to realize the accepted Architecture.
- **Issue**: Define one concrete, reviewable implementation unit with the scope, context, completion conditions, and validation needed to complete it.

Treat Requirements, Design, and Architecture as inputs to the Plan. Do not duplicate or redefine their decisions in the Plan.

## Abstraction boundary

Plan documents may describe:

- implementation direction and important implementation choices;
- implementation phases and the outcome of each phase;
- implementation ordering;
- implementation dependencies between phases or Issues;
- validation strategy and questions that can be resolved during implementation;
- reviewable implementation units when a phase must be split.

Plan documents must not redefine Architecture-owned concerns, including:

- architectural responsibilities or responsibility boundaries;
- state ownership;
- contracts between architectural responsibilities;
- dependencies between architectural responsibilities;
- lifecycle rules;
- invariants.

If implementation planning reveals that an Architecture decision must change, update the Architecture document first. The Plan may then be updated to reflect the accepted Architecture.

## Architecture impact

Use an Architecture impact section only when the planned work affects an existing Architecture document or when implementation may reveal the need for an Architecture update.

- Identify the relevant Architecture document or responsibility.
- Describe the expected impact without redefining the Architecture itself.
- If an Architecture decision is required, record that the Architecture must be updated before implementation proceeds.

Do not use the Plan as a substitute Architecture document.

## Decisions and validation questions

### Decide before implementation

Record implementation choices that must be settled before a phase or implementation unit can begin.

- Keep these decisions at the implementation level.
- Do not decide matters owned by Requirements, Design, or Architecture.
- When a question requires an Architecture decision or change, return it to the Architecture document instead of resolving it in the Plan.

### Validate during implementation

Record questions that can be answered safely through a spike, prototype, measurement, or implementation result.

- State what evidence is needed to answer the question.
- Update the Plan after validation when the result changes implementation direction, ordering, or phase boundaries.
- If the result requires an Architecture change, update the Architecture document before continuing with a Plan that depends on the new decision.

## Implementation phases

- Organize work into phases only when the work benefits from staged implementation.
- Each phase should have a clear outcome and be reviewable or provide evidence needed for the next phase.
- Each implementation phase should normally correspond to one GitHub Issue.
- Split a phase into multiple Issues only when necessary to keep each change reviewable. Record the smaller implementation units within that phase instead of adding a separate Issue breakdown section.
- Describe implementation dependencies explicitly when the order matters.
- Use Issue-to-Issue dependencies only for implementation ordering or delivery dependencies.
- Do not turn phases into descriptions of architectural responsibility relationships.

## Validation

- Define the validation needed to confirm the planned implementation works as intended.
- Keep command details aligned with `docs/development/testing.md` instead of duplicating repository-wide validation instructions.
- Separate decisions that must be made before implementation from questions that can be validated during implementation.

## Template

- Use `docs/plans/TEMPLATE.md` as the starting structure for a Plan.
- Remove sections that do not apply rather than filling them with placeholders.
- Add detail only when it helps explain implementation direction, sequencing, validation, or phase boundaries.
