# Testing and validation

Run application commands from the repository root. Use the narrowest relevant checks while working, then run the applicable non-mutating checks before handoff.

## Current formal v1 test state

The active formal v1 source and E2E suite are intentionally minimal while #481 defines the new behavior contracts.

- Jest currently verifies the minimal source skeleton and i18n source.
- Node.js architecture tests verify deterministic Markdown parsing and Structurizr DSL generation.
- Playwright currently keeps the E2E infrastructure alive with an administration smoke test that verifies the plugin is active.
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
npm run test:unit:coverage
npm run test:architecture
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

Run the architecture parser and Structurizr DSL generator tests directly:

```bash
npm run test:architecture
```

Generate Structurizr DSL from the architecture Markdown source:

```bash
npm run architecture:generate
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

With the `wp-dev` Dev Container open and Yamabiko Table Reorder active in WordPress, run:

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

While the active suite contains only the administration smoke test, CI checks that same smoke test against these representative supported WordPress versions:

- WordPress 6.8.3
- WordPress 7.0.4
- WordPress 7.1.0

The current CI smoke matrix intentionally does **not** install Flexible Table Block, force an editor mode, or install the former non-iframe fixture. Those were Prototype interaction-test requirements and should return only when a concrete formal v1 E2E scenario needs them.

The CI E2E job uses the pinned Playwright Docker image matching `@playwright/test`. Failed runs upload `playwright-report/`, `test-results/`, and `docker-compose.log` when available.

Playwright writes authentication state to `.playwright/`, HTML reports to `playwright-report/`, and test artifacts to `test-results/`. These paths are excluded from Git.

WordPress-specific browser operations should use `@wordpress/e2e-test-utils-playwright` where it provides an appropriate helper. Use direct browser input when the input path itself is part of the formal v1 behavior under test.

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
- Playwright configuration or E2E changes: the Node.js checks and `npm run test:e2e` when a compatible WordPress environment is available.
- GitHub Actions or CI environment changes: the repository check and GitHub-hosted PR Validation.
- PHP or Composer changes: Composer validation, PHP syntax, coding standards, and PHPStan.
- npm or Composer dependency manifest / lock-file changes: the relevant dependency security audit in addition to applicable checks.
- Mixed changes: combine the applicable groups.

For checks requiring a local WordPress environment, follow the separate `YamabikoLab/wp-dev` documentation.

Do not claim checks were run when they were skipped or unavailable. Record the reason when an applicable check cannot be executed.
