# YTR v1 source

`src/` contains the active formal v1 source and follows the responsibilities and boundaries defined by the accepted Architecture.

Current Reorder source boundary:

```text
src/reorder/
├── editor-dom-context.ts
└── row-reorder/
```

- `editor-dom-context.ts` provides the current editor DOM context required by Reorder implementations.
- `row-reorder/` contains the active row reordering implementation and owns the responsibilities, types, rules, and integrations required for row reordering.

Row reordering and column reordering are independent implementations. Do not introduce shared reorder abstractions between them. When column reordering implementation begins, it will be added independently under `column-reorder/` rather than by extracting shared Reorder code from `row-reorder/`.

Source structure should follow the Architecture, `src/AGENTS.md`, and `src/reorder/AGENTS.md` rather than reproduce previous formal v1 or Prototype structures. Refer to Git history or the `prototype-final` tag only when historical implementation details are needed.
