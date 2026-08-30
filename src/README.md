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
```

- Editor DOM Context remains directly under `src/reorder/` as the editor context boundary used by Reorder.
- `row-reorder/` is the boundary for row-specific implementation. Its concrete internal structure is not defined by this README.
- Row reordering and column reordering are independent implementations. Do not introduce shared reorder abstractions between them.

The current source tree is not a substitute for Architecture. Responsibility boundaries and the concrete `row-reorder/` structure must follow the accepted Architecture once defined. Do not recreate the removed `foundation/`, `core/`, or shared row/column Reorder structure merely from historical source organization.

Refer to Git history or the `prototype-final` tag only when historical implementation details are needed.
