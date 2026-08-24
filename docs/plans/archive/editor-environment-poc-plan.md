# PLAN-430: Editor Environment PoC

## References

- Parent issue: #430
- Requirements: issue body and discussion on the Editor Environment boundary
- Design: keep browsing-context discovery thin and leave normal Web APIs directly accessible to consumers

## Goal

Verify that Table Reorder can isolate iframe / non-iframe editor browsing-context discovery behind a small Editor Environment boundary without turning that boundary into a general browser API wrapper.

## Scope

### Included

- Add a stateless Editor Environment resolver for editor `document` / `window` discovery.
- Move iframe detection and `contentDocument` / `contentWindow` access out of `table-context.ts`.
- Add focused iframe / non-iframe and iframe recreation tests for the environment boundary.
- Document the new source responsibility.

### Not included

- Wrapping DOM-local APIs such as `ownerDocument`, `defaultView`, `focus()`, geometry, selection, or observers.
- Changing user-facing reorder behavior.
- Removing non-iframe E2E coverage.
- Extracting a standalone package.

## Approach

Keep the Editor Environment contract minimal. It resolves only the current editor `document` and `window` from the anchor and block identity. Table-specific discovery remains in `table-context.ts`, while ordinary DOM-local and browser capability access remains direct.

The resolver does not cache its result. A new call after editor iframe teardown / recreation therefore resolves the current browsing context rather than retaining an old reference.

## Architecture

- `src/editor-environment.ts`: owns iframe / non-iframe detection, discovery, and stateless context resolution.
- `src/table-context.ts`: consumes Editor Environment and resolves the Table block, table, and tbody.
- Existing controller and UI modules continue to use normal DOM-local Web APIs directly where appropriate.

## Implementation phases

### Phase 1: Introduce the boundary

- Outcome: editor browsing-context discovery has one owner.
- Tasks: add `editor-environment.ts`; refactor `table-context.ts` to consume it.
- Validation: focused Jest tests and existing table-context tests.

### Phase 2: Verify lifecycle behavior

- Outcome: the resolver does not retain stale iframe context.
- Tasks: add iframe recreation coverage.
- Validation: focused Jest test that replaces the editor iframe and resolves again.

### Phase 3: Integration validation

- Outcome: existing behavior remains unchanged in both editor modes.
- Tasks: no additional product behavior changes.
- Validation: repository Node/build checks plus existing iframe / non-iframe E2E, performed by the user for this task.

## Decisions and validation questions

### Decide before implementation

- Keep the contract to `document` / `window` only because those are the current browsing-context capabilities required by production code.
- Do not add `root` or `scrollContainer` until a real consumer requires them; current scroll targeting remains a DOM-local operation derived from the table context.

### Validate during implementation

- Can all production `contentDocument` / `contentWindow` discovery be confined to the environment boundary?
- Does resolving after iframe recreation return the new context?
- Do existing consumers remain free to use DOM-local Web APIs directly?

## Issue breakdown

- [x] Add Editor Environment resolver.
- [x] Refactor Table Context to consume it.
- [x] Add focused environment tests.
- [x] Document the source responsibility.

## Validation

- `npm test`
- `npm run build`
- `git diff --check origin/main...HEAD`
- Existing iframe / non-iframe E2E coverage

For this task, command execution and E2E verification are delegated to the user.

## Completion criteria

- Production `contentDocument` / `contentWindow` discovery is confined to `editor-environment.ts`.
- Table Context no longer performs iframe detection.
- Focused tests cover root-document, iframe, and iframe recreation resolution.
- The boundary remains stateless and does not wrap ordinary browser APIs.

## Notes

The Issue intentionally leaves the exact contract discoverable through the PoC. This implementation keeps the contract smaller than the illustrative `document` / `window` / `root` / `scrollContainer` shape because only `document` and `window` are required for editor browsing-context discovery today.
