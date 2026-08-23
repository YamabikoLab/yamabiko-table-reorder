# Yamabiko Table Reorder plugin instructions

These instructions apply to plugin source files under `src/`.

## Plugin root

- The repository root is the plugin root.
- Run npm, Composer, PHP, and build commands from the repository root.
- `src/` is the Table Reorder source boundary; generated production assets live under `build/` and are not committed.

## Source boundaries

- Keep `src/index.tsx` as the thin plugin-wide entry point.
- Put row / `tbody` / `rowspan` specific implementation under `src/row-reorder/`.
- Put row-specific imperative controller and UI behavior under `src/row-reorder/controller/`.
- Put only clearly responsibility-neutral editor/runtime infrastructure under `src/common/`. Code in `common/` must not depend on `row-reorder/`.
- Keep source-level declarations under `src/types/`.
- Add a future feature boundary such as `column-reorder/` only when that feature is actually implemented.

## Implementation rules

- Prefer public WordPress APIs, hooks, components, and data stores.
- Follow `../docs/development/source-organization.md` when adding or moving source files.
- Do not move code into `common/` merely because it might be reusable later. Keep code with its current owning feature until multiple real consumers prove a stable shared responsibility.
- Do not create generic `shared/`, `utils/`, or `helpers/` directories for possible future reuse.
- Keep entry files small. They should register or compose a feature, not contain unrelated implementation details.
- Treat saved block markup, attributes, identifiers, hooks, and persisted data as compatibility contracts.

## Table Reorder implementation rules

- Treat row and column reordering as independent feature boundaries. Do not make either feature depend on the other's internal implementation.
- Do not preemptively combine row and column behavior into a generic abstraction such as `axis: 'row' | 'column'`. Extract shared behavior only after real implementations demonstrate a stable common responsibility.
- Treat Gutenberg block attributes and block data as the source of truth for committed reorder results. DOM changes made temporarily during DnD must not be treated as persisted state.
- Keep Core Table, Flexible Table Block, and other block-specific differences inside clear boundaries within each feature instead of scattering block-specific conditionals throughout the implementation.
- Resolve the editor `document` and `window` from the current editor context. Do not assume global browsing contexts or cache editor contexts across iframe / non-iframe lifecycle changes.
- Pointer, touch, keyboard, and destination-selection UI may differ by input method, but reorder eligibility and commit rules must remain domain rules rather than being duplicated or independently redefined for each input path.

## Security and data handling

- Treat request, stored, decoded, and external values as untrusted.
- Validate expected values, sanitize for storage, authorize privileged actions, and escape at the final output boundary.
- Use nonces where WordPress requires CSRF protection. A nonce does not replace a capability check.
- Give every REST route a meaningful `permission_callback`.
- Prefer WordPress data APIs and use `$wpdb->prepare()` for variable SQL when direct queries are unavoidable.
- Do not use `eval`, unsafe deserialization, telemetry, remote code, or external services without an explicit requirement and review.

## Internationalization and accessibility

- Translate user-visible strings with the `yamabiko-table-reorder` text domain.
- Use semantic HTML and WordPress UI primitives where practical.
- Support keyboard operation and visible focus for interactive controls.
- Do not communicate meaning through color alone.

## Dependencies and generated files

- Add dependencies only when they solve a current need and do not duplicate WordPress-provided runtimes.
- Keep runtime and development dependencies separate.
- Update and commit the relevant lockfile when dependency definitions change.
- Do not edit generated files in `build/`, `vendor/`, or `node_modules/`.

## Validation

Use the applicable commands documented in `../docs/development/testing.md`. Do not substitute formatting commands for non-mutating checks when validating a change.
