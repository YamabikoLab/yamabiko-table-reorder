# Architecture documentation instructions

These instructions apply to architecture documents under `docs/architecture/`.

## Purpose

- Describe the internal responsibilities, boundaries, and contracts needed to realize the design.
- Explain how major responsibilities collaborate without defining implementation details.
- Keep architecture stable enough to remain useful when source files, functions, or implementation techniques change.

## Abstraction boundary

- Describe the technical structure between user-visible design and concrete implementation.
- Define major responsibilities, their boundaries, ownership, and contracts.
- Describe important data flow, state ownership, dependencies, lifecycle, and invariants where they are relevant to the responsibility.
- Do not merely translate design behavior into more technical wording; add the internal responsibility model needed to realize that behavior.
- Do not describe source files, concrete class or function names, variables, event handler names, implementation steps, DOM details, CSS details, or test implementation.
- Do not make architecture depend on the current source tree shape.

## Responsibility inventory

Start each architecture document with a responsibility inventory before describing individual responsibilities in detail.

- List the major responsibilities covered by the document.
- Give each responsibility a stable name and a short summary of what it is responsible for.
- Use the same responsibility names consistently in the inventory and in the detailed sections that follow.
- Keep the inventory at the architectural responsibility level; do not list source files, classes, functions, or other implementation units.
- Make the inventory complete enough that a reader can understand the overall responsibility split before reading the details.

Example:

| Responsibility | Summary |
| --- | --- |
| DnD Interaction | Manages the progress of a drag-and-drop interaction from start through completion. |
| Drop Target Resolution | Determines the currently valid destination candidate for the moving row or column. |
| Reorder Preview | Presents the moving item and current destination without changing Table data. |
| Data Update | Applies a committed reorder request to Table data. |

## Document-level architecture

In addition to describing each responsibility individually, describe the architecture that exists across responsibilities when it is relevant to understanding the system as a whole.

Cover the following perspectives as needed:

- **Responsibility relationships and collaboration**: Describe how responsibilities work together and which interactions form the main collaboration paths.
- **Data and state flow**: Describe how important information, state, and requests move across responsibilities from initiation through completion.
- **System-wide state ownership**: Make ownership boundaries visible across the architecture so that important state has a clear owner and is not implicitly shared.
- **Architecture-wide invariants**: Define rules that must remain true across multiple responsibilities, not only within one responsibility.
- **External integration boundaries**: Describe where the architecture meets external systems, platforms, blocks, or environments and what belongs on each side of the boundary.
- **Cross-responsibility lifecycle and context boundaries**: Describe lifecycle transitions or context changes that affect multiple responsibilities, including when shared interaction state becomes valid or must be discarded.
- **Architecture-wide constraints**: Record constraints that shape multiple responsibilities, such as scale, supported operating contexts, or separation requirements.

Keep these descriptions at the architecture level. Do not turn them into source structure, call sequences between concrete functions, DOM procedures, or implementation plans.

Do not duplicate every detail already described under individual responsibilities. Use document-level sections for relationships, flows, boundaries, and rules that are easier to understand from the system-wide view.

## Responsibility structure

Give each architectural responsibility a stable name that can be referenced consistently within architecture documents.

For each responsibility, use the following sections when applicable:

### Responsibility

Describe what the responsibility owns conceptually and what it is accountable for.

### State ownership

Describe the state or data the responsibility owns, including important state it explicitly does not own.

### Contract

Describe what the responsibility receives, what it provides to other responsibilities, and the boundaries of those interactions.

### Dependencies

Describe which responsibilities it depends on, which responsibilities depend on it, and any direct coupling that must not exist.

### Lifecycle

Describe when the responsibility becomes active, when its state is initialized or reset, and when it ends or is discarded.

### Invariants

Describe the internal rules that must remain true while the responsibility is valid.

## Naming

- Architecture responsibility names are conceptual names, not implementation identifiers.
- Do not assume a responsibility name must become a source file, class, function, or module name.
- Do not rename architectural responsibilities merely because implementation structure changes.

## Examples

Good:

### DnD Interaction

**Responsibility**  
Manage the progress of a drag-and-drop interaction from start through completion. Track the item being moved, the current destination candidate, and whether the interaction can be committed. When a valid interaction completes, produce a committed reorder request.

**State ownership**  
Own whether DnD is active, the row or column being moved, the current destination candidate, and whether the current interaction can be committed. Do not own Table data itself.

**Contract**  
Receive inputs corresponding to DnD start, movement, completion, and cancellation. While active, expose the current moving item and destination candidate to responsibilities that need them. When a valid DnD completes, pass a committed reorder request containing the moving item and resolved destination to Data Update. Do not provide a contract for directly mutating Table data.

**Dependencies**  
Depend on Drop Target Resolution to determine valid destination candidates. Reorder Preview may observe the interaction state owned here. Connect to Data Update only through the committed reorder request. Do not depend directly on Table data mutation.

**Lifecycle**  
Become active when DnD starts. Keep interaction state only while active. On commit or cancellation, end the active state and discard the moving item, destination candidate, and commit eligibility. Never carry state from a previous DnD interaction into the next one.

**Invariants**

- Do not change Table data while DnD is in progress.
- Do not retain a moving item or destination candidate while inactive.
- Do not produce a committed reorder request without a valid destination.
- A request passed to Data Update must already be committed at DnD completion time.
- DnD Interaction never becomes the owner of Table data.

Bad:

> `drag-controller.ts` calls `updateTableData()` from `handleDrop()` after `pointerup`.
