# YTR v1 source

`src/` contains the active formal v1 source.

Current Reorder source boundary:

```text
src/reorder/
├── editor-dom-context.ts
├── reorder-guidance.ts
├── reorder-mode.ts
├── reorder-mode-react.ts
├── row-reorder/
│   ├── responsibilities/
│   ├── domain/
│   ├── infrastructure/
│   └── integration/
└── wordpress/
```

- Editor DOM Context remains directly under `src/reorder/` as the editor context boundary used by Reorder.
- `row-reorder/` is the boundary for row-specific implementation.
- `responsibilities/` contains implementation owned by Row Reorder Architecture responsibilities.
- `domain/` contains Row Reorder-specific domain types and rules that support responsibilities without owning a lifecycle or integration boundary.
- `infrastructure/` contains technical mechanisms such as DOM measurement that support Row Reorder without owning domain decisions.
- `integration/` contains adapters and connection code between Row Reorder and React, DnD Engine, DOM, or other technical boundaries.
- Row reordering and column reordering are independent implementations. Do not introduce shared reorder abstractions between them.

The current source tree is not a substitute for Architecture. Responsibility boundaries must follow the accepted Architecture. Domain, infrastructure, and integration files support those responsibilities without becoming Architecture responsibilities merely because they have their own source boundary. Do not recreate the removed `foundation/`, `core/`, or shared row/column Reorder structure merely from historical source organization.

Refer to Git history or the `prototype-final` tag only when historical implementation details are needed.
