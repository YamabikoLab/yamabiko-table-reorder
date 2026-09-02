# Jest test guidelines

These guidelines apply when creating or changing Jest tests under `src/`.

Jest tests should be structured so that their purpose and expected behavior can be understood without reading the implementation in detail.

## Test organization

- Group test cases with `describe` by meaningful behavior, scenario, or responsibility.
- Prefer behavior-oriented groups over implementation details such as helper functions or internal processing steps.

## Test case names

- Write each `it` or `test` description as a condition and expected result using `when <condition or action>, should <expected result>`.
- The `when` part should describe the condition or action being tested.
- The `should` part should describe the externally observable expected result.

## Production export boundaries

- Do not add or widen an export in production code solely to make an implementation detail directly accessible from Jest tests.
- Decide production exports from architectural responsibility and actual production usage, not from test convenience.
- Verify non-public functions, values, and implementation details through externally observable behavior exposed by the responsibility being tested.
- When behavior is difficult to test without exposing implementation details, reconsider the test boundary, test approach, or responsibility decomposition before widening the production API.
- When test isolation requires resetting Zustand state, prefer test-side setup or mocking rather than adding a production reset API solely for tests.

## Test case documentation

- Add a Japanese comment immediately before each test case so that the purpose of the test can be understood without reading the implementation.
- Include the following information:
  - 概要: 何を確認するテストなのか
  - 事前条件: テスト実行前に成立している状態
  - 操作: テスト対象に対して何を行うのか
  - 期待結果: 操作の結果として何が成立すべきか
- Keep the explanation focused on the behavior being verified and avoid repeating implementation details that are already obvious from the test code.
- Follow the Japanese spacing rule in `src/AGENTS.md` for these comments.

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
