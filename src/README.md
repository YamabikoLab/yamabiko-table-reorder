# YTR v1 source

`src/` is intentionally minimal after resetting the formal v1 source in #532.

The formal v1 implementation will be added from Phase 1 according to the responsibilities and boundaries defined in `docs/architecture/reorder-v1-architecture.md` and the implementation order defined in `docs/plans/reorder-v1-plan.md`.

Current source boundary:

```text
src/
├── reorder/
│   ├── editor-dom-context.test.ts
│   └── editor-dom-context.ts
├── AGENTS.md
├── README.md
├── index.tsx
├── messages.test.ts
└── messages.ts
```

Architecture-preceding formal v1 implementation is not kept in the active source tree. Refer to Git history when those implementation details are needed.

Prototype implementation code is also not kept in the active source tree. Refer to the `prototype-final` tag when Prototype implementation details are needed.

Add source responsibilities as implementation proceeds from Phase 1. Source structure should follow the Architecture and `src/AGENTS.md` rather than reproduce the previous formal v1 or Prototype structure.
