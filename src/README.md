# YTR v1 source

`src/` follows the responsibility boundaries defined by the formal v1 architecture.

Prototype implementation code is not kept in the active source tree. Refer to the `prototype-final` tag when historical implementation details are needed.

Current source boundary:

```text
src/
├── AGENTS.md
├── README.md
├── index.tsx
├── messages.ts
├── reorder/
│   ├── reorder-mode.ts
│   ├── dnd-interaction.ts
│   ├── drop-target-resolution.ts
│   ├── data-update.ts
│   └── table-structure.ts
├── row-reorder/
│   ├── drop-target-resolution.ts
│   └── data-update.ts
└── column-reorder/
    ├── drop-target-resolution.ts
    └── data-update.ts
```

- `reorder/` contains shared Reorder contracts and responsibilities.
- `row-reorder/` contains row-specific behavior.
- `column-reorder/` contains column-specific behavior.
- Plugin-wide responsibilities such as `index.tsx` and `messages.ts` remain directly under `src/`.

Keep tests beside the responsibility they verify. Add directories only when a concrete v1 responsibility requires a distinct boundary.
