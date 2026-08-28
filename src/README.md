# YTR v1 source

`src/` is intentionally minimal after resetting the formal v1 source in #532.

The formal v1 implementation will be added from Phase 1 according to the responsibilities and boundaries defined in `docs/architecture/reorder-v1-architecture.md` and the implementation order defined in `docs/plans/reorder-v1-plan.md`.

Current source boundary:

```text
src/
├── reorder/
│   ├── column-reorder/
│   │   ├── reorder-target-resolution.test.ts
│   │   └── reorder-target-resolution.ts
│   ├── row-reorder/
│   │   ├── reorder-target-resolution.test.ts
│   │   └── reorder-target-resolution.ts
│   ├── drop-target-resolution.test.ts
│   ├── drop-target-resolution.ts
│   ├── editor-dom-context.test.ts
│   ├── editor-dom-context.ts
│   ├── reorder-mode.test.ts
│   ├── reorder-mode.ts
│   ├── reorder-target-resolution-rules.ts
│   ├── reorder-target-resolution.test.ts
│   ├── reorder-target-resolution.ts
│   ├── table-integration.test.ts
│   └── table-integration.ts
├── AGENTS.md
├── README.md
├── index.tsx
├── messages.test.ts
└── messages.ts
```

Row- and column-specific behavior is placed under `row-reorder/` and `column-reorder/`. Rules or responsibilities that have the same meaning and the same reason to change for both directions remain in the shared Reorder responsibility instead of being duplicated.

Architecture-preceding formal v1 implementation is not kept in the active source tree. Refer to Git history when those implementation details are needed.

Prototype implementation code is also not kept in the active source tree. Refer to the `prototype-final` tag when Prototype implementation details are needed.

Add source responsibilities as implementation proceeds from Phase 1. Source structure should follow the Architecture and `src/AGENTS.md` rather than reproduce the previous formal v1 or Prototype structure.
