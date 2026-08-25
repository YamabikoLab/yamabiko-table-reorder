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

## Implementation rules

- Prefer public WordPress APIs, hooks, components, and data stores.
- Keep Gutenberg block attributes and block data as the source of truth for committed reorder results.
- Input-specific behavior may differ for keyboard, pointer, and touch, but shared reorder rules must remain in explicit domain contracts.
- Preserve the v1 performance principles defined in #481: do not make UI, listeners, geometry work, or hot-path scans scale with total row count when avoidable; do not reorder the real Table DOM during drag; commit logical data only when the operation is finalized.
- Resolve editor browsing context from the active editor context rather than assuming global `window` / `document` lifetimes.

## Internationalization and accessibility

- Translate user-visible strings with the `yamabiko-table-reorder` text domain.
- Keep translatable messages centralized enough for the existing i18n pipeline to extract them reliably.
- Support keyboard operation, visible focus, announcements, focus restoration, and Undo according to the contracts defined from #481.
- Do not communicate meaning through color alone.

## Dependencies and generated files

- Add dependencies only for concrete v1 needs.
- Do not restore Prototype dependencies simply because they were previously used.
- Do not edit generated files in `build/`, `vendor/`, or `node_modules/`.

## Validation

Use the applicable commands documented in `../docs/development/testing.md`. The user performs manual validation for the source-reset PR.
