# Reorder source guidelines

These instructions apply to source files under `src/reorder/` in addition to `src/AGENTS.md`.

## Row and column implementation independence

- Row reordering and column reordering are independent implementations. Do not introduce shared reorder abstractions between them.

## Error handling and runtime invariants

- Prefer implementation simplicity and maintainability over complete recovery after an unexpected Error.
- Treat normal inability to perform an operation, cancellation, and changes in external state as normal outcomes rather than Errors.
- Throw an `Error` when a Reorder-internal contract or runtime invariant is violated.
- Do not suppress internal Errors by default or convert them into normal outcomes.
- Do not complicate normal processing state, return values, public APIs, or lifecycle solely for Error handling.
- Do not show a user-facing notification because an internal Error occurred.
- Do not guarantee complete recovery of all Reorder state after an unexpected Error.
