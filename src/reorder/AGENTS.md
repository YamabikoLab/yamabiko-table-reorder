# Reorder source guidelines

These instructions apply to source files under `src/reorder/` in addition to `src/AGENTS.md`.

## Row and column responsibility boundaries

- Keep row-specific meaning, types, rules, and interpretation in `row-reorder` as the source of truth.
- Keep column-specific meaning, types, rules, and interpretation in `column-reorder` as the source of truth.
- Branch between row and column to select and delegate the direction only at boundaries where the direction has not yet been determined.
- Limit shared processing and shared abstractions to responsibilities that have the same meaning and the same reason to change for row and column.
- Once the direction has been determined, in processing paths where the correlation between that direction and its corresponding types must be maintained, do not return to a union merely for type convenience or re-check `kind` to restore the correlation.
- In processing paths where direction correspondence must be maintained, preserve in the type system, through the actual call path, the correlation between the determined direction and its corresponding Request / Target / Session / Result / Destination.
- Do not require unnecessary splitting into direction-specific APIs all the way to boundaries that expose or observe results for either row or column in a direction-independent way.
- Do not move direction correspondence that can be guaranteed by types back into runtime assertions. Check at runtime only value-level invariants owned by Reorder that cannot be guaranteed by types, such as Table identity.

## Row and column code review guidelines

At minimum, verify the following when reviewing code under `src/reorder/`.

- Verify that row-specific meaning, type definitions, rules, and interpretation remain owned by `row-reorder` and are not redefined or independently interpreted elsewhere.
- Verify that column-specific meaning, type definitions, rules, and interpretation remain owned by `column-reorder` and are not redefined or independently interpreted elsewhere.
- Verify that row / column branching does not appear outside boundaries that select and delegate the direction.
- Verify that reorderable row and column elements use stable `key` values based on their identity rather than their current position.
- Verify that processing paths after the direction has been determined do not return to a union for type convenience or re-check `kind` to restore type correlation.
- Verify that the correlation between the direction and Request / Target / Session / Result / Destination is maintained in the type system where required by the processing path.
- Verify that shared processing and abstractions truly represent responsibilities with the same meaning and the same reason to change for row and column.
- Verify that boundaries exposing or observing results for either row or column in a direction-independent way are not unnecessarily split into direction-specific APIs.
- Verify that direction correspondence already guaranteed by types is not revalidated with runtime assertions.

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

### log

- Log an error exactly once at the operation boundary that owns recovery.
- A log entry must include at least which Reorder operation failed and the original error information.
- Do not duplicate logs for the same error, such as logging once where it is thrown and again where it is caught.
- Do not log normal absence, normal unavailability, or an expected abort caused by an external environment change as an internal error.
