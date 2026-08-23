# Table Reorder

Table Reorder extends the Core Table block with row reordering powered by SortableJS.

## Implementation overview

- `with-table-reorder.tsx` is the thin Gutenberg composition and rendering adapter.
- `use-table-reorder.ts` connects Gutenberg notices / `setAttributes()` to the dedicated interaction and controller hooks.
- `use-table-reorder-interaction.ts` owns hover capability, input modality, touch reorder mode, and coachmark preferences.
- `use-table-reorder-controller.ts` owns SortableJS controller creation, cleanup, recreation, and focus restoration.
- `editor-environment.ts` isolates iframe / non-iframe editor browsing-context discovery and resolves the current editor `document` / `window` without caching them across editor lifecycle changes.
- `table-context.ts` consumes the Editor Environment boundary and resolves the target Table block, table, and `tbody` from the current editor document.
- `controller/sortable-controller.ts` owns imperative keyboard / pointer / drag session orchestration.
- SortableJS temporarily reorders Gutenberg-owned `<tbody><tr>` elements during dragging.
- SortableJS is initialized in the `window` that owns the target Table.
- On hover-capable devices, hovering a movable row reveals an inline handle at the left edge of the first cell. Dragging starts only from that handle, not from the row itself.
- On touch devices, reorder mode shows the same row controls. Tapping a handle starts destination selection, while dragging the handle starts SortableJS DnD. Long-pressing a row does not start DnD.
- Touch cell taps remain available for normal editing, and scrolling outside the row handles is not intercepted by Table Reorder.
- Rows involved in vertical merges (`rowspan`) cannot be moved, and insertion positions that would split a merged range are rejected.
- An insertion line shows the destination while dragging.
- At drag end, the temporary DOM order is restored before `setAttributes()` commits the reordered `body`, returning DOM ownership to Gutenberg.
- SortableJS provides the sorting animation and auto-scroll behavior.

## Files and responsibilities

```text
src/
├─ index.tsx
├─ with-table-reorder.tsx
├─ use-table-reorder.ts
├─ use-table-reorder-interaction.ts
├─ use-table-reorder-controller.ts
├─ messages.ts
├─ editor-environment.ts
├─ editor-environment.test.ts
├─ editor.scss
├─ controller/
│  ├─ sortable-controller.ts
│  ├─ sortable-controller.test.ts
│  ├─ sortable-controller-keyboard.test.ts
│  ├─ sortable-controller-pointer.test.ts
│  ├─ reorder-ui/
│  │  ├─ index.ts
│  │  ├─ row-controls.ts
│  │  ├─ row-controls.test.ts
│  │  ├─ reorder-guidance.ts
│  │  ├─ reorder-guidance.test.ts
│  │  ├─ row-move-targets.ts
│  │  ├─ row-move-targets.test.ts
│  │  ├─ live-status.ts
│  │  └─ live-status.test.ts
│  ├─ drag-ui.ts
│  ├─ drag-ui.test.ts
│  ├─ row-order.ts
│  ├─ row-order.test.ts
│  ├─ sortable-runtime-loader.ts
│  └─ sortable-runtime-loader.test.ts
├─ table-context.ts
├─ table-context.test.ts
├─ rowspan.ts
├─ rowspan.test.ts
└─ README.md
```

Responsibility boundaries:

- `index.tsx`: registers the HOC with `editor.BlockEdit` and loads the editor styles.
- `with-table-reorder.tsx`: identifies supported table blocks, renders the original `BlockEdit`, renders touch reorder controls, and provides the hidden anchor used to locate the Table DOM.
- `use-table-reorder.ts`: connects Gutenberg notices and `setAttributes()` to the lower-level Table Reorder hooks and returns the state / commands consumed by the HOC.
- `use-table-reorder-interaction.ts`: owns hover capability, input modality, touch reorder mode, coachmark preferences, and the interaction mode passed to the controller lifecycle.
- `use-table-reorder-controller.ts`: owns controller creation / destruction / recreation, delayed lifecycle safety, and focus restoration after body commits.
- `editor-environment.ts`: is the thin boundary for editor browsing-context discovery. It owns iframe / non-iframe detection and resolves the current editor `document` / `window` without caching the result across editor lifecycle changes. It does not wrap ordinary DOM-local or browser APIs.
- `table-context.ts`: consumes the Editor Environment boundary and resolves the target Table block, `table`, and `tbody` from the resolved editor document. It does not perform iframe detection or browsing-context fallback itself.
- `controller/sortable-controller.ts`: owns SortableJS callbacks, movable-row hover detection, keyboard / single-pointer sessions, mutable drag session state, temporary block-drag suppression, DOM ownership handoff, and controller cleanup. PC and touch both configure SortableJS with the shared row-control handle, so rows themselves are never drag-start areas.
- `controller/reorder-ui/index.ts`: compatibility facade that re-exports the existing reorder UI API for current consumers. It owns no UI lifecycle logic.
- `controller/reorder-ui/row-controls.ts`: owns row-control creation and cleanup, representative row text, accessible descriptions / Tooltip state, visibility, pressed state, cell style restoration, and the row-control propagation boundary.
- `controller/reorder-ui/reorder-guidance.ts`: owns operation guidance positioning / cleanup and keyboard destination scrolling.
- `controller/reorder-ui/row-move-targets.ts`: owns pointer / touch destination buttons, touch cancellation, tap-vs-swipe handling, positioning, guidance integration, and cleanup.
- `controller/reorder-ui/live-status.ts`: owns document-scoped assistive-technology status announcements and their visually-hidden / ARIA contract.
- `controller/sortable-runtime-loader.ts`: loads or reuses the SortableJS runtime in the owning editor window.
- `controller/drag-ui.ts`: owns short-lived drag UI and restoration, including the insertion line and fallback row widths.
- `controller/row-order.ts`: owns deterministic row reordering, movement validation, insertion index calculation, valid destination calculation, and restoration of the original DOM row order.
- `rowspan.ts`: owns vertical-merge range analysis and movement / insertion restrictions.
- `messages.ts`: owns translated Table Reorder messages and accessible labels.
- `editor.scss`: owns editor-side presentation for row controls and destination-selection UI.

The dependency direction stays from the Gutenberg / React boundary toward lower-level modules. Current consumers continue to import the reorder UI contract through `controller/reorder-ui`; among the UI modules, `row-move-targets.ts` depends only on `row-controls.ts` and `reorder-guidance.ts`, and the lower-level UI modules do not depend back on the facade.

## Build integration

The entry is:

```text
src/index.tsx
```

`webpack.config.js` emits the entry assets and the npm-provided `sortablejs/Sortable.min.js` runtime directly under `build/`. `yamabiko-table-reorder.php` enqueues the editor entry and exposes the local runtime URL to the editor script.

Run:

```bash
logcut npm run test
logcut npm run build
```

## iframe and non-iframe editors

Editor browsing-context differences are isolated behind `editor-environment.ts`.

The Editor Environment resolves the current editor context with this rule:

1. Start from the React anchor's owning `document`.
2. If `[data-block="<clientId>"]` exists there, use that document and its `defaultView`.
3. Otherwise, fall back to `iframe[name="editor-canvas"]` and use that iframe's current `contentDocument` / `contentWindow` when it contains the target block.

The resolver is stateless and does not retain `document` / `window` references across calls, so iframe teardown / recreation is resolved against the current editor context.

`table-context.ts` receives that resolved environment and performs only Table-specific DOM resolution. Controller, drag UI, focus, scroll, and other consumers continue to use standard Web APIs and DOM-local context directly when appropriate; they do not need to know whether the editor is iframe or non-iframe.

This keeps one drag-and-drop implementation for both editor modes while containing iframe-specific discovery in one thin boundary.

## DOM ownership handoff

SortableJS physically moves `<tr>` nodes while dragging, but Gutenberg/React remains the canonical owner of those nodes.

```text
Gutenberg renders canonical DOM
        ↓
SortableJS temporarily moves <tr> nodes during drag
        ↓
onEnd receives the destination index
        ↓
Original <tr> DOM order is restored
        ↓
setAttributes({ body: reorderedBody })
        ↓
Gutenberg renders the new canonical DOM order
```
