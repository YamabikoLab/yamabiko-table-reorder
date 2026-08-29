# Architecture documentation instructions

These instructions apply to architecture documents under `docs/architecture/`.

## Purpose

- Describe the internal responsibilities, boundaries, and contracts needed to realize the design.
- Explain how major responsibilities collaborate without defining implementation details.
- Keep architecture stable enough to remain useful when source files, functions, or implementation techniques change.
- Use an arc42-based document structure as the information-classification backbone while preserving the YTR responsibility model.
- Keep Markdown as the hand-maintained source of truth for architecture information that is later transformed into generated architecture representations.

## Abstraction boundary

- Describe the technical structure between user-visible design and concrete implementation.
- Define major responsibilities, their boundaries, ownership, and contracts.
- Describe important data flow, state ownership, dependencies, lifecycle, and invariants where they are relevant to the responsibility.
- Do not merely translate design behavior into more technical wording; add the internal responsibility model needed to realize that behavior.
- Do not describe source files, concrete class or function names, variables, event handler names, implementation steps, DOM details, CSS details, or test implementation.
- Do not make architecture depend on the current source tree shape.

## arc42-based document structure

Architecture documents must organize information under the following document-level sections in this order when the section is relevant to the architecture being documented.

1. `## 1. Introduction and Goals`
2. `## 2. Architecture Constraints`
3. `## 3. Context and Scope`
4. `## 4. Solution Strategy`
5. `## 5. Building Block View`
6. `## 6. Runtime View`
7. `## 7. Deployment View`
8. `## 8. Crosscutting Concepts`
9. `## 9. Architecture Decisions`
10. `## 10. Quality Requirements`
11. `## 11. Risks and Technical Debt`
12. `## 12. Glossary`

Do not add empty sections merely to reproduce the complete arc42 template. Omit a section when it has no relevant architecture information.

Use the sections as follows:

- **Introduction and Goals**: Describe the purpose, scope, architecture goals, and important stakeholders or readers.
- **Architecture Constraints**: Record architecture-wide constraints that materially limit the solution space.
- **Context and Scope**: Define the YTR system boundary and the external systems, platforms, blocks, or environments that interact with it.
- **Solution Strategy**: Summarize the principal architecture choices that shape the responsibility model without describing implementation steps. Use Process Flow Views here when a major end-to-end flow is needed to explain how processing progresses across architecture elements.
- **Building Block View**: Define YTR architectural responsibilities, their stable IDs, structural dependencies, optional dependency views, state ownership, contracts, lifecycle, and invariants.
- **Runtime View**: Describe important runtime scenarios as ordered interactions between identified architecture elements.
- **Deployment View**: Describe deployment structure only when deployment topology is architecturally relevant.
- **Crosscutting Concepts**: Describe architecture concepts and rules that affect multiple responsibilities, such as context resolution, state boundaries, or common interaction rules.
- **Architecture Decisions**: Record important architecture decisions and their rationale when those decisions need to remain visible independently from plans or implementation history.
- **Quality Requirements**: Record architecturally significant quality goals and scenarios that shape the responsibility model.
- **Risks and Technical Debt**: Record known architecture risks or debt that materially affect future design work.
- **Glossary**: Define architecture terminology whose meaning must remain stable across the document.

Do not force existing architecture information into an arc42 section if doing so would change its meaning. Reclassify information by responsibility while preserving accepted architecture decisions.

## Human-readable and machine-readable information

Architecture documents contain both human-readable design information and machine-readable architecture data.

The machine-readable source is limited to the fixed headings and tables defined in this file. A parser or generator must not infer architecture elements, structural dependencies, dependency views, process flows, runtime interactions, IDs, or references from explanatory prose.

The following structures are machine-readable:

- External Context table under `## 3. Context and Scope`.
- Process Flow View headings under `## 4. Solution Strategy`; the view name, embedded Process Flow View ID, and View `kind` are machine-readable.
- Process Flow View tables under `## 4. Solution Strategy`; `From`, `To`, Edge `Kind`, and `Meaning` are machine-readable.
- Responsibility Inventory table under `## 5. Building Block View`.
- Dependencies table under `## 5. Building Block View`.
- Dependency Views table under `## 5. Building Block View`, when present.
- Responsibility detail headings under `### Responsibility Details`; only the responsibility name and embedded responsibility ID in each heading are machine-readable.
- Runtime Scenario headings under `## 6. Runtime View`; the scenario name and embedded runtime scenario ID are machine-readable.
- Runtime Scenario tables under `## 6. Runtime View`.

The following information is human-readable only unless another rule explicitly defines a machine-readable structure:

- Explanatory prose in any arc42 section.
- Responsibility detail section contents below the machine-readable responsibility heading identity.
- `Responsibility`, `State ownership`, `Contract`, `Lifecycle`, and `Invariants` descriptions.
- Rationale, constraints, crosscutting concepts, quality explanations, risks, and glossary descriptions.

Do not duplicate machine-readable architecture facts in another machine-readable form. The fixed heading or table is the source of truth for the fact it represents; explanatory prose may explain its meaning but must not redefine it.

## Stable IDs

Assign stable IDs to architecture elements that must be referenced from machine-readable structures.

IDs are required for:

- External context elements.
- Architectural responsibilities.
- Dependency Views.
- Process Flow Views.
- Runtime scenarios.

IDs must:

- Use only ASCII letters, digits, and `_`.
- Start with an ASCII letter.
- Be unique within the architecture document for their element type.
- Remain stable when display names or explanatory wording change.
- Represent architecture identity rather than source-code identity.

Use these prefixes:

- External context: `EXT_`
- Responsibility: `RESP_`
- Dependency View: `DV_`
- Process Flow View: `PV_`
- Runtime scenario: `RV_`

Examples:

- `EXT_WORDPRESS_EDITOR`
- `EXT_TABLE_BLOCK`
- `RESP_DND_INTERACTION`
- `RESP_DATA_UPDATE`
- `DV_DND_CORE`
- `PV_REORDER_END_TO_END`
- `RV_DND_START`

Do not reuse a removed ID for a different architecture concept.

## Context and Scope

When external context is relevant, define it under `## 3. Context and Scope` using a child heading exactly named `### External Context` followed immediately by this table structure:

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | Provides the editing environment in which YTR operates. |

Rules:

- `ID` is the stable external-context ID.
- `Name` is the human-readable architecture name.
- `Type` classifies the external element without introducing implementation detail.
- `Summary` briefly states why the element is relevant to the YTR boundary.
- Structural Dependencies involving external elements are not inferred from this table. Define them explicitly in the Dependencies table.

## Solution Strategy

Use `## 4. Solution Strategy` for major architecture choices and for Process Flow Views that make the principal end-to-end processing direction understandable across architecture elements.

### Process Flow Views

When Process Flow Views are present, group them under exactly one child heading named `### Process Flow Views` within `## 4. Solution Strategy`.

Each Process Flow View must use this heading form:

`#### <Process Flow View name> {#<Process Flow View ID> kind=<Process Flow View kind>}`

Examples:

`#### Reorder End-to-End {#PV_REORDER_END_TO_END kind=normal}`

`#### Reorder Failure and Recovery {#PV_REORDER_FAILURE_RECOVERY kind=failure-recovery}`

The Process Flow View name, embedded ID, and `kind` in this heading are machine-readable and identify the flow represented by the table below it.

Process Flow View `kind` must be one of:

- `normal`: the view represents the ordinary processing direction.
- `failure-recovery`: the view represents failure and recovery processing that must remain distinguishable from the ordinary flow.

Immediately below the heading, include a short human-readable purpose or flow description, followed by a table with this exact structure for every Process Flow View kind:

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_INPUT_INTERACTION | normal | Reorder processing enters YTR from editor input. |
| RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | normal | Input processing proceeds into common DnD processing. |

`A → B` means that processing progresses from A toward B at the architecture level.

Process Flow Edge `Kind` must be one of:

- `normal`: ordinary processing progression.
- `failure`: processing progression that carries or represents a failure path.
- `recovery`: processing progression that carries recovery, abort, cleanup, or restoration after a failure.

Rules:

- A Process Flow View represents a major end-to-end flow, not an exhaustive listing of every responsibility or interaction.
- Every Process Flow View must declare exactly one machine-readable `kind` in its heading.
- Do not infer a Process Flow View `kind` from its name, prose, Edge kinds, or included responsibilities.
- Every Process Flow View uses the same `From | To | Kind | Meaning` table schema regardless of View `kind`.
- `From` and `To` must contain stable IDs defined in the External Context or Responsibility Inventory tables.
- `Kind` explicitly classifies the Process Flow Edge and must not be inferred from the View `kind`, `Meaning`, direction, or surrounding prose.
- `Meaning` briefly states what architecture-level processing progression the edge represents.
- The `From + To` pair must be unique within one Process Flow View. Duplicate pairs are invalid and must be rejected by validation.
- Process Flow rows do not have a `Step` column. Table row order does not define runtime sequence.
- Process Flow direction represents progression of processing. Edge `Kind` does not change that direction semantics.
- Process Flow Views do not define new responsibilities, external context elements, Structural Dependencies, or Runtime Interactions.
- Do not infer Process Flow edges from Dependencies, Dependency Views, Runtime View, Responsibility Details, prose, names, or table order.
- Do not infer Structural Dependencies or Runtime Interactions from Process Flow Views.
- A generator must use only Process Flow View and Edge kinds and Process Flow edges explicitly defined in the machine-readable Process Flow structures.
- Unknown Process Flow View or Edge kind values are invalid and must be rejected rather than treated as `normal`.
- Additional kinds may be introduced later only by extending this schema and the corresponding parser, validator, model, and generator behavior.

Process Flow View, Dependency View, and Runtime View describe different architecture meanings:

```text
Dependency View:
A → B = A requires B to fulfill A's responsibility

Process Flow View:
A → B = processing progresses from A toward B

Runtime View:
A → B = A interacts with B at runtime in a specific scenario
```

## Building Block View

Use `## 5. Building Block View` as the home of the YTR responsibility model.

### Responsibility Inventory

Start the Building Block View with a child heading exactly named `### Responsibility Inventory` followed immediately by this table structure:

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_DND_INTERACTION | DnD Interaction | Manages DnD start eligibility and interaction progress through completion. |
| RESP_DATA_UPDATE | Data Update | Applies a committed reorder request to Table data. |

Rules:

- `ID` is the stable responsibility ID.
- `Responsibility` is the stable human-readable responsibility name.
- `Summary` states what the responsibility is accountable for at architecture level.
- Every responsibility detail section must correspond to exactly one row in this table.
- Do not list source files, classes, functions, hooks, components, or other implementation units.

### Dependencies

After the Responsibility Inventory, define a child heading exactly named `### Dependencies` followed immediately by this table structure:

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_DND_INTERACTION | RESP_REORDER_MODE | DnD start requires the current reorder direction. |

`A → B` means that A requires B in order to fulfill A's own responsibility. This direction represents a Structural Dependency.

Rules:

- `Dependent` is the architecture element that depends on another element.
- `Depends on` is the architecture element required by the dependent element.
- `Dependent` and `Depends on` must contain stable IDs defined in the External Context or Responsibility Inventory tables.
- `Reason` states why `Dependent` requires `Depends on` to fulfill its responsibility.
- `Reason` must not describe Runtime Interaction such as a request, reply, event, command, or return direction.
- The `Dependent + Depends on` pair must be unique within the architecture document. Duplicate pairs are invalid and must be rejected by validation.
- Direction is significant. A dependency in one direction does not imply a dependency in the opposite direction.
- Do not infer Structural Dependencies from responsibility detail prose, contracts, runtime steps, names, or natural language.
- Do not create implicit Structural Dependencies that are absent from this table.
- Parsers, validators, and generators must interpret only the stable IDs and fixed columns. They must not infer the relationship or its direction from `Reason` prose.
- The Dependencies table is the source of truth for the Architecture Model's Structural Dependencies.
- Do not omit a Structural Dependency from the Architecture Model merely to make a generated view easier to read.

### Dependency Views

An architecture document may define static views of the Structural Dependency model. When present, define exactly one child heading named `### Dependency Views` immediately after `### Dependencies` and before `### Responsibility Details`.

Use this exact table structure:

| ID | Name | Includes |
| --- | --- | --- |
| DV_GUIDANCE | Guidance | RESP_FIRST_USE_GUIDANCE RESP_REORDER_REDISCOVERY RESP_REORDER_MODE RESP_EDITOR_DOM_CONTEXT EXT_WORDPRESS_EDITOR |
| DV_DND_CORE | DnD Core | RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_TABLE_INTEGRATION |

Rules:

- `### Dependency Views` may appear at most once in one architecture document.
- Define multiple Dependency Views as multiple rows in the same table.
- `ID` is the stable Dependency View ID and must use the `DV_` prefix.
- Dependency View IDs must be unique within the architecture document.
- `Name` is the human-readable display name for the view.
- `Includes` is a whitespace-separated list of stable IDs explicitly included in the view.
- Every ID in `Includes` must be defined in the External Context or Responsibility Inventory tables.
- A generator must include only the elements explicitly named in `Includes`.
- A view contains only Dependencies whose `Dependent` and `Depends on` are both present in that view's `Includes`.
- External elements and related responsibilities needed in a view must be named explicitly in `Includes`.
- A generator must not infer view membership from responsibility names, Dependency structure, Runtime View, prose, or other context.
- A Dependency View is a presentation of part of the Architecture Model. It does not define new Structural Dependencies, architecture responsibilities, responsibility boundaries, or groups.
- Dependencies not shown in a particular view still exist in the Architecture Model.
- A generator must not add, remove, reverse, or merge Structural Dependencies to suit a view.

### Responsibility Details

After Dependencies, or after Dependency Views when that section is present, group responsibility definitions under a child heading exactly named `### Responsibility Details`.

Each responsibility must be a child heading using this form:

`#### <Responsibility name> {#<Responsibility ID>}`

Example:

`#### DnD Interaction {#RESP_DND_INTERACTION}`

The responsibility name and embedded ID in this heading are machine-readable and must match one row in the Responsibility Inventory. The contents below the heading remain human-readable design information unless another rule explicitly defines a machine-readable structure.

Within each responsibility, use the following child sections when applicable.

##### Responsibility

Describe what the responsibility owns conceptually and what it is accountable for.

##### State ownership

Describe the state or data the responsibility owns, including important state it explicitly does not own.

##### Contract

Describe what the responsibility receives and what it provides across its boundary. A Contract is not the source of truth for Structural Dependencies.

##### Lifecycle

Describe when the responsibility becomes active, when its state is initialized or reset, and when it ends or is discarded.

##### Invariants

Describe the internal rules that must remain true while the responsibility is valid.

Use Invariants to record prohibited coupling or negative dependency boundaries that apply to one responsibility, such as a requirement not to depend on a specific responsibility or not to read specific information. Use `## 2. Architecture Constraints` instead when the prohibition applies architecture-wide.

Do not add `##### Dependencies` under Responsibility Details. Positive Structural Dependencies belong only in the machine-readable `### Dependencies` table.

## Runtime View

Use `## 6. Runtime View` for important runtime scenarios whose ordered collaboration is necessary to understand the architecture.

Runtime View and Structural Dependencies describe different things:

```text
Dependencies:
A → B = A requires B to fulfill A's responsibility

Runtime View:
A → B = A interacts with B at runtime
```

A Runtime View step does not have to use the same direction as a Structural Dependency or Process Flow edge. Do not infer a Structural Dependency or Process Flow edge from Runtime View, and do not infer Runtime Interaction from Dependencies or Process Flow Views.

Each runtime scenario must use this heading form:

`### <Runtime scenario name> {#<Runtime scenario ID>}`

Example:

`### DnD start attempt {#RV_DND_START}`

The runtime scenario name and embedded ID in this heading are machine-readable and identify the scenario represented by the table below it.

Immediately below the heading, include a short human-readable purpose or scenario description, followed by a table with this exact structure:

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | Passes a DnD start attempt and its start target. |
| 2 | RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | Requests resolution of the movable reorder target. |

Rules:

- `Step` must be a positive integer.
- Step numbers must start at `1`, be unique within the runtime scenario, and increase without gaps.
- `Source` and `Target` must contain stable IDs defined in the External Context or Responsibility Inventory tables.
- `Interaction` states what architecture-level request, event, command, result notification, or control meaning crosses the boundary in that step.
- Runtime order comes only from the `Step` column. Do not infer order from prose or table position when the Step value says otherwise.
- Runtime steps are independent from Structural Dependency direction and Process Flow direction and do not need a same-direction entry in either source.
- Runtime scenarios do not define new responsibilities, external context elements, Structural Dependencies, or Process Flow edges.
- Do not infer missing Runtime Interaction from the Dependencies table or Process Flow Views.
- Record architecture-significant requests, events, commands, and other interactions. Omit a simple reply or return by default when it adds no architecture meaning.
- A result notification may be included when the notification itself is important to understanding the architecture.
- Do not use source-code calls, handlers, DOM procedures, or implementation sequencing as runtime steps.

The Runtime View is a machine-readable description of ordered runtime collaboration. How a later Structurizr generator represents that sequence is outside the documentation-format rules and must not change the Markdown meaning defined here.

## Document-level architecture information

Use the arc42 sections outside the Building Block View and Runtime View to describe architecture information that spans multiple responsibilities when it is relevant to understanding the system as a whole.

Cover these perspectives in the appropriate arc42 section rather than creating a second competing responsibility model:

- Responsibility collaboration and major flow rationale.
- Data and state flow across responsibility boundaries.
- System-wide state ownership.
- Architecture-wide invariants.
- External integration boundaries.
- Cross-responsibility lifecycle and context boundaries.
- Architecture-wide constraints.
- Architecturally significant quality requirements.

Keep these descriptions at architecture level. Do not turn them into source structure, concrete call sequences, DOM procedures, test design, or implementation plans.

Do not duplicate every detail already described under individual responsibilities. Use document-level sections for dependencies, flows, boundaries, constraints, and rules that are easier to understand from the system-wide view.

## Naming

- Architecture responsibility names are conceptual names, not implementation identifiers.
- Do not assume a responsibility name must become a source file, class, function, or module name.
- Do not rename architectural responsibilities merely because implementation structure changes.
- Stable IDs are references for architecture documents and generated representations; they do not require implementation identifiers with the same spelling.

## Machine-readable parsing boundary

Any parser, validator, or generator that consumes architecture Markdown must follow these rules:

- Read architecture entities only from the fixed machine-readable headings and tables defined in this file.
- Match headings and table columns exactly as defined here.
- Resolve references only by stable ID.
- Reject missing, duplicate, malformed, or unresolved IDs rather than guessing their intended target.
- Reject malformed required table structures rather than recovering architecture information from surrounding prose.
- Reject duplicate `Dependent + Depends on` pairs in the Dependencies table.
- If `### Process Flow Views` is present, allow the heading at most once under `## 4. Solution Strategy`, parse Process Flow Views only from `#### <name> {#PV_* kind=<kind>}` headings and their fixed `From | To | Kind | Meaning` tables, require View `kind` to be `normal` or `failure-recovery`, require Edge `Kind` to be `normal`, `failure`, or `recovery`, and require every `From` and `To` ID to resolve to an External Context or Responsibility Inventory entry.
- Require Process Flow View IDs to be unique and reject duplicate `From + To` pairs within a Process Flow View.
- Do not infer Process Flow View or Edge kind from names, prose, other kinds, relationship direction, or table order.
- If `### Dependency Views` is present, require it to appear immediately after `### Dependencies`, allow the heading at most once, and parse multiple views only from rows of its fixed table.
- Require Dependency View IDs to be unique and require every `Includes` ID to resolve to an External Context or Responsibility Inventory entry.
- Do not use natural-language interpretation, AI inference, fuzzy matching, responsibility names, heading similarity, or prose analysis to supplement missing machine-readable information.
- Do not infer Structural Dependencies from Process Flow Views, Runtime View, Contract, Responsibility Details, or prose.
- Do not infer Process Flow edges from Dependencies, Dependency Views, Runtime View, Responsibility Details, prose, or names.
- Do not infer Runtime Interaction from Dependencies or Process Flow Views.
- Do not infer Dependency View membership from Dependencies, Process Flow Views, Runtime View, prose, or names.
- Given the same valid Markdown input, parsing must produce the same architecture elements, Structural Dependencies, Dependency Views, Process Flow Views, and Runtime Interactions.

## Example

Good:

```markdown
## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | Provides the editing environment in which YTR operates. |

## 4. Solution Strategy

### Process Flow Views

#### Reorder End-to-End {#PV_REORDER_END_TO_END kind=normal}

Show the major processing direction from editor input into reorder processing.

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_DND_INTERACTION | normal | Reorder processing progresses from the editor into DnD coordination. |
| RESP_DND_INTERACTION | RESP_DATA_UPDATE | normal | A confirmed reorder progresses to data update. |

#### Reorder Failure and Recovery {#PV_REORDER_FAILURE_RECOVERY kind=failure-recovery}

Show failure propagation and the recovery path back to a stable reorder state.

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_DATA_UPDATE | RESP_DND_INTERACTION | failure | A failed update progresses back to the reorder operation boundary. |
| RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | recovery | Recovery progresses to presentation cleanup and abort. |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_DND_INTERACTION | DnD Interaction | Manages DnD start eligibility and interaction progress through completion. |
| RESP_REORDER_MODE | Reorder Mode | Owns the current edit, row-reorder, or column-reorder mode. |
| RESP_REORDER_TARGET_RESOLUTION | Reorder Target Resolution | Determines whether the attempted start target can become the moving row or column. |
| RESP_DATA_UPDATE | Data Update | Applies a committed reorder request to Table data. |
| RESP_REORDER_PRESENTATION | Reorder Presentation | Represents reorder interaction state to the user without owning Table data. |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_DND_INTERACTION | RESP_REORDER_MODE | DnD start requires the current reorder direction. |
| RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | DnD start requires movable-target eligibility. |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_DND_CORE | DnD Core | RESP_DND_INTERACTION RESP_REORDER_MODE RESP_REORDER_TARGET_RESOLUTION |

### Responsibility Details

#### DnD Interaction {#RESP_DND_INTERACTION}

##### Responsibility

Manage DnD start eligibility and interaction progress through completion without owning Table data.

##### State ownership

Own active DnD interaction state only after a start target has been accepted.

##### Contract

Receive DnD start attempts and progress input. Obtain the current reorder direction and target eligibility needed to decide whether DnD can start.

##### Lifecycle

Create active DnD state only after successful target resolution and discard it on completion or cancellation.

##### Invariants

- Do not start DnD for a target that Reorder Target Resolution rejects.

## 6. Runtime View

### DnD start attempt {#RV_DND_START}

Describe the collaboration that either starts DnD with a movable target or rejects the attempt before active DnD state exists.

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | Requests movable-target resolution for the attempted start target. |
| 2 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | Notifies DnD Interaction when the target cannot be used and why. |
```

The Process Flow rows describe overall processing direction without defining runtime order. Process Flow View and Edge kinds explicitly classify the flow for generated representations without changing Process Flow direction semantics. The second runtime step may point opposite to the Structural Dependency. Runtime direction represents interaction direction, not dependency or Process Flow direction.

Bad:

> `drag-controller.ts` calls `resolveTarget()` from `handlePointerDown()`, so the generator should infer a Structural Dependency, a Process Flow edge, and both runtime directions automatically.
