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

## Production dependencies

- Use production dependencies directly when they are available in the Jest environment. Do not replace them with test doubles merely to simplify a test.
- This rule applies to YTR modules and responsibilities, `@wordpress/data` `select()` and `dispatch()`, WordPress data stores, Zustand stores, WordPress Components, implemented modules such as `messages.ts`, and other available production dependencies.
- Exercise the behavior under test through its production public boundary, action, or selector so that the test covers the real contract between responsibilities.
- For WordPress data, register or use the real store, populate it with the blocks and state required by the scenario, and exercise its real actions and selectors. Do not mock `@wordpress/data` itself.
- Prefer assertions on return values, real store state, rendered UI, public callback results, and state changes observable after production responsibilities are connected. Do not make calls to mocked production dependencies the primary specification of behavior.

## Test setup and teardown

- Keep test state setup and cleanup separate from the production path whose behavior the test verifies.
- Use state manipulation APIs already provided by a real store when they are needed to establish or restore deterministic test isolation. This test-side state management does not replace the store's production behavior with a test double.
- For Zustand stores, production state transitions under test must use public production actions. Setup and teardown may use the existing store's `setState()`, `getInitialState()`, or equivalent state APIs to reset state directly.
- Do not require setup or teardown to use only the production lifecycle when its guards cannot restore arbitrary test state reliably.
- For WordPress data stores, deterministically initialize or restore shared store state before or after each test so that blocks and state from one test cannot leak into another.
- Do not add test-only production APIs or widen production exports solely to support setup, teardown, or state reset.

## Test double exceptions

- Replace a production dependency with a test double only when using the real dependency is technically impractical or the required condition cannot be reproduced deterministically through a reasonable public production boundary.
- Valid exceptions include injecting failures that cannot reasonably be triggered through a public production boundary; browser and layout behavior absent from Jest or JSDOM, such as geometry, `ResizeObserver`, or DnD that requires real layout; and environmental boundaries such as time that require deterministic control.
- State why the real dependency cannot be used in the test or related documentation whenever a production dependency is replaced.
- `jest.fn()` is permitted to record an externally observable contract such as a public callback. The restriction is on replacing available production behavior, not on Jest mock APIs themselves.

## Production export boundaries

- Do not add or widen an export in production code solely to make an implementation detail directly accessible from Jest tests.
- Decide production exports from architectural responsibility and actual production usage, not from test convenience.
- Verify non-public functions, values, and implementation details through externally observable behavior exposed by the responsibility being tested.
- When behavior is difficult to test without exposing implementation details, reconsider the test boundary, test approach, or responsibility decomposition before widening the production API.
- When test isolation requires resetting Zustand state, use the real store's existing state APIs from test-side setup rather than mocking the production store or adding a production reset API solely for tests.

## React Testing Library

- Prefer React Testing Library for tests that verify React components, custom Hooks, or other React integration boundaries.
- Use `renderHook()` for custom Hooks and `render()` for components when those APIs can express the behavior being verified. Avoid manual `createRoot()`, container management, or React test-environment setup unless React Testing Library cannot represent the required scenario clearly.
- Test behavior that is observable through the React consumer boundary. Avoid asserting internal React state, private implementation details, CSS class names, or incidental DOM structure unless they are part of the responsibility's public behavior.
- Keep React integration tests scoped to the behavior owned by the React boundary. Do not duplicate the specification of React-independent responsibilities that are already verified by their own Jest tests.
- When a React boundary subscribes to shared state such as a Zustand store, verify the contract between the store and React, such as observable updates, mount/unmount behavior, remount behavior, and subscription cleanup when those behaviors are important to the responsibility.
- Prefer user-observable queries for rendered UI. Use implementation-oriented queries such as test IDs only when no meaningful user-facing query exists for the behavior under test.
- Keep test setup focused on the scenario being verified. Do not reproduce production component trees, providers, or DOM structure that are unrelated to the responsibility under test.

## Test case documentation

Follow [`test-case-documentation.md`](./test-case-documentation.md) for the common test case documentation format.

For Jest tests:

- Describe conditions and expected results at the responsibility or externally observable behavior boundary being tested.
- Do not document mocks, test doubles, helper calls, or internal state transitions unless they are themselves part of the responsibility contract being verified.
- Follow the Japanese spacing rule in `src/AGENTS.md` for test comments under `src/`.

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
 * - 対象ブロックからEditor環境の解決を要求する。
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
