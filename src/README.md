# Table Reorder

Table Reorder extends supported Table blocks with row reordering powered by SortableJS.

## Source boundaries

The plugin source is organized by responsibility rather than by technical layer alone.

```text
src/
├── index.tsx
├── common/
│   ├── editor-environment.ts
│   ├── editor-environment.test.ts
│   ├── sortable-runtime-loader.ts
│   └── sortable-runtime-loader.test.ts
├── row-reorder/
│   ├── block-support.ts
│   ├── table-context.ts
│   ├── rowspan.ts
│   ├── messages.ts
│   ├── editor.scss
│   ├── use-table-reorder.ts
│   ├── use-table-reorder-controller.ts
│   ├── use-table-reorder-interaction.ts
│   ├── with-table-reorder.tsx
│   └── controller/
│       ├── sortable-controller.ts
│       ├── row-order.ts
│       ├── drag-ui.ts
│       ├── scroll-target.ts
│       └── reorder-ui/
└── types/
```

- `index.tsx` is the thin plugin-wide entry point.
- `common/` contains environment infrastructure whose responsibility does not depend on row reordering.
- `row-reorder/` contains implementation that knows about rows, `tbody`, `rowspan`, row controls, or the row-reorder interaction model.
- `types/` contains source-level declarations.

The intended dependency direction is:

```text
src/index.tsx
    ↓
row-reorder/
    ↓
common/
```

`common/` must not depend on `row-reorder/`.

## Implementation overview

- `row-reorder/with-table-reorder.tsx` is the thin Gutenberg composition and rendering adapter.
- `row-reorder/use-table-reorder.ts` connects Gutenberg notices / `setAttributes()` to the dedicated interaction and controller hooks.
- `row-reorder/use-table-reorder-interaction.ts` owns hover capability, input modality, touch reorder mode, and coachmark preferences.
- `row-reorder/use-table-reorder-controller.ts` owns SortableJS controller creation, cleanup, recreation, and focus restoration.
- `common/editor-environment.ts` isolates iframe / non-iframe editor browsing-context discovery and resolves the current editor `document` / `window` without caching them across editor lifecycle changes.
- `row-reorder/table-context.ts` consumes the Editor Environment boundary and resolves the target Table block, table, and `tbody` from the current editor document.
- `row-reorder/controller/sortable-controller.ts` owns imperative keyboard / pointer / drag session orchestration.
- `common/sortable-runtime-loader.ts` loads or reuses the SortableJS runtime in the owning editor window.
- `row-reorder/controller/row-order.ts` owns deterministic row movement rules and DOM-order restoration.
- `row-reorder/rowspan.ts` owns vertical-merge range analysis and movement / insertion restrictions.
- `row-reorder/messages.ts` owns translated row-reorder messages and accessible labels.
- `row-reorder/editor.scss` owns editor-side presentation for row controls and destination-selection UI.

SortableJS temporarily reorders Gutenberg-owned `<tbody><tr>` elements during dragging. At drag end, the temporary DOM order is restored before `setAttributes()` commits the reordered block data, returning canonical DOM ownership to Gutenberg.

## Row reorder behavior

On hover-capable devices, hovering a movable row reveals an inline handle at the left edge of the first cell. Dragging starts only from that handle, not from the row itself.

On touch devices, reorder mode shows the same row controls. Tapping a handle starts destination selection, while dragging the handle starts SortableJS DnD. Touch cell taps remain available for normal editing.

Rows involved in vertical merges (`rowspan`) cannot be moved, and insertion positions that would split a merged range are rejected.

Keyboard, pointer, and touch behavior remain owned by the row-reorder feature boundary. These responsibilities are not generalized for future column support until a real column implementation demonstrates stable shared behavior.

## Editor Environment

Editor browsing-context differences are isolated behind `common/editor-environment.ts`.

The Editor Environment resolves the current editor context with this rule:

1. Start from the editor canvas reference element's owning `document`.
2. If `[data-block="<clientId>"]` exists there, use that document and its `defaultView`.
3. Otherwise, inspect every `iframe[name="editor-canvas"]` in document order and select the first current `contentDocument` that contains the target block.
4. Return that document together with its own `defaultView`, so `document` and `window` always belong to the same browsing context.
5. If no matching current context can be resolved, return `null`.

The resolver is stateless and does not retain `document` / `window` references across calls, so iframe teardown / recreation is resolved against the current editor context. A returned context is only guaranteed to be current at resolve time; consumers should resolve again when the editor context may have changed.

`row-reorder/table-context.ts` receives that resolved environment and performs only row-reorder Table DOM resolution. Controller, drag UI, focus, scroll, and other consumers continue to use standard Web APIs and DOM-local context directly when appropriate.

## DOM ownership handoff

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

## Build integration

The entry remains:

```text
src/index.tsx
```

`webpack.config.js` emits the entry assets and the npm-provided `sortablejs/Sortable.min.js` runtime directly under `build/`. `yamabiko-table-reorder.php` enqueues the editor entry and exposes the local runtime URL to the editor script.

Validation commands are documented in `../docs/development/testing.md`.
