# Testing and validation

Run application commands from the repository root. Use the narrowest relevant checks while working, then run the applicable non-mutating checks before handoff.

## Current formal v1 baseline

The active test suite is intentionally minimal while formal v1 is redesigned from #481.

- Unit tests should cover only behavior that exists in the active formal v1 source tree.
- Playwright E2E currently keeps only the minimum infrastructure smoke coverage.
- Prototype unit and E2E suites remain available from the `prototype-final` tag as historical reference material.
- Do not restore Prototype tests merely to reproduce the previous suite. Add tests when the corresponding formal v1 contract and implementation exist.

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
npm run test:unit:coverage
```

Use the individual commands when iterating on a focused change. Before handoff for JavaScript, TypeScript, JSON, CSS, or SCSS changes, use `npm test` so local development and PR Validation share the same quality gate.

Run Jest without coverage for a faster focused unit test run:

```bash
npm run test:unit
```

Run Jest with coverage reporting directly when needed:

```bash
npm run test:unit:coverage
```

The formal v1 skeleton keeps a minimal unit test so the Jest pipeline remains active. Expand unit coverage alongside real v1 modules and contracts rather than recreating Prototype-specific controller, handle, SortableJS, row, or column tests by default.

Create the production build separately:

```bash
npm run build
```

The build remains separate from `npm test` because it verifies production asset generation rather than source quality. PR Validation runs both `npm test` and `npm run build`.

Use `npm run format` or `npm run format:css` only when intentionally formatting files. They modify source files and are not validation commands.

Use `npm start` for the watch-based local development build. It is long-running and is not a completion check.

## Playwright E2E

For local development, Playwright E2E tests run against the WordPress environment provided by the separate `YamabikoLab/wp-dev` repository. The browser target is Chromium, and tests use one worker because they share the same WordPress environment.

`wp-dev` provides the canonical WordPress URL and administrator credentials to the Dev Container as these environment variables:

- `WP_BASE_URL`
- `WP_USERNAME`
- `WP_PASSWORD`

Do not add real credentials to this repository. Authentication state is stored under `.playwright/.auth/`, which is excluded from Git.

With the `wp-dev` Dev Container open and Yamabiko Table Reorder active in WordPress, run the active E2E suite from the repository root:

```bash
npm run test:e2e
```

Run only authentication setup when refreshing the saved administrator session:

```bash
npm run test:e2e:auth
```

Start Playwright UI Mode with a fresh authentication state:

```bash
npm run test:e2e:ui
```

The active formal v1 E2E suite currently verifies the minimum WordPress integration baseline, such as the plugin being installed and active. Add editor, keyboard, pointer, touch, accessibility, data, merged-cell, or compatibility scenarios only when those behaviors become part of the accepted formal v1 contract and implementation.

Historical Prototype E2E scenarios remain available from the `prototype-final` tag. Treat them as research evidence, not as the formal v1 specification.

PR Validation uses the CI environment in `tests/e2e/compose.ci.yaml`. When manually starting the workflow, enable `Run E2E tests` to run the E2E matrix; it is disabled by default. The CI E2E infrastructure remains in place even while the active suite is intentionally small.

Playwright writes authentication state to `.playwright/`, HTML reports to `playwright-report/`, and test artifacts to `test-results/`. Failed tests retain trace, screenshot, and video artifacts for investigation. These paths are excluded from Git.

WordPress-specific browser operations should use `@wordpress/e2e-test-utils-playwright` where appropriate. Use direct browser input when the input path itself is part of the behavior under test.

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

Run the focused dependency vulnerability checks from the repository root:

```bash
npm run audit:security
composer run audit:security
```

Both commands fail for high or critical advisories. Run the relevant audit locally when dependency manifests or lock files change, or when investigating a dependency advisory.

## Repository checks

Check changed lines for whitespace errors:

```bash
git diff --check origin/main...HEAD
```

The manually triggered `.github/workflows/pr-validation.yml` workflow runs dependency security audits, `npm test`, the production build, and PHP checks. Playwright E2E is optional and disabled by default.

## Which checks to run

- Documentation-only changes: `git diff --check origin/main...HEAD`.
- JavaScript, TypeScript, JSON, CSS, or SCSS changes: `npm test`, `npm run build`, and the repository check.
- Playwright configuration or E2E test changes: run the Node.js checks above and `npm run test:e2e` when a compatible `wp-dev` WordPress environment is available.
- GitHub Actions or CI E2E environment changes: run the repository check and validate through the GitHub-hosted PR Validation workflow.
- PHP or Composer changes: Composer validation, PHP syntax, PHP coding standards, and PHPStan.
- npm or Composer dependency manifest / lock-file changes: run the relevant dependency security audit in addition to the applicable checks above.
- Mixed changes: combine the applicable groups.

For checks that require a local WordPress environment, follow the commands documented in the separate `YamabikoLab/wp-dev` repository.

Do not claim checks were run when they were skipped or unavailable. Record the reason when an applicable check cannot be executed.
