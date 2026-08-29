# YTR v1 source

`src/` contains the active formal v1 source and follows the responsibilities and boundaries defined by the accepted Architecture.

Current Reorder source boundary:

```text
src/reorder/
├── foundation/
├── core/
├── row-reorder/
└── column-reorder/
```

- `foundation/` contains the infrastructure and external boundaries required to establish Reorder, such as Editor DOM Context, Reorder Mode, and Table Integration.
- `core/` contains Reorder contracts, lifecycle, and rules whose meaning and reason to change are shared by row and column reordering.
- `row-reorder/` contains responsibilities and types specific to row reordering.
- `column-reorder/` contains responsibilities and types specific to column reordering.

`foundation/` is not a generic shared-code directory. Shared row/column Reorder behavior belongs in `core/`, while direction-specific behavior stays in its corresponding Reorder directory.

Source structure should follow the Architecture and `src/AGENTS.md` rather than reproduce previous formal v1 or Prototype structures. Refer to Git history or the `prototype-final` tag only when historical implementation details are needed.
