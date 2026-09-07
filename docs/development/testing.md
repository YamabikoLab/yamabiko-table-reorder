# Testing and validation

Run application commands from the repository root. Use the narrowest relevant checks while working, then run the applicable non-mutating checks before handoff.

## Current formal v1 test state

- Jest verifies Row Reorder responsibilities, React / WordPress integration, editor lifecycle, and i18n source.
- Node.js architecture tests verify deterministic Markdown parsing, architecture validation, and Structurizr DSL generation.
- Playwright verifies the administration smoke test, Table alignment, and the major Row Reorder browser contracts (mouse / touch, guidance, merged cells, data preservation / Undo, and scrolling).
- The [Row Reorder validation matrix](../plans/row-reorder-v1-plan.md#698-validation-matrix) assigns contracts to existing Jest tests, major Playwright E2E, and separate performance measurement.
- Prototype-specific unit and E2E behavior is available from the `prototype-final` tag and is reference material, not the active formal v1 specification.
- Add tests as formal v1 responsibilities and user-visible contracts are implemented. Do not restore Prototype tests solely to preserve historical coverage.

## Node.js

Install dependencies:

```bash
npm ci
```

Run the standard Node.js quality gate:

```bash
npm test
```

`npm test` runs these checks in order:

```bash
npm run format:check
npm run lint:js
npm run lint:css
npm run typecheck
npm run test:architecture
npm run test:unit:coverage
```

Use individual commands while iterating on a focused change. Before handoff for JavaScript, TypeScript, JSON, CSS, or SCSS changes, use the applicable checks unless validation is intentionally left to the user.

Run Jest without coverage for a focused unit test run:

```bash
npm run test:unit
```

Run Jest with coverage reporting directly:

```bash
npm run test:unit:coverage
```

Run the architecture parser, validator, and Structurizr DSL generator tests directly:

```bash
npm run test:architecture
```

Generate Structurizr DSL from an architecture Markdown file:

```bash
npm run architecture:generate -- <architecture-markdown-path>
```

Architecture generation validates the machine-readable Markdown structure and Architecture Model before generating DSL. The generated DSL is then validated with Structurizr before it is written to the final output path. If any validation fails, the command exits unsuccessfully and does not replace the final DSL file.

Structurizr validation uses Docker and the pinned `structurizr/structurizr:2026.06.28-noble` image. Docker must therefore be available when running `architecture:generate` or `architecture:validate`.

When the output path is omitted, the generator writes a `.dsl` file next to the input Markdown using the same base name. To select another output path explicitly, pass it as the second argument:

```bash
npm run architecture:generate -- <architecture-markdown-path> <architecture-dsl-path>
```

Validate an existing Structurizr DSL file directly:

```bash
npm run architecture:validate -- <architecture-dsl-path>
```

The global Jest coverage threshold is 80% for Statements, Branches, Functions, and Lines. Keep the coverage configuration aligned with the active source rather than lowering it to accommodate untested formal v1 code.

### Jest and Playwright responsibility boundary

Use Jest for logic and branches that can be isolated reliably and quickly:

- pure logic and boundary conditions
- small conditional branches
- deterministic UI state that does not require a real browser
- WordPress API integration where mocks provide a stable local contract

Use Playwright E2E for behavior that depends on the real WordPress editor or browser environment:

- actual WordPress / Gutenberg integration
- real mouse, touch, pointer, or keyboard interaction
- iframe / browsing-context behavior when the formal v1 contract requires it
- end-to-end flows from user input through the observable result

Do not treat Prototype-specific input models or test helpers as formal v1 requirements unless the corresponding v1 contract has been accepted.

Create the production build separately:

```bash
npm run build
```

The build remains separate from `npm test` because it verifies production asset generation rather than source quality. PR Validation runs both `npm test` and `npm run build`.

Use `npm run format` or `npm run format:css` only when intentionally formatting files. They modify source files.

Use `npm start` for the watch-based local development build. It is long-running and is not a completion check.

## Playwright E2E

For local development, Playwright E2E tests run against the WordPress environment provided by the separate `YamabikoLab/wp-dev` repository. Tests use Chromium and one worker because they share the same WordPress environment.

`wp-dev` provides these environment variables:

- `WP_BASE_URL`
- `WP_USERNAME`
- `WP_PASSWORD`

Do not add real credentials to this repository. Authentication state is stored under `.playwright/.auth/`, which is excluded from Git.

With the `wp-dev` Dev Container open and Yamabiko Table Reorder and Flexible Table Block 3.9.0 active in WordPress, run:

```bash
npm run test:e2e
```

Refresh authentication only:

```bash
npm run test:e2e:auth
```

Start Playwright UI Mode:

```bash
npm run test:e2e:ui
```

### PR Validation E2E

PR Validation uses the CI-only environment defined in `tests/e2e/compose.ci.yaml`. The E2E job is optional and disabled by default for manually triggered validation.

CI checks the smoke test and major Row Reorder suite against these representative supported environments:

- WordPress 6.8.3: non-iframe editor, Flexible Table Block 3.6.0
- WordPress 7.0.4: iframe editor, Flexible Table Block 3.9.0
- WordPress 7.1.0: iframe editor, Flexible Table Block 3.9.0

The CI-only `tests/e2e/fixtures/non-iframe.php` registers an E2E-only Block API v2 block when `E2E_EDITOR_MODE=non-iframe`; this makes the WordPress 6.8 compatibility scenario exercise the non-iframe editing surface. The fixture block is hidden from the inserter and exists only to select the legacy editor context. Authentication setup verifies the expected editor mode before the suite runs. This representative matrix covers both editor contexts without duplicating every version/context combination. The fixture is not installed in local WordPress or included in the plugin distribution.

The CI E2E job uses the pinned Playwright Docker image matching `@playwright/test`. Failed runs upload `playwright-report/`, `test-results/`, and `docker-compose.log` when available.

Playwright writes authentication state to `.playwright/`, HTML reports to `playwright-report/`, and test artifacts to `test-results/`. These paths are excluded from Git.

WordPress-specific browser operations should use `@wordpress/e2e-test-utils-playwright` where it provides an appropriate helper. Use direct browser input when the input path itself is part of the formal v1 behavior under test.

### Row Reorder performance measurement (QR-01)

Run the dedicated Core Table / Flexible Table Block 1,000 × 20 stress measurement separately from the major E2E suite:

```bash
npm run test:e2e:performance
```

For repeated observations on the same machine and environment:

```bash
npm run test:e2e:performance -- --repeat-each=3
```

`E2E_PERFORMANCE=1` selects only `*.performance.ts` plus authentication; normal E2E selects `*.spec.ts`. PR Validation runs the normal suite. Performance measurements require a dedicated run and do not impose a fixed millisecond gate on normal CI.

The performance report attaches a JSON summary and Chrome CPU profiles for the same Table's ordinary WordPress attribute update, mode entry, physical drag start, progress, and commit. The baseline uses the same row move through the public WordPress update API; Undo restores the initial data outside measurement. The summary records Table size, browser version, editor context, wall time, and sampled CPU self time grouped by script owner. Record WordPress / FTB versions, machine conditions, and the tested SHA alongside the results.

Review the attached `.cpuprofile` files in browser developer tools when a phase is slow. Distinguish YTR and its bundled dnd-kit code from Table Block code, WordPress / React, browser work, and idle time. Script self-time attribution is sampling evidence, not exact end-to-end ownership: layout and React work triggered by YTR can appear under browser / WordPress frames. Use caller stacks and the baseline to investigate such work; do not subtract whole-operation wall times and call the difference YTR cost. Look for new sustained stalls in YTR calculation, state / presentation updates, and engine connection management. Total Table commit duration is not a QR-01 pass/fail threshold. A passing performance scenario establishes measurement completion and the row result; QR-01 assessment also requires reviewing the measurements. Record inconclusive attribution or unexecuted environments explicitly.

## PHP

Install locked development dependencies:

```bash
composer install
```

Validate Composer metadata:

```bash
composer validate --strict
```

Check the main plugin file for syntax errors:

```bash
php -l yamabiko-table-reorder.php
```

Check WordPress coding standards:

```bash
composer lint:php
```

Run PHPStan:

```bash
composer analyse:php
```

Use `composer format:php` only when intentionally applying automatic fixes.

## Dependency security audits

Run dependency vulnerability checks:

```bash
npm run audit:security
composer run audit:security
```

Run the relevant audit when dependency manifests or lock files change, or when investigating a dependency advisory.

## Repository checks

Check changed lines for whitespace errors:

```bash
git diff --check origin/main...HEAD
```

The manually triggered `.github/workflows/pr-validation.yml` workflow runs dependency security audits, Node.js checks, the production build, and PHP checks. Playwright E2E is optional.

## Which checks to run

- Documentation-only changes: `git diff --check origin/main...HEAD`.
- JavaScript, TypeScript, JSON, CSS, or SCSS changes: `npm test`, `npm run build`, and the repository check.
- Architecture Markdown or architecture tooling changes: the Node.js checks, `npm run architecture:generate -- <architecture-markdown-path>`, and the repository check. The generation command includes Structurizr validation and requires Docker.
- Playwright configuration or E2E changes: the Node.js checks and `npm run test:e2e` when a compatible WordPress environment is available.
- GitHub Actions or CI environment changes: the repository check and GitHub-hosted PR Validation.
- PHP or Composer changes: Composer validation, PHP syntax, coding standards, and PHPStan.
- npm or Composer dependency manifest / lock-file changes: the relevant dependency security audit in addition to applicable checks.
- Mixed changes: combine the applicable groups.

For checks requiring a local WordPress environment, follow the separate `YamabikoLab/wp-dev` documentation.

Do not claim checks were run when they were skipped or unavailable. Record the reason when an applicable check cannot be executed.
