# Test case documentation

These guidelines apply when documenting individual test cases in this repository.

Each test case should be understandable without reading the implementation in detail.

## Required documentation

- Add a Japanese comment immediately before each test case.
- As a rule, include the following information:
  - 概要: 何を確認するテストなのか
  - 事前条件: テスト実行前に成立している状態
  - 操作: テスト対象に対して何を行うのか
  - 期待結果: 操作の結果として何が成立すべきか
- Omit a section when it does not meaningfully apply to the test case.
- Keep the explanation focused on the behavior being verified.
- Do not repeat implementation details that are already apparent from the test code.
- Do not describe helper names, selectors, DOM traversal, coordinates, mocks, or internal processing steps as if they were product behavior.
- Describe conditions and expected results using product, responsibility, or user-facing terminology appropriate to the test boundary.
- When multiple preconditions, operations, or expected results are material to the scenario, list each one separately.
- Do not add entries only to fill the format. Omit incidental details that do not help explain the behavior being verified.

## Comment structure

Use the following structure as the default form:

```ts
/**
 * <概要>
 *
 * 事前条件:
 * - <テスト実行前の状態>
 *
 * 操作:
 * - <テスト対象に対して行うこと>
 *
 * 期待結果:
 * - <成立すべき結果>
 */
```

When a section does not meaningfully apply to the test case, omit that section rather than adding placeholder text.
