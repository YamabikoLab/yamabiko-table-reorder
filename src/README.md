# Table Reorder

Table Reorder extends supported Table blocks with row reordering powered by SortableJS.

## Source boundaries

The plugin source is organized by responsibility rather than by technical layer alone.

```text
src/
├── index.tsx
├── common/
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
- `common/` contains responsibility-neutral runtime infrastructure shared by implemented features.
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
- `row-reorder/table-context.ts` resolves the current Table DOM context from the editor canvas reference element's `ownerDocument` / `defaultView`, then finds the target block and `tbody` in that same document.
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

## Editor DOM context

Table Reorder owns an editor-only DOM reference element inside the current editor canvas. Consumers resolve browsing-context APIs locally from that reference instead of detecting iframe / non-iframe editor modes.

`row-reorder/table-context.ts` uses:

```ts
const document = referenceElement.ownerDocument;
const window = document.defaultView;
```

The target Gutenberg block is then identified by `clientId` only inside that same `document`. The implementation does not inspect `iframe[name="editor-canvas"]`, does not traverse `contentDocument`, and does not cache editor `document` / `window` references across lifecycle changes.

The reference element lifecycle is owned by the existing React ref effects. When WordPress replaces the editor canvas context, the ref is attached to the current DOM and context resolution starts from that current element.

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
