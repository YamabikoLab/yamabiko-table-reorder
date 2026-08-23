# Editor Environment

## Overview

Table Reorder supports both iframe and non-iframe WordPress editors.

The Editor Environment is a small internal boundary that hides only one difference between those editor modes: **how Table Reorder finds the current editor browsing context**.

The important idea is simple:

> Product code should be able to work with normal DOM and Web APIs without needing to know whether the editor is inside an iframe.

The Editor Environment is therefore not a browser abstraction layer. It does not wrap `focus()`, geometry APIs, selection APIs, scrolling, or other normal browser capabilities. It only answers the question: **which editor `document` and `window` should Table Reorder use right now?**

This document records the result of the PoC implemented for issue #430 and PR #441.

## Why this PoC was needed

Before the PoC, `table-context.ts` was responsible for both:

- finding the correct editor context, including iframe fallback;
- finding the Table block, `table`, and `tbody` inside that context.

That worked, but it meant Table-specific DOM resolution also knew about WordPress editor iframe details.

The PoC tested whether that iframe knowledge could be moved behind a small boundary without spreading a new abstraction through the rest of Table Reorder.

The main question was:

> Can iframe / non-iframe discovery and lifecycle concerns be isolated while consumers continue to use standard Web APIs directly?

## Result

The PoC supports a **yes** for the current Table Reorder architecture.

The iframe-specific discovery logic is now isolated in `editor-environment.ts`, while `table-context.ts` handles only Table-specific DOM resolution.

No controller, drag UI, keyboard, pointer, touch, focus, or scroll implementation needed to be rewritten for the new boundary.

The resulting flow is:

```text
Table Reorder consumer
        |
        v
Table Context
        |
        |  resolves block / table / tbody
        v
Editor Environment
        |
        |  resolves current document / window
        v
iframe / non-iframe editor
```

The Editor Environment contract stayed smaller than the initial illustrative idea. The production contract currently exposes only:

```ts
type EditorEnvironment = {
	document: Document;
	window: Window;
};
```

`root` and `scrollContainer` were not added because current production code does not need them for browsing-context discovery.

## What moved behind the boundary

`editor-environment.ts` now owns:

- deciding whether the target block is in the anchor's owning document;
- falling back to `iframe[name="editor-canvas"]` when needed;
- reading the iframe's current `contentDocument` and `contentWindow`;
- returning the matching editor `document` and `window`.

`table-context.ts` consumes that result and then resolves:

- the target block element;
- the `table`;
- the first `tbody`.

This separation keeps WordPress editor discovery and Table DOM discovery as two different responsibilities.

## What deliberately stayed outside the boundary

Normal DOM-local and browser operations remain direct Web API usage.

For example, consumers may still use APIs such as:

- `element.ownerDocument`;
- `document.defaultView` when it is derived from a concrete local DOM node rather than used to discover the editor context;
- `focus()`;
- `getBoundingClientRect()`;
- `getComputedStyle()`;
- `Selection`;
- `Range`;
- observers;
- normal DOM traversal and scrolling logic.

The Editor Environment should not become a mandatory gateway for these APIs.

This is an important part of the result. The PoC did not merely hide iframe details. It did so **without making ordinary Web development harder**.

## Lifecycle behavior

The resolver is stateless. It does not cache an editor `document` or `window` between calls.

That matters because an editor iframe may be detached and recreated. A cached reference could then point to an old browsing context.

The focused test covers this sequence:

1. resolve the first iframe context;
2. remove that iframe;
3. create a replacement iframe;
4. resolve again;
5. confirm that the second result uses the new iframe document instead of the old one.

This verifies the intended stale-context protection at the resolver boundary.

A dedicated real-browser scenario that forces Gutenberg itself to tear down and recreate the iframe is not currently part of the E2E suite. That remains a possible future strengthening of lifecycle coverage.

## PoC measurements

The PoC is useful because its result can be described with concrete measurements rather than only architectural preference.

| Measurement | Result |
| --- | --- |
| iframe E2E | PASS |
| non-iframe E2E | PASS |
| Manual local iframe verification | PASS |
| Manual local non-iframe verification | PASS |
| iframe-specific production modules | 1 (`editor-environment.ts`) |
| `contentDocument` / `contentWindow` references outside the boundary | 0 |
| Existing production modules that required modification | 1 (`table-context.ts`) |
| Editor Environment capabilities | 2 (`document`, `window`) |
| Browser API wrappers added | 0 |
| Existing consumer modules that required adaptation | 0 |
| Focused iframe recreation test | PASS |

The most important measurements are not line counts. They show that the boundary is **small and non-invasive**:

- iframe knowledge has one production owner;
- existing consumers did not need to become Environment-aware;
- standard browser APIs remain directly usable;
- the contract contains only the capabilities currently required.

## How to check isolation

The following search provides a simple regression check for iframe-specific production code:

```bash
rg 'contentDocument|contentWindow|iframe\[name="editor-canvas"\]' src \
  --glob '*.ts' \
  --glob '*.tsx' \
  --glob '!**/*.test.*'
```

For the current implementation, the expected production-code result is only:

```text
src/editor-environment.ts
```

A narrower check for direct iframe DOM API access is:

```bash
rg -l 'contentDocument|contentWindow' src \
  --glob '*.ts' \
  --glob '*.tsx' \
  --glob '!**/*.test.*'
```

The expected result is again only `src/editor-environment.ts`.

These searches are not intended to prohibit ordinary `ownerDocument` or `defaultView` usage. Those APIs are valid when they are used for a concrete DOM node's local context rather than for editor browsing-context discovery.

## Validation evidence

The PoC was validated through the existing repository checks and editor-mode coverage.

GitHub Actions run:

- https://github.com/YamabikoLab/yamabiko-table-reorder/actions/runs/32609568439

That run completed successfully, including:

- Node quality checks and build;
- PHP checks;
- WordPress 7.1 iframe E2E;
- WordPress 6.8.3 non-iframe E2E.

Manual local verification also confirmed normal Table Reorder behavior in both iframe and non-iframe editors.

## What this PoC demonstrates

The result suggests that most Table Reorder product code does not need to know about iframe structure at all.

The editor mode is an environment concern, not a drag-and-drop concern, keyboard concern, touch concern, focus concern, or Table row-order concern.

That distinction is the main architectural value of the PoC.

The boundary can therefore be described as:

> A thin guide to the current editor context, not a layer that hides the Web platform.

This is deliberately different from creating a large Canvas or browser abstraction. The Editor Environment only contains the editor-specific discovery knowledge that consumers should not have to duplicate.

## What the PoC does not prove

The current result does not yet prove that the same abstraction should become a standalone package or a WordPress public API.

It also does not prove that non-iframe E2E coverage can immediately be removed. During the PoC, both editor modes remain important evidence that the boundary behaves correctly.

Before reducing integration coverage or extracting the abstraction, further evidence may be useful around:

- real-browser iframe teardown and recreation;
- whether future editor-context requirements keep the contract small;
- whether other consumers have the same discovery problem;
- whether WordPress eventually provides a public API that can replace some or all of the discovery implementation.

## Architectural conclusion

For Table Reorder, the PoC achieved the intended separation with a small blast radius.

The practical architecture is now:

```text
Product code
  |
  | normal DOM / Web APIs
  v
Table-specific behavior
  |
  | asks only for the current editor context
  v
Editor Environment
  |
  | iframe-specific discovery and lifecycle boundary
  v
WordPress editor browsing context
```

The key result is not simply that both editor modes still work.

It is that **they still work while iframe-specific knowledge is concentrated in one thin production boundary and the rest of Table Reorder remains ordinary Web application code**.

## References

- Issue #430: PoC: isolate editor browsing context behind an Editor Environment
- PR #441: PoC implementation
- `docs/plans/table-reorder/editor-environment-poc-plan.md`: implementation plan
- `src/editor-environment.ts`: browsing-context boundary
- `src/table-context.ts`: Table-specific DOM resolution
