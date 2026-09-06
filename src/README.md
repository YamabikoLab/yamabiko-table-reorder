# YTR v1 source

`src/` contains the active formal v1 source.

Current Reorder source boundary:

```text
src/reorder/
├── editor-dom-context.ts
├── editor-dom-context.test.ts
├── reorder-mode.ts
├── reorder-mode.test.ts
└── row-reorder/
    ├── responsibilities/
    ├── domain/
    ├── infrastructure/
    └── integration/
```

- Editor DOM Context remains directly under `src/reorder/` as the editor context boundary used by Reorder.
- `row-reorder/` is the boundary for row-specific implementation.
- `responsibilities/` contains implementation owned by the Row Reorder responsibilities defined by the accepted Architecture, including Presentation.
- `domain/` contains Row Reorder-specific semantic rules and types that support responsibilities without owning an Architecture responsibility themselves.
- `infrastructure/` contains technical support required by Row Reorder, such as DOM measurement and geometry, without owning domain behavior.
- `integration/` contains adaptation and connection code between Row Reorder and external or technical boundaries such as the DnD engine, React, and DOM-derived physical input.
- Row reordering and column reordering are independent implementations. Do not introduce shared reorder abstractions between them.

The source classification describes implementation organization and does not create additional Architecture responsibilities. Responsibility boundaries must continue to follow the accepted Architecture.

The current source tree is not a substitute for Architecture. Do not recreate the removed `foundation/`, `core/`, or shared row/column Reorder structure merely from historical source organization.

Refer to Git history or the `prototype-final` tag only when historical implementation details are needed.
