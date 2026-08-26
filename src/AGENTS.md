# Yamabiko Table Reorder v1 source instructions

These instructions apply to source files under `src/`.

## Current phase

- `src/` is the active source boundary for the formal YTR v1 implementation.
- The previous implementation is the YTR Prototype and must not be copied back into the active source tree.
- When historical code is needed for reference, use the `prototype-final` tag.
- Treat #481 as the design source of truth for v1 interaction, accessibility, performance, and core contracts.

## Source organization

- Keep `src/index.tsx` as a thin plugin-wide entry point.
- Do not recreate Prototype directories such as `row-reorder/`, `column-reorder/`, `common/`, or their controller hierarchy merely to preserve the old structure.
- Add directories only after a concrete v1 responsibility is established.
- Prefer responsibility-based boundaries over speculative abstractions.
- Do not create generic `shared/`, `utils/`, or `helpers/` directories for possible future reuse.

## Code structure and reuse

- Commonize code based on shared responsibility and reason for change, not merely because implementations look similar.
- Keep input-, DOM-, WordPress-, and editor-specific adaptation at their appropriate boundaries rather than leaking those concerns into shared reorder logic.
- Prefer side-effect-free logic for domain decisions and data transformations when practical.
- Keep mutable state owned by one responsibility. Do not maintain independent copies of the same authoritative state across responsibilities.

## Implementation rules

- Prefer public WordPress APIs, hooks, components, and data stores.
- Keep Gutenberg block attributes and block data as the source of truth for committed reorder results.
- Input-, block-, and reorder-direction-specific behavior may differ, but shared reorder rules must remain in explicit domain contracts.
- Preserve the v1 performance principles defined in #481: do not make UI, listeners, geometry work, or hot-path scans scale with total row count when avoidable; do not reorder the real Table DOM during drag; commit logical data only when the operation is finalized.
- Resolve editor browsing context from the active editor context rather than assuming global `window` / `document` lifetimes.
- In Japanese comments and explanatory text in product source and tests, do not insert spaces between Japanese text and adjacent English terms or identifiers unless the space is semantically necessary.

## Source documentation

- Add Japanese JSDoc or documentation comments to exported top-level variables, constants, functions, types, React components, HOCs, custom hooks, and controller or other major public boundaries.
- Also document non-exported top-level elements when they own an important responsibility or lifecycle that is not obvious from the code alone.
- Explain the responsibility and purpose rather than merely translating the identifier into Japanese.
- Prioritize information that is difficult to infer from the implementation itself, such as why the element exists, what it owns, important assumptions, return-value meaning, lifecycle, and cleanup responsibilities.
- Keep documentation comments aligned when the documented responsibility or contract changes.
- Do not mechanically add comments to self-explanatory local variables, temporary values, or implementation steps.
- Follow the Japanese spacing rule in the Implementation rules section for these comments.

## Internationalization and accessibility

- Translate user-visible strings with the `yamabiko-table-reorder` text domain.
- Keep translatable messages centralized enough for the existing i18n pipeline to extract them reliably.
- Support keyboard operation, visible focus, announcements, focus restoration, and Undo according to the contracts defined from #481.
- Do not communicate meaning through color alone.

## Jest tests

Jest tests should be structured so that their purpose and expected behavior can be understood without reading the implementation in detail.

### Test organization

- Group test cases with `describe` by meaningful behavior, scenario, or responsibility.
- Prefer behavior-oriented groups over implementation details such as helper functions or internal processing steps.

### Test case names

- Write each `it` or `test` description as a condition and expected result using `when <condition or action>, should <expected result>`.
- The `when` part should describe the condition or action being tested.
- The `should` part should describe the externally observable expected result.

### Test case documentation

- Add a Japanese comment immediately before each test case so that the purpose of the test can be understood without reading the implementation.
- Include the following information:
  - 概要: 何を確認するテストなのか
  - 事前条件: テスト実行前に成立している状態
  - 操作: テスト対象に対して何を行うのか
  - 期待結果: 操作の結果として何が成立すべきか
- Keep the explanation focused on the behavior being verified and avoid repeating implementation details that are already obvious from the test code.
- Follow the Japanese spacing rule in the Implementation rules section for these comments.

Example:

```ts
/**
 * editor iframe内の対象ブロックから環境を解決できることを確認する。
 *
 * 事前条件:
 * - 外側のdocumentには対象ブロックが存在しない。
 * - editor iframe内には対象ブロックが存在する。
 *
 * 操作:
 * - resolveEditorEnvironment()を実行する。
 *
 * 期待結果:
 * - 対象ブロックを含むiframeのdocumentとwindowが返される。
 */
it(
	'when the target block exists only in an editor iframe, should return the iframe document and window',
	() => {
		// ...
	}
);
```

## Dependencies and generated files

- Add dependencies only for concrete v1 needs.
- Do not restore Prototype dependencies simply because they were previously used.
- Do not edit generated files in `build/`, `vendor/`, or `node_modules/`.

## Validation

Use the applicable commands documented in `../docs/development/testing.md`. The user performs manual validation for the source-reset PR.
