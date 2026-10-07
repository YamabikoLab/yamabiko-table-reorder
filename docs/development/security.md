# Security QA

This document records the current security boundary of Yamabiko Table Reorder and the minimum checks that belong in the development flow. Keep the scope proportional to the plugin's actual attack surface; do not add speculative controls for features that do not exist.

## Current attack surface

The current plugin is centered on Gutenberg editor behavior and local plugin assets.

The current source does not define:

- REST API routes or AJAX handlers;
- custom database writes or direct SQL;
- file upload or file manipulation flows;
- privileged mutation endpoints that require capability or nonce checks;
- outbound HTTP requests or external API integrations;
- unsafe HTML insertion through `innerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`, or equivalent APIs.

These areas should be reassessed when the product starts using them rather than implemented in advance.

## Current security boundaries

The PHP entry point is responsible primarily for registering and enqueueing local plugin assets. Existing WPCS and PHPStan checks continue to cover coding-standard and static-analysis concerns, while Gitleaks covers committed secrets.

DOM updates should continue to use React or safe DOM text/property APIs for user-visible values. If future code accepts request, stored, decoded, or external values, apply the validation, authorization, sanitization, and final-context escaping rules in `foundation.md`.

## Dependency vulnerability checks

Dependency audit commands and when to run them are documented in `testing.md`, which is the source of truth for validation commands.

The audits fail for high or critical advisories. The npm blocking gate is limited to required production dependencies with `--omit=dev --omit=optional`. Optional dependencies are excluded from that audit only because `npm run test:optional-runtime` independently verifies that dependency nodes reachable only through optional paths are absent from the production Webpack module graph. Dependencies that belong to both the production and optional groups are not classified as optional-only.

The optional-runtime guard compares installed dependency node identity by resolved path rather than package name alone. This avoids false positives when the same package name is present through both required and optional paths, while still failing when an optional-only package instance is bundled.

Lower-severity advisories are intentionally excluded from the blocking threshold so transitive development dependencies do not create excessive PR noise. Composer abandoned-package notices are also excluded from this security failure condition because abandonment is a maintenance concern rather than a vulnerability by itself.

PR Validation runs both dependency audits after dependency installation. These checks complement rather than replace the existing quality gates:

- Gitleaks: committed secrets across Git history;
- ESLint / Stylelint / TypeScript: JavaScript, TypeScript, and stylesheet quality;
- WPCS / PHPStan: PHP coding standards and static analysis;
- Jest / Playwright: behavior and integration coverage;
- dependency audits: known high or critical advisories in the blocking npm production set and resolved Composer dependency set;
- optional-runtime guard: optional-only npm dependency instances are absent from the production Webpack module graph.

Do not add dedicated security tests unless there is concrete product behavior or a regression that such a test can meaningfully protect.

## When to expand Security QA

Revisit the security approach in a separate issue when the plugin introduces a materially larger attack surface, such as REST endpoints, AJAX handlers, custom persistence, file operations, authentication or authorization logic, or external services. At that point, decide whether additional source-level checks or dynamic security testing are justified.
