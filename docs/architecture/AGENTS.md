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
- **Solution Strategy**: Summarize the principal architecture choices that shape the responsibility model without describing implementation steps.
- **Building Block View**: Define YTR architectural responsibilities, their stable IDs, relationships, state ownership, contracts, dependencies, lifecycle, and invariants.
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

The machine-readable source is limited to the fixed headings and tables defined in this file. A parser or generator must not infer architecture elements, relationships, runtime interactions, IDs, or references from explanatory prose.

The following structures are machine-readable:

- External Context table under `## 3. Context and Scope`.
- Responsibility Inventory table under `## 5. Building Block View`.
- Relationships table under `## 5. Building Block View`.
- Responsibility detail headings under `### Responsibility Details`; only the responsibility name and embedded responsibility ID in each heading are machine-readable.
- Runtime Scenario headings under `## 6. Runtime View`; the scenario name and embedded runtime scenario ID are machine-readable.
- Runtime Scenario tables under `## 6. Runtime View`.

The following information is human-readable only unless another rule explicitly defines a machine-readable structure:

- Explanatory prose in any arc42 section.
- Responsibility detail section contents below the machine-readable responsibility heading identity.
- `Responsibility`, `State ownership`, `Contract`, `Dependencies`, `Lifecycle`, and `Invariants` descriptions.
- Rationale, constraints, crosscutting concepts, quality explanations, risks, and glossary descriptions.

Do not duplicate machine-readable architecture facts in another machine-readable form. The fixed heading or table is the source of truth for the fact it represents; explanatory prose may explain its meaning but must not redefine it.

## Stable IDs

Assign stable IDs to architecture elements that must be referenced from machine-readable structures.

IDs are required for:

- External context elements.
- Architectural responsibilities.
- Runtime scenarios.

IDs must:

- Use only ASCII letters, digits, and `_`.
- Start with an ASCII letter.
- Be unique within the architecture document.
- Remain stable when display names or explanatory wording change.
- Represent architecture identity rather than source-code identity.

Use these prefixes:

- External context: `EXT_`
- Responsibility: `RESP_`
- Runtime scenario: `RV_`

Examples:

- `EXT_WORDPRESS_EDITOR`
- `EXT_TABLE_BLOCK`
- `RESP_DND_INTERACTION`
- `RESP_DATA_UPDATE`
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
- Relationships between external elements and responsibilities are not inferred from this table. Define them explicitly in the Relationships table.

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

### Relationships

After the Responsibility Inventory, define a child heading exactly named `### Relationships` followed immediately by this table structure:

| Source | Destination | Description |
| --- | --- | --- |
| RESP_DND_INTERACTION | RESP_DATA_UPDATE | Passes only a committed reorder request after a valid DnD completes. |

Rules:

- `Source` and `Destination` must contain stable IDs defined in the External Context or Responsibility Inventory tables.
- `Description` states the architectural meaning of the relationship.
- Direction is significant. Do not treat relationships as bidirectional unless two explicit rows are present.
- Do not infer relationships from responsibility detail prose, dependency descriptions, runtime steps, names, or natural language.
- Do not create implicit relationships that are absent from this table.
- Runtime scenarios may reference a relationship defined here, but they do not create new architecture relationships by themselves.

### Responsibility Details

After Relationships, group responsibility definitions under a child heading exactly named `### Responsibility Details`.

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

Describe what the responsibility receives, what it provides to other responsibilities, and the boundaries of those interactions.

##### Dependencies

Describe which responsibilities it depends on, which responsibilities depend on it, and any direct coupling that must not exist.

This section is explanatory. The Relationships table remains the machine-readable source of truth for architecture relationships.

##### Lifecycle

Describe when the responsibility becomes active, when its state is initialized or reset, and when it ends or is discarded.

##### Invariants

Describe the internal rules that must remain true while the responsibility is valid.

## Runtime View

Use `## 6. Runtime View` for important runtime scenarios whose ordered collaboration is necessary to understand the architecture.

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
| 3 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | Returns whether the target is movable and, when not movable, the reason. |

Rules:

- `Step` must be a positive integer.
- Step numbers must start at `1`, be unique within the runtime scenario, and increase without gaps.
- `Source` and `Target` must contain stable IDs defined in the External Context or Responsibility Inventory tables.
- `Interaction` states what architecture-level information, request, result, or control meaning crosses the boundary in that step.
- Runtime order comes only from the `Step` column. Do not infer order from prose or table position when the Step value says otherwise.
- A runtime step must use an architecture relationship that is explicitly present in the Relationships table in the same direction.
- Runtime scenarios do not define new responsibilities or external context elements.
- Do not use source-code calls, handlers, events, DOM procedures, or implementation sequencing as runtime steps.

The Runtime View is a machine-readable description of ordered architecture collaboration. How the later Structurizr generator represents that sequence is outside the documentation-format rules and must not change the Markdown meaning defined here.

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

Do not duplicate every detail already described under individual responsibilities. Use document-level sections for relationships, flows, boundaries, constraints, and rules that are easier to understand from the system-wide view.

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
- Do not use natural-language interpretation, AI inference, fuzzy matching, responsibility names, heading similarity, or prose analysis to supplement missing machine-readable information.
- Do not infer missing Relationships from Runtime View steps or responsibility Dependencies.
- Given the same valid Markdown input, parsing must produce the same architecture information.

## Example

Good:

```markdown
## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | Provides the editing environment in which YTR operates. |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_DND_INTERACTION | DnD Interaction | Manages DnD start eligibility and interaction progress through completion. |
| RESP_REORDER_TARGET_RESOLUTION | Reorder Target Resolution | Determines whether the attempted start target can become the moving row or column. |

### Relationships

| Source | Destination | Description |
| --- | --- | --- |
| RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | Requests movable-target resolution when DnD start is attempted. |
| RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | Returns the resolution result and any reason that prevents DnD start. |

### Responsibility Details

#### DnD Interaction {#RESP_DND_INTERACTION}

##### Responsibility

Manage DnD start eligibility and interaction progress through completion without owning Table data.

##### State ownership

Own active DnD interaction state only after a start target has been accepted.

##### Contract

Receive DnD start attempts and progress input. Request target resolution before creating an active DnD interaction.

##### Dependencies

Depend on Reorder Target Resolution for start-target eligibility.

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
| 2 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | Returns the resolution result and any reason that prevents DnD start. |
```

Bad:

> `drag-controller.ts` calls `resolveTarget()` from `handlePointerDown()`, and the generator should infer that DnD Interaction depends on Reorder Target Resolution.
