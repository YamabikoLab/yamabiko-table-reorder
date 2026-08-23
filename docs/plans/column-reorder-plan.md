# PLAN-422: Column Reorder implementation

## References

- Parent issue: #422
- Requirements: #422 discussion and the current column-reorder design decisions
- Design: `docs/development/source-organization.md`, especially the `common` / `row-reorder` ownership rules established by #449 / PR #450

## Goal

Define a staged implementation path for adding accessible column reordering to Core Table and Flexible Table Block without coupling column behavior to the existing row-reorder implementation or introducing shared abstractions before real reuse is proven.

The plan should be detailed enough to create one implementation parent issue and a small set of child issues whose boundaries are stable and independently reviewable.

## Scope

### Included

- Add column reordering as an independent `src/column-reorder/` feature boundary.
- Define the canonical data transformation for moving one column across `head` / `body` / `foot`.
- Define the DOM/context boundary needed by column UI without changing row-specific context prematurely.
- Define the column control model and interaction flow for pointer, keyboard, single-pointer, and touch operation.
- Reuse the existing Editor Environment and SortableJS runtime loader from `src/common/`.
- Define when row/column duplication should remain local and when a responsibility may move to `common/`.
- Stage merged-cell support behind a later logical-grid phase.
- Define the unit, integration, and E2E validation strategy.
- Produce a child-issue breakdown after this plan is reviewed.

### Not included

- Implementing column reordering in this plan task.
- Refactoring row reorder into a generic row/column controller before column implementation exists.
- Adding `axis: 'row' | 'column'` abstractions across existing row code.
- Moving row-specific block support, table context, guidance, live status, scrolling, drag UI, or controller lifecycle into `common/` in anticipation of future reuse.
- Replacing SortableJS.
- Multiple-column selection or multi-column movement.
- Moving a merged multi-column region as one unit.
- Column resizing.
- Simultaneous row and column drag.
- Changes to Flexible Table Block itself.
- A generic adapter framework for arbitrary table blocks.

## Approach

Treat column reorder as a separate feature first, then compare the completed row and column implementations before extracting shared code.

The initial dependency shape is:

```text
                   src/index.tsx
                   /           \
                  ↓             ↓
          row-reorder/    column-reorder/
                  \             /
                   ↓           ↓
                      common/
```

`column-reorder/` must not import implementation details from `row-reorder/`.

Only responsibilities that are already feature-neutral and stable are shared from the start:

- `src/common/editor-environment.ts`
- `src/common/sortable-runtime-loader.ts`

For other areas, small duplication is preferable to an unclear abstraction. A shared extraction is considered only after both row and column consumers demonstrate the same stable responsibility.

Column movement uses Gutenberg attributes as the canonical data source. The live table DOM is never the authoritative state for the final order.

The first implementation milestone intentionally excludes merged cells. This keeps the first data transformation simple and gives UI/controller work a stable base before introducing logical-grid complexity.

## Architecture

### Plugin entry

`src/index.tsx` remains the thin plugin-wide entry. Once column reorder is implemented, it may compose both feature adapters but must not absorb feature logic.

### `src/common/`

Keep the existing shared environment/runtime responsibilities:

- `editor-environment.ts`: resolve the current iframe or non-iframe editor browsing context without caching stale lifecycle state.
- `sortable-runtime-loader.ts`: load/reuse the SortableJS runtime in the owning editor window.

Do not expand `common/` during the first column phases merely because row and column code look similar.

### `src/row-reorder/`

Remain unchanged unless real column implementation demonstrates a stable shared responsibility.

The following stay row-owned initially:

- row block support
- row table context
- `rowspan` constraints
- row order
- row controls and move targets
- row messages/styles
- row controller lifecycle
- row guidance/live status/scroll behavior

### `src/column-reorder/`

Create this boundary only when implementation begins. Expected responsibilities are:

```text
src/column-reorder/
├── column-order.ts
├── column-order.test.ts
├── block-support.ts              # only if needed by real implementation
├── table-context.ts              # only if needed by real implementation
├── messages.ts                   # as user-visible column UI appears
├── editor.scss                   # as column UI appears
├── use-column-reorder*.ts(x)     # shape determined by actual integration pressure
└── controller/
    ├── sortable-controller.ts    # column-owned controller
    └── reorder-ui/               # column controls / destinations / status as needed
```

This is a responsibility sketch, not a requirement to create placeholder files or mirror the row tree exactly.

### Column data transformation

The first pure function moves one zero-based column index to another across every existing table section in one deterministic transformation.

Conceptually:

```ts
moveColumn( attributes, oldColumnIndex, newColumnIndex )
```

The exact public API may differ, but the behavior must satisfy these rules:

- process `head`, `body`, and `foot` when present;
- move the same column index in every row;
- preserve missing sections;
- preserve cell objects and cell data, changing only array order;
- do not modify unrelated attributes such as caption data;
- reject the transformation safely when participating rows do not have a consistent usable column shape;
- return data suitable for one Gutenberg `setAttributes()` commit so save/reload and Undo work naturally.

The pure transformation must not depend on DOM, SortableJS, React, or WordPress editor context.

### Column DOM context

Do not extend `row-reorder/table-context.ts` before column code exists.

The column feature should first define only the DOM context it actually needs, likely including the block element, table element, editor document/window, and section/cell geometry needed to place controls.

If both row and column contexts later duplicate the same stable base discovery, consider extracting a narrow common table context, for example:

```text
common/table-context.ts
    ↓
blockElement
table
document
window

row-reorder/table-context.ts
    ↓
common base + tbody

column-reorder/table-context.ts
    ↓
common base + column-specific section/geometry resolution
```

This extraction is optional and must be justified by the implemented consumers.

### Block support

Do not add `colspanProperty` to the existing row-owned support type in advance.

Column implementation may begin with its own block-specific support boundary if schema differences require it. If row and column later share the same supported-block recognition or property mapping responsibility, extract only that stable part.

### Column control layer

Do not make real `td` / `th` nodes the SortableJS sibling list.

Create a column-control layer positioned from table geometry. SortableJS, where used, reorders controls horizontally while the actual table cells remain owned by Gutenberg/React.

At commit time, convert the resolved `oldColumnIndex` / `newColumnIndex` into one attribute transformation.

The control implementation must account for:

- table position and column widths;
- editor iframe/non-iframe ownership;
- horizontal table scrolling;
- control geometry refresh after editor/table changes;
- coexistence with row controls;
- focus restoration after commit/cancel.

Exact geometry/update mechanisms should be selected during implementation based on the smallest reliable solution rather than predetermined in this plan.

### Interaction model

Keep the user-facing mental model aligned with row reorder where practical, while allowing column-specific mechanics.

Expected behavior:

- Pointer drag: drag a column control horizontally.
- Single pointer: activate a column control, then choose a destination.
- Keyboard: start/confirm with `Enter` or `Space`, move with `ArrowLeft` / `ArrowRight`, cancel with `Escape`.
- Touch: enter column reorder mode, then use a destination tap and/or long-press drag according to the implemented interaction design.

Keyboard focus, announcements, guidance, and invalid-move feedback are part of feature completeness, not optional polish.

### Shared-code review point

After basic column pointer/keyboard behavior exists, compare row and column implementations.

Candidate responsibilities include:

- live status / announcement plumbing;
- guidance lifecycle;
- scroll-target logic;
- focus restoration helpers;
- common controller setup/cleanup pieces;
- common interaction state pieces;
- supported-block recognition;
- base table-context discovery.

Move code to `common/` only when the two implementations require the same contract and behavior. Similar names or similar-looking code are not sufficient justification.

### Merged cells and logical grid

Do not introduce logical-grid code in the initial non-merged implementation.

When `rowSpan` / `colSpan` support begins, add a pure logical table/column grid capable of resolving, for each cell:

- section;
- row index;
- attribute/DOM cell index;
- logical start column;
- logical columns occupied by `colSpan`;
- logical rows occupied by `rowSpan`.

The merged-cell constraints are:

- a logical column inside a multi-column `colSpan` region is not independently movable;
- an insertion boundary inside a `colSpan` region is invalid;
- invalid moves must not change attributes;
- moving an entire merged multi-column region as one unit remains out of scope;
- `rowSpan` is not inherently a reason to disable a column, but the grid must resolve the correct column position across rows whose physical cell indexes differ.

Keep `row-reorder/rowspan.ts` row-specific. Do not grow it into a whole-table grid parser.

## Implementation phases

### Phase 1: Pure column-order foundation

- Outcome: column movement is defined independently of DOM/UI and can safely transform non-merged Core Table / Flexible Table Block-shaped attributes.
- Tasks:
  - create `src/column-reorder/`;
  - implement `column-order.ts` and focused tests;
  - support `head` / `body` / `foot` when present;
  - preserve unrelated attributes and cell objects;
  - reject inconsistent row shapes safely;
  - document the new feature boundary when it becomes real.
- Validation:
  - focused Jest coverage for normal moves, boundary indexes, missing sections, inconsistent rows, and immutability expectations;
  - repository Node/build checks when code is introduced.

### Phase 2: Column integration boundary and control prototype

- Outcome: the editor can resolve a supported table and render stable column controls aligned to non-merged columns without committing a move through DOM mutation.
- Tasks:
  - add only the block-support and table-context capabilities required by column reorder;
  - connect the feature from the thin plugin entry;
  - render/position column controls;
  - define coexistence rules with row controls;
  - establish geometry refresh and focus ownership.
- Validation:
  - focused jsdom tests where deterministic;
  - manual verification in iframe and non-iframe editors;
  - no row-reorder behavior regression.

### Phase 3: Keyboard and single-pointer reorder

- Outcome: column reorder is usable without drag and has an accessible deterministic state model.
- Tasks:
  - implement activation, destination movement, commit, cancel, and focus restoration;
  - support `ArrowLeft` / `ArrowRight` keyboard movement;
  - add appropriate announcements/guidance;
  - implement single-pointer destination selection.
- Validation:
  - focused controller/UI Jest tests;
  - keyboard/manual accessibility checks;
  - save/reload and Undo checks after commit.

### Phase 4: Pointer drag with SortableJS

- Outcome: pointer users can drag column controls horizontally while real table cell DOM remains untouched during drag.
- Tasks:
  - use `common/sortable-runtime-loader.ts`;
  - configure horizontal SortableJS behavior for the control layer;
  - resolve old/new indexes and commit through `column-order`;
  - implement necessary horizontal scrolling behavior;
  - preserve cancellation and focus behavior.
- Validation:
  - focused controller tests with mocked SortableJS where useful;
  - real-browser pointer DnD E2E;
  - verify no canonical table DOM ownership conflict during drag.

### Phase 5: Touch interaction

- Outcome: touch users can reorder columns with the same safety and feedback expectations as row reorder.
- Tasks:
  - define the smallest consistent touch mode;
  - support destination tap and/or long-press drag based on implementation findings;
  - prevent accidental table editing while the reorder interaction is active;
  - add touch-specific guidance and focus handling where required.
- Validation:
  - focused touch controller tests;
  - real touch/pointer Playwright coverage.

### Phase 6: Shared-responsibility review

- Outcome: only demonstrated stable row/column duplication is extracted to `common/`.
- Tasks:
  - compare completed row/column contexts, block support, controller lifecycle, focus, status, guidance, and scrolling;
  - keep feature-local code where contracts differ;
  - extract narrowly scoped common modules only when they reduce duplication without introducing row/column conditionals.
- Validation:
  - existing row tests remain unchanged or become simpler;
  - column tests continue to prove their feature contract;
  - `common/` does not depend on either feature.

### Phase 7: Merged-cell logical grid and constraints

- Outcome: column reorder can reason correctly about `rowSpan` / `colSpan` without corrupting table structure.
- Tasks:
  - implement pure logical-grid resolution;
  - detect invalid source columns and insertion boundaries;
  - integrate the grid with column-order validation and UI availability;
  - preserve all merged-cell data while allowing only structurally safe moves.
- Validation:
  - exhaustive unit cases for grid occupancy and valid/invalid boundaries;
  - Core Table and Flexible Table Block merged-cell browser checks;
  - save/reload and Undo validation.

### Phase 8: End-to-end completion

- Outcome: supported column-reorder workflows are covered across representative WordPress editor environments.
- Tasks:
  - add E2E for core user flows and data persistence;
  - cover pointer, keyboard, touch, save/reload, Undo, iframe/non-iframe, and merged-cell constraints according to implemented scope;
  - avoid duplicating deterministic unit cases in E2E.
- Validation:
  - existing PR Validation matrix for WordPress 6.8.3, 7.0.4, and 7.1.0;
  - focused manual checks for behavior that remains impractical to assert reliably in E2E.

## Decisions and validation questions

### Decide before implementation

The following are fixed architectural decisions for child issues:

- `column-reorder/` is an independent feature boundary.
- `column-reorder/` does not depend on `row-reorder/`.
- Gutenberg attributes are the canonical data source and commit target.
- The first implementation excludes `rowSpan` / `colSpan`.
- Logical-grid parsing is deferred to the merged-cell phase.
- Real table cells are not the SortableJS sortable sibling list.
- Editor Environment and SortableJS runtime loading are the only existing responsibilities assumed shared from the start.
- Existing row-owned block support and table context are not expanded preemptively for column needs.
- No generic row/column controller or `axis` abstraction is introduced before concrete duplication is demonstrated.

### Validate during implementation

The following should be answered through implementation evidence instead of premature design:

- What is the smallest reliable column-control DOM structure?
- What geometry refresh mechanism is required for editor/table resizing and horizontal scrolling?
- Should the first control layer use one control per logical column or separate handle/destination elements?
- How should row controls and column controls arbitrate hover/activation when both are visible?
- Which guidance/live-status/focus behaviors are truly identical to row reorder?
- Is base block recognition identical enough to share, or do row/column support contracts remain different?
- Is base table DOM discovery stable enough to extract to `common/` after both implementations exist?
- Which horizontal auto-scroll behavior can reuse row scrolling mechanics unchanged, if any?
- What touch interaction gives the clearest behavior without interfering with cell editing?

## Issue breakdown

Create the implementation parent and child issues only after this plan is reviewed. The recommended initial breakdown is:

- [ ] Parent: implement column reordering for supported Table blocks.
- [ ] Child: add `column-reorder` boundary and pure non-merged `column-order` transformation.
- [ ] Child: add column block/context integration and column-control UI.
- [ ] Child: implement keyboard and single-pointer column reorder.
- [ ] Child: implement pointer drag and horizontal scrolling with SortableJS.
- [ ] Child: implement touch column reorder.
- [ ] Child: review row/column duplication and extract only proven common responsibilities.
- [ ] Child: add logical grid and merged-cell column constraints.
- [ ] Child: complete column-reorder E2E coverage and persistence/Undo scenarios.

If implementation evidence shows one child is too broad or two children are tightly coupled, adjust the breakdown before opening the affected issues rather than forcing this provisional list.

## Validation

For this plan-only change:

- `git diff --check origin/main...HEAD`
- Review the rendered Markdown and confirm that #422 can become a concise plan-creation issue without duplicating this document.

For future implementation work, use `docs/development/testing.md` as the command source of truth. Expected validation by phase includes:

- focused Jest tests while developing pure/controller/UI logic;
- `npm test` and `npm run build` before handoff for product source changes;
- `git diff --check origin/main...HEAD`;
- Playwright E2E for real WordPress/browser interaction, iframe/non-iframe behavior, SortableJS, touch, save/reload, and Undo where applicable.

## Completion criteria

This planning issue is complete when:

- this plan reflects the source boundaries established by #449 / PR #450;
- the non-merged minimum implementation and later merged-cell expansion are separated clearly;
- row-owned code is not designated shared without a second real consumer;
- column data, DOM, controller, UI, accessibility, and validation responsibilities are sufficiently defined for implementation issues;
- unresolved implementation details are identified as validation questions rather than hidden assumptions;
- a stable parent/child issue breakdown can be created from this plan after review;
- #422 can point to this plan as the design source of truth instead of duplicating the detailed design.

## Notes

The implementation phases are intentionally ordered from data correctness to interaction complexity. The plan does not require each phase to map one-to-one to a pull request, but each child issue should produce a reviewable outcome and should not mix unrelated future abstraction work into the feature step.

The key guardrail is to let implementation pressure reveal shared responsibilities. The goal is not to duplicate row reorder forever, but to avoid turning the newly clarified `common` boundary into a speculative shared bucket before column reorder provides real evidence.
