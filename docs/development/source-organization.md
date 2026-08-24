# Source organization

Yamabiko Table Reorder is an independent plugin repository. `src/` is the owning source boundary, with explicit feature and runtime boundaries inside it.

Keep the structure concrete and small. Add a directory only when current implementation requires it.

## Plugin root

The repository root is the WordPress plugin root.

```text
.
├── src/
│   ├── index.tsx
│   ├── common/
│   ├── row-reorder/
│   ├── column-reorder/
│   └── types/
├── build/              # generated, not committed
├── package.json
├── composer.json
└── yamabiko-table-reorder.php
```

Do not reintroduce the former `editor-extensions/table-reorder/` wrapper inside this dedicated plugin repository.

## Source boundaries

### `src/index.tsx`

`src/index.tsx` is the thin plugin-wide entry point. It may import implemented feature boundaries and styles, then register or compose them with public WordPress APIs.

It must not become the main location for substantial UI, state management, transformations, validation, network operations, or unrelated behavior.

### `src/row-reorder/`

`row-reorder/` owns code that knows about rows, `tbody`, `rowspan`, row movement, row controls, or the row-reorder interaction model.

That includes the supported-block boundary, Table DOM context, messages, editor styles, React integration, row constraints, and the imperative controller/UI implementation.

`table-context.ts` resolves the editor `document` and `window` directly from the current editor canvas reference element's `ownerDocument` and `defaultView`. It identifies the target Gutenberg block by `clientId` only within that same document. It does not perform iframe discovery.

The row-specific controller lives under:

```text
src/row-reorder/controller/
```

There is no repository-level `src/controller/` source boundary.

### `src/column-reorder/`

`column-reorder/` owns code that knows about columns, column movement, column controls, or the column-reorder interaction model.

The current implementation keeps the same responsibility shape as Row Reorder without depending on row internals:

```text
src/column-reorder/
├── block-support.ts
├── column-order.ts
├── column-order.test.ts
├── table-context.ts
├── messages.ts
├── editor.scss
├── with-column-reorder.tsx
├── with-column-reorder.test.tsx
└── controller/
    ├── column-reorder-controller.ts
    └── reorder-ui/
        ├── column-controls.ts
        ├── column-insertion-line.ts
        ├── column-move-targets.ts
        ├── live-status.ts
        ├── reorder-guidance.ts
        ├── scroll-destination.ts
        └── index.ts
```

`column-order.ts` owns DOM-independent column movement rules, including physical column movement, insertion-boundary mapping, no-op detection, and valid destination calculation.

`column-reorder-controller.ts` owns the keyboard / single-pointer interaction session, commit / cancel flow, focus restoration, and coordination of the column-owned UI modules.

`controller/reorder-ui/` owns column handles, vertical insertion-line UI, single-pointer destination targets, live status, guidance, and horizontal destination scrolling. These responsibilities remain column-owned even where they intentionally mirror Row Reorder behavior.

Column-specific DOM context, block support, controllers, UI, messages, and styles stay under this feature boundary. Do not make `column-reorder/` depend on `row-reorder/` internals.

### `src/common/`

`common/` owns only infrastructure whose responsibility is independent of row or column reordering and can remain the same for multiple implemented features.

The current common responsibility is:

```text
src/common/
├── sortable-runtime-loader.ts
└── sortable-runtime-loader.test.ts
```

`sortable-runtime-loader.ts` owns loading or reusing the SortableJS runtime in the owning editor window.

`common/` must not depend on `row-reorder/` or `column-reorder/`.

Do not move Table DOM context, block support, guidance, live status, scrolling, interaction models, drag UI, or controller lifecycle into `common/` merely because they might be reusable later. Extract only after multiple real consumers demonstrate the same stable responsibility.

### `src/types/`

`types/` owns source-level declarations that are not implementation of a feature.

## Current structure

The implementation follows this responsibility shape:

```text
src/
├── index.tsx
├── AGENTS.md
├── README.md
├── common/
│   ├── sortable-runtime-loader.ts
│   └── sortable-runtime-loader.test.ts
├── row-reorder/
│   ├── block-support.ts
│   ├── block-support.test.ts
│   ├── table-context.ts
│   ├── table-context.test.ts
│   ├── rowspan.ts
│   ├── rowspan.test.ts
│   ├── messages.ts
│   ├── messages.test.ts
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
├── column-reorder/
│   ├── block-support.ts
│   ├── column-order.ts
│   ├── column-order.test.ts
│   ├── table-context.ts
│   ├── messages.ts
│   ├── editor.scss
│   ├── with-column-reorder.tsx
│   ├── with-column-reorder.test.tsx
│   └── controller/
│       ├── column-reorder-controller.ts
│       └── reorder-ui/
└── types/
    └── styles.d.ts
```

Tests stay beside the modules they verify.

Row and column behavior should remain separate until real implementation demonstrates a stable responsibility worth moving into `common/`.

## Dependency direction

The intended dependency direction is:

```text
             src/index.tsx
             /           \
            ↓             ↓
    row-reorder/    column-reorder/
            \             /
             ↓           ↓
                common/
```

`row-reorder/` and `column-reorder/` must not depend on each other's internal implementation. `common/` must not import from either feature boundary.

Within each feature, keep focused controller and `reorder-ui` responsibilities. Row and Column may intentionally share the same user-facing interaction model, but do not introduce a generic row/column controller or `axis: 'row' | 'column'` abstraction before a stable shared responsibility is demonstrated by both implementations.

## Editor DOM context

Resolve DOM context from an element that is owned by the current editor canvas. Use its `ownerDocument` and that document's `defaultView` rather than detecting iframe / non-iframe modes or traversing editor iframes.

Do not cache editor `document` / `window` references across editor lifecycle changes. Existing React ref effects track replacement of the editor canvas reference element so consumers resolve from the current DOM context.

## Shared code

Do not create generic `shared/`, `utils/`, or `helpers/` directories for possible future reuse.

Keep code with its owning responsibility until at least two real consumers need the same stable behavior. When extracting shared code, give it a specific responsibility, keep its public surface small, avoid dependencies on one consumer's internal details, and update imports and tests in the same change.

Small duplication is preferable to an unclear abstraction.

## Tests and generated files

Keep focused TypeScript tests beside the modules they verify. Use a top-level test directory only for repository-wide, integration, PHP, or end-to-end behavior that does not belong naturally beside one source module.

`build/` is generated by `npm run build` or `npm start`. Production assets are emitted directly under `build/`, including the Table Reorder entry assets and `sortable.min.js`. Do not edit or commit `build/`. `node_modules/` and `vendor/` are installed dependencies and are also not committed. Lockfiles remain committed so installations are reproducible.

## Evolving the structure

Change this structure only when real implementation pressure justifies it. When a new source boundary becomes part of the actual codebase, document its owner and allowed dependency direction in the same change.
