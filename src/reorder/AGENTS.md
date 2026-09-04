# Reorder source guidelines

These instructions apply to source files under `src/reorder/` in addition to `src/AGENTS.md`.

## Row and column implementation independence

- Row reordering and column reordering are independent implementations. Do not introduce shared reorder abstractions between them.

## Error handling and runtime invariants

### throw / assertion

- Make invalid states unrepresentable where possible through TypeScript types and the state model. Use runtime assertions only for runtime invariants that cannot be guaranteed by types alone.
- Represent normal absence or responsibility-level unavailability with an explicit result such as `null`. Do not hide violations of contracts or runtime invariants owned by Reorder with `null`, silent returns, fallback values, or similar behavior.
- Use runtime assertions only for invariants owned by Reorder. Do not assert external conditions that may legitimately change, such as Editor lifecycle, DOM availability, Table Block availability, or external Table data.
- Do not bypass an invariant that requires runtime validation with a non-null assertion, type assertion, or fallback value.
- When an invariant violation is detected, throw an `Error`. Its message must identify the violated invariant clearly enough to understand the affected Reorder responsibility.
- Do not log at the point where an error is thrown or asserted.

### catch

- Let errors caused by contract or invariant violations inside a Reorder responsibility propagate to the Reorder operation boundary.
- Do not catch inside internal responsibilities merely to convert an error to `null`, continue processing, log locally, or perform responsibility-specific recovery.
- Catch errors at the DnD `start`, `progress`, `complete`, or `cancel` operation boundary.
- When an asynchronous callback or another execution boundary cannot propagate an error to the normal operation boundary, that callback may define an error boundary. It must not introduce independent logging or recovery and must join the same common abort path used by the operation boundary.
- After catching an error, join the common abort path, discard the Reorder Session and temporary DnD state, and return to a safe idle state.
- After recovery, do not rethrow the error into the Editor as a whole when doing so would only spread an already-contained Reorder failure.
- Do not show a user-facing notification merely because an unexpected internal Error was caught. Internal error handling and user-visible messaging are separate concerns; user-facing notifications must be defined explicitly by requirements or design for a user-actionable condition.

### log

- Log an unexpected internal error exactly once at the operation boundary that owns recovery.
- A log entry must include at least which Reorder operation failed and the original error information.
- Do not duplicate logs for the same error, such as logging once where it is thrown and again where it is caught.
- Do not log normal absence, normal unavailability, user cancellation, no-op results, or an expected abort caused by an external environment change as an internal error.
- Do not let a secondary Error raised during recovery stop the remaining recovery steps or replace the original failure being diagnosed.
