# Yamabiko Table Reorder v1 source code guidelines

These instructions apply to source files under `src/`.

## Current phase

- `src/` is the active source boundary for the formal YTR v1 implementation.
- When historical code is needed for reference, use the `prototype-final` tag.

## Source organization

- Keep the source structure easy to navigate by making file and directory boundaries reflect concrete responsibilities. Keep `src/index.tsx` as a thin plugin-wide entry point.
- Keep code easy to locate by avoiding generic `shared/`, `utils/`, or `helpers/` directories unless they represent a concrete responsibility.

## Code structure and reuse

- Keep abstractions meaningful and stable by introducing them only for concrete responsibilities or shared reasons for change. Do not abstract or commonize code merely because implementations currently look similar.
- Keep implementation details from crossing responsibility boundaries by placing integration-specific adaptation at the boundaries defined by the Architecture.
- Never return a conditional expression directly. Assign its result to a meaningfully named variable first, using a basic-design-level name that makes the meaning of the returned value understandable without reading the implementation.

## React readability

- Make React code easy to understand by letting readers grasp the UI structure and responsibility of each meaningful UI part without tracing implementation details. Structure components so that the UI hierarchy and responsibilities are apparent from the component structure. Extract components when they represent a coherent UI responsibility, not merely to shorten a parent component.
- Make the current UI or interaction state understandable without requiring readers to mentally combine several independent state values. Prefer state representations that make valid conceptual states explicit instead of splitting one meaningful state across unrelated React state values.
- Keep control flow and lifecycle behavior easy to trace. Use effects and custom hooks when they make synchronization, lifecycle, or a coherent responsibility clearer. Do not use them merely to shorten components, hide control flow, or create indirect chains of internal state transitions.

## Zustand state management

- Use Zustand when a responsibility owns shared observable state that must remain independent of a single React component lifecycle, including state that must survive mount, unmount, and remount cycles. Do not introduce Zustand merely because multiple consumers exist.
- Do not move component-local transient UI state into Zustand without a concrete shared ownership need.
- Treat the Zustand store as the source of truth. Do not duplicate the same conceptual state in React state or another store.
- Perform state transitions through store-owned actions. Do not let consumers arbitrarily replace store state.
- Do not expose the Zustand store, `getState()`, `setState()`, or other store internals merely because Zustand is used. Public boundaries must be determined by architectural responsibility and actual production usage.
- Expose and consume only the state required by each consumer. Avoid rerenders or downstream updates caused by unrelated store changes.

## React code review guidelines

When reviewing React code, focus on React-specific correctness, lifecycle behavior, maintainability, and meaningful performance issues rather than style preferences.

- Verify Hooks follow React's rules and that dependency lists are complete and semantically correct. Watch for stale closures, unstable dependencies, and dependencies intentionally omitted without a sound reason.
- Verify each Effect is necessary for synchronization with something outside React or for lifecycle behavior. Avoid Effects that merely derive React state from other React state, and ensure subscriptions or other side effects are cleaned up when required.
- Verify state has a clear owner and represents source-of-truth data rather than values that can be derived during render. Avoid duplicated state that can become inconsistent.
- Verify rendering remains pure. Do not mutate props, state, store data, or other shared values during render.
- Verify refs are used for mutable values or DOM references that should not drive rendering. Do not retain DOM references across editor context changes, unmounts, or remounts when they can become stale.
- Verify mount, unmount, and remount behavior does not depend on one-time assumptions that can become invalid when React recreates a component or the editor context changes.
- Verify event listeners, observers, timers, subscriptions, and similar resources are released correctly and are not duplicated across rerenders or remounts.
- Verify list item identity is stable and `key` values represent the item's identity rather than its current position.
- Check for unnecessary rerenders only when they can have a meaningful cost. Prefer fixing unstable ownership, dependencies, or object/function creation at the relevant boundary before adding memoization solely as a precaution.
- Verify components and custom Hooks have coherent responsibility boundaries. Extract them when they own a meaningful UI, lifecycle, or synchronization responsibility, not merely to reduce line count.

## Implementation rules

- Prefer public WordPress APIs, hooks, components, and data stores.
- Keep DOM access correct in both iframe and non-iframe editors, including when the active editor context changes. Do not assume the global `document` or `window` is always the correct and persistent context; resolve them from the current editor context.
- Use terminology defined in `../docs/glossary.md` for source code identifiers, JSDoc, and comments. When introducing a new concept that cannot be expressed with existing glossary terminology, update the glossary as part of the same change.
- Do not use parent-relative imports at any depth, such as `../`, `../../`, or deeper paths. Use the `@/` alias instead. Relative imports within the same directory may use `./`.
- In Japanese comments and explanatory text in product source and tests, do not insert spaces between Japanese text and adjacent English terms or identifiers unless the space is semantically necessary.

## Source documentation

- Write comments and documentation at a basic-design level of abstraction so that readers who understand the specification but cannot read the implementation can understand the specification, responsibility, purpose, behavior, and rationale. Documentation should remain understandable when read without the implementation beside it.
- In Japanese documentation and comments, do not use general English words when their meaning can be expressed naturally in Japanese. Use Japanese for explanatory concepts and terminology. Keep English only when necessary for source-code identifiers, proper nouns, standardized technical terms, or other expressions whose English spelling is required for accuracy.
- Describe behavior, rules, constraints, and decisions in terms of specification or domain concepts. Explain what is allowed, prohibited, required, or produced and why, rather than how the implementation performs the processing. Do not merely translate identifiers, expressions, data structures, algorithms, or implementation steps into natural language.
- Start each source file with a Japanese file-level documentation comment that explains the file's responsibility, purpose, and ownership. Describe the role the file provides rather than listing its implementation details.
- Add Japanese JSDoc or documentation comments to exported top-level variables, constants, functions, types, React components, HOCs, custom hooks, controllers, and other major public boundaries. Also document non-exported top-level elements when they own an important responsibility or lifecycle that is not obvious from the code alone.
- For documented functions, methods, callbacks, and similar callables, add an `@param` entry for every parameter. Explain the specification-level meaning or role of a parameter when it is not obvious from its name and type.
- For condition expressions, document the rule or decision represented by the condition at a basic-design level rather than explaining individual checks or translating the expression into prose.
- Prioritize information that is difficult to infer from the implementation itself, such as important assumptions, constraints, return-value meaning, lifecycle, and cleanup responsibilities. Keep documentation aligned when the documented responsibility or contract changes, and do not mechanically add comments to self-explanatory local variables, temporary values, or implementation steps.
- For loops and other iteration constructs, add a clear basic-design-level explanation when the purpose of the iteration is not self-explanatory. Write the comment so that readers who understand the specification but cannot read the implementation can understand what domain elements are being processed, what behavior or rule the iteration establishes, and why the iteration is necessary. Do not merely describe the loop condition, index movement, collection traversal, or other implementation steps.

## Internationalization and accessibility

- Translate user-visible strings with the `yamabiko-table-reorder` text domain.
- Keep translatable messages centralized enough for the existing i18n pipeline to extract them reliably.
- Do not communicate meaning through color alone.

## Jest tests

- When creating or changing Jest tests under `src/`, follow `../docs/development/jest-test-guidelines.md`.
- Keep test files adjacent to the implementation they verify as `*.test.ts` or `*.test.tsx`; this issue does not change test placement.
- Do not add exports to production code solely for tests.

## Dependencies and generated files

- Add dependencies only for concrete v1 needs.
- Do not restore Prototype dependencies simply because they were previously used.
- Do not edit generated files in `build/`, `vendor/`, or `node_modules/`.

## Validation

Use the applicable commands documented in `../docs/development/testing.md`. The user performs manual validation for the source-reset PR.
