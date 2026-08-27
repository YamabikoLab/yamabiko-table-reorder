# Development foundation

This document defines the cross-cutting development rules for Yamabiko Table Reorder. Working instructions live in `AGENTS.md` files, and validation commands live in `testing.md`.

## Current development phase

YTR Prototype is preserved by the `prototype-final` tag. Formal v1 is the active development line.

Do not use Prototype source structure, interaction details, tests, or archived documents as the default specification for formal v1. Historical material may be consulted from `prototype-final` as reference evidence when useful.

Keep active source and documentation aligned with the formal v1 decisions that are currently valid. Add structure only when current implementation or an accepted design requires it.

## Formal v1 development flow

Develop formal v1 in this order:

```text
requirements
    ↓
design
    ↓
architecture
    ↓
implementation
```

- **Requirements** define what users, the product, and quality must achieve.
- **Design** defines how those requirements appear as user-visible interactions, states, messages, and behavior.
- **Architecture** defines the internal responsibilities, boundaries, and contracts needed to realize the design.
- **Implementation** follows the accepted requirements, design, and architecture.

Do not choose formal v1 architecture or implementation by extending Prototype structure first. Derive them from the accepted requirements and design.

## Product boundary

Yamabiko Table Reorder is a WordPress plugin for site creators. It provides accessible table reordering for supported table blocks in the WordPress block editor.

Formal v1 includes both **Row Reorder** and **Column Reorder** as product scope. It targets both the WordPress **Core Table** block and **Flexible Table Block** from the start. Implementation work may be split into smaller phases, but formal v1 requirements and design must consider both reorder directions and both supported table blocks.

The repository root is the WordPress plugin root. Published minimum versions must stay aligned with the metadata in `yamabiko-table-reorder.php`.

Local WordPress, PHP, Docker, and Dev Container configuration is maintained in the separate `YamabikoLab/wp-dev` repository. This repository maintains the plugin itself and its product documentation, tests, and release automation.

Keep the product focused on table reordering. Do not broaden it into unrelated editor tools or add REST endpoints, custom HMR, persistence, telemetry, external services, or new distribution flows until an issue requires them.

## Stable identifiers

Use these identifiers consistently:

| Surface | Form |
| --- | --- |
| Plugin slug and text domain | `yamabiko-table-reorder` |
| PHP namespace | `YamabikoLab\\TableReorder\\` |
| Global PHP function prefix | `yamabiko_table_reorder_` |
| PHP constant prefix | `YAMABIKO_TABLE_REORDER_` |
| Action and filter prefix | `yamabiko-table-reorder/` |
| REST namespace | `yamabiko-table-reorder/v1` |
| Script and style handle prefix | `yamabiko-table-reorder-` |
| CSS class prefix | `yamabiko-table-reorder-` |

Project-owned CSS class names follow the Gutenberg naming convention. Use the `yamabiko-table-reorder-` prefix, lowercase kebab-case within each segment, `__` for child elements, and `--` for modifiers. Use separate `is-` or `has-` classes for state. Do not rename classes owned by WordPress or third-party dependencies. When an external class does not satisfy the configured Stylelint naming rule, disable only the affected selector with a short explanation.

Released identifiers, saved markup, persisted keys, and public hooks are compatibility contracts. Change them only with an explicit migration or compatibility decision.

## WordPress lifecycle

- Prefer public WordPress APIs, actions, filters, components, and data stores.
- Register work on the narrowest suitable hook.
- Load editor, front-end, and admin assets only where needed.
- Keep activation minimal.
- Do not delete durable data during deactivation. Durable deletion belongs to uninstall.

## Security and privacy

- Treat request, stored, decoded, and external values as untrusted.
- Validate expected values, sanitize for storage, authorize privileged operations, and escape at the final output boundary.
- Use nonces where WordPress requires CSRF protection. Nonces do not replace capability checks.
- Give every REST route a meaningful `permission_callback`.
- Prefer WordPress data APIs. Use `$wpdb->prepare()` when variable SQL is unavoidable.
- Do not use `eval` or unsafe deserialization.
- Do not expose secrets, credentials, personal data, stack traces, or local paths.
- Do not add telemetry, remote code, remote fonts, or external services without an explicit requirement and review.

## Internationalization and accessibility

- Translate user-visible strings with the `yamabiko-table-reorder` text domain.
- Put dynamic values in placeholders and escape output for its final context.
- Prefer semantic HTML and WordPress UI primitives.
- Accessibility is a formal v1 product contract, not an implementation afterthought.
- Do not rely on color alone to communicate meaning.

## Dependencies and assets

- Add a dependency only for a current need after checking maintenance, license, security, and overlap with WordPress.
- Keep runtime and development dependencies separate.
- Commit `package-lock.json` and `composer.lock` when their dependency files change.
- Keep WordPress-provided JavaScript runtimes external to production bundles.
- Do not commit generated dependencies, caches, or build output.

## Source and documentation

- Follow the nearest `AGENTS.md` for active source, E2E, design, and requirements responsibilities.
- Do not recreate Prototype implementation or documentation archives inside the active tree. Use `prototype-final` when historical material is needed.
- Create or update source boundaries when formal v1 implementation pressure makes the responsibility real.
- Create requirements and design documents from accepted formal v1 decisions rather than copying Prototype documents forward.
- Follow `testing.md` for the validation commands that currently exist.
- Update these documents when the actual structure or command surface changes.
