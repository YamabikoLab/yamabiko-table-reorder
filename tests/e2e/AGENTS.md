# E2E test instructions

These instructions apply to files under `tests/e2e/`.

## Current phase

- The previous Table Reorder E2E suite belongs to the YTR Prototype and is available from the `prototype-final` tag.
- Do not restore Prototype specs or helpers merely to preserve the previous test structure.
- Add v1 E2E scenarios only when the corresponding user-visible contract has been established for the formal v1 implementation.

## Test responsibility

- Use Playwright E2E for behavior that depends on the real browser, WordPress / Gutenberg editor integration, input devices, or runtime integration.
- Keep logic and branches that do not require a real browser in Jest.
- Assert user-observable behavior rather than implementation details.
- Keep the minimal administration smoke test active so the E2E environment continues to verify that the plugin is installed and active.

## WordPress editor interaction

- Prefer `@wordpress/e2e-test-utils-playwright` helpers when they appropriately create WordPress or Gutenberg state.
- Use direct browser input when the input path itself is part of the behavior under test.
- Do not hard-code URLs, credentials, or environment-specific paths.
- Introduce editor-context helpers only when a concrete v1 scenario requires them. Do not restore Prototype helpers by default.

## Input fidelity

- Preserve the intended keyboard, mouse, pointer, or touch input method when that input path is part of the v1 contract.
- Prefer Playwright input APIs.
- When Playwright cannot accurately reproduce a required input, Chromium CDP may be used only inside E2E test support code.
- Do not change product code only to make an E2E test easier to write.
- Derive gesture coordinates from locators or bounding boxes rather than fixed screen coordinates.

## Deterministic tests

- Do not use fixed `waitForTimeout()` calls for synchronization.
- Wait for the state that makes the next operation possible, using Playwright assertions, `expect.poll()`, or another state-based condition.
- Prefer assertions on visible UI, accessibility state, logical order, or edited post content.
- Final assertions must verify behavior observable by the user.

## Test isolation

- Each test must construct the state it requires.
- Do not depend on test execution order or state left by a previous test.
- Explicitly set persistent WordPress preferences when they affect the scenario.

## Selectors and helpers

- Prefer roles, accessible names, text, and stable user-facing selectors over brittle DOM traversal.
- Add helpers only for concrete repeated v1 operations.
- Centralize low-level CDP or coordinate handling in test support code instead of duplicating it across specs.
- Do not hide feature assertions inside helpers so deeply that the behavior under test is unclear from the spec.

## Prototype reference

When historical E2E behavior is useful as research material, inspect it from the `prototype-final` tag. Treat those tests as evidence and reference material, not as the formal v1 specification.

## Validation

- Follow `docs/development/testing.md` for validation commands.
- Do not duplicate validation command lists in this file.
- If the required WordPress environment is unavailable and E2E tests were not run, do not report them as successful.
