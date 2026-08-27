# Yamabiko Table Reorder repository instructions

These instructions apply to the entire repository.

## Current development phase

- The implementation through 0.4.0 is **YTR Prototype** and is preserved by the `prototype-final` tag.
- Do not restore Prototype code, tests, design documents, implementation plans, dependencies, or directory structure merely to preserve the old shape.
- Use `prototype-final` when historical implementation or documentation is needed as reference material.
- Treat formal v1 as a design and implementation generation. Release version history continues from 0.4.0, with the next release using 0.5.0.
- `demo/` is intentionally retained as the shared Prototype v0.4.0 demo. Do not treat it as evidence of the current `main` implementation.

## Repository boundaries

- The repository root is the WordPress plugin root.
- `src/` contains active formal v1 product source. Read `src/AGENTS.md` before changing files under `src/`.
- `tests/e2e/` contains active formal v1 Playwright coverage. Read `tests/e2e/AGENTS.md` before changing E2E files.
- `docs/requirements/AGENTS.md`, `docs/design/AGENTS.md`, `docs/architecture/AGENTS.md`, and `docs/plans/AGENTS.md` define the responsibility and abstraction level of future requirements, design, architecture, and plan documents.
- `docs/development/` contains development principles and operating documentation that remain valid for formal v1.
- Local WordPress development infrastructure is maintained in the separate `YamabikoLab/wp-dev` repository.

## Development documentation

- Read `docs/development/foundation.md` for repository-wide development principles.
- Read `docs/development/testing.md` before selecting validation commands.
- Read `docs/development/github-cli.md` when using GitHub CLI.
- Read `docs/development/i18n.md` before changing translation generation.
- Read `docs/development/releasing.md` before updating versions or creating a release tag.
- Read `docs/plans/AGENTS.md` before creating or changing implementation plans under `docs/plans/`.
- Use `docs/plans/TEMPLATE.md` only when a formal v1 change requires a multi-step implementation plan or an important implementation decision.
- Keep only active formal v1 implementation plans under `docs/plans/`. Do not recreate `docs/plans/archive/`; historical Prototype plans are available from `prototype-final`.
- Create requirements, design, and architecture documents from accepted formal v1 decisions rather than copying Prototype documents forward.
- Simple fixes and documentation-only changes do not require a plan.

## Working rules

- Make the smallest change that fully satisfies the current issue.
- Keep documentation aligned with the code, commands, dependencies, and directories that exist on the current branch.
- Do not add placeholder directories or describe unimplemented systems as available.
- Add source structure and dependencies only when a concrete formal v1 responsibility requires them.
- Do not commit generated dependencies or build output such as `node_modules/`, `vendor/`, or `build/`.
- Do not commit secrets, credentials, personal paths, machine names, or other local-only environment details.
- Preserve released identifiers and saved content unless the issue explicitly includes a compatibility decision.

## GitHub Actions

- Keep existing CI, security, and release workflows limited to their intended purpose. Do not reuse them for unrelated ad-hoc work.
- Do not change workflow permissions, triggers, or jobs solely to run temporary processing.
- Remove temporary workflows before merge unless there is a clear reason to keep them permanently.
- When `.github/workflows/` changes, review the final diff and confirm that no obsolete Prototype fixtures or assumptions remain.

## Documentation responsibilities

- Put direct working instructions in `AGENTS.md` files.
- Put durable repository-wide development principles and rationale in `docs/development/`.
- Put user/product requirements in `docs/requirements/` and follow its `AGENTS.md`.
- Put user-visible design behavior in `docs/design/` and follow its `AGENTS.md`.
- Put internal responsibilities, boundaries, state ownership, contracts, dependencies, lifecycle, and invariants in `docs/architecture/` and follow its `AGENTS.md`.
- Put implementation direction, sequencing, implementation dependencies, validation strategy, and Issue breakdown in `docs/plans/` and follow its `AGENTS.md`.
- Update the relevant documentation when a command, directory boundary, dependency, or development rule changes.
- Avoid repeating detailed command lists across documents. Use `docs/development/testing.md` as the source of truth for validation commands.

## Validation

- Run only the checks applicable to the changed files, as described in `docs/development/testing.md`.
- Documentation-only changes do not require application builds or linters unless code or configuration also changes.
- Never report a command as successful unless it actually ran successfully.
- If validation is intentionally left to the user, state that it was not run.

## External tool boundaries

- Distinguish failures caused by repository code or configuration from limitations, defects, or compatibility differences in external tools such as Docker, act, Dev Containers, package registries, or connectors.
- When the available evidence reasonably places the root cause outside the repository, report the evidence and impact instead of changing product code merely to accommodate the external limitation.
- Treat GitHub-hosted GitHub Actions runs as the authoritative CI result. Use act only as optional local feedback.
- Follow the `YamabikoLab/wp-dev` documentation for commands that operate the local WordPress development environment.

## Efficient workflow

- Inspect only the files, documentation, and history required for the requested task.
- Do not inspect generated, cache, build, distribution, or test-output directories unless the task requires them.
- Before reading large diffs, logs, or file listings, inspect a summary or matching-file list and expand only the relevant section.
- Prefer the narrowest relevant validation while iterating. Run complete quality gates only when required by the applicable development documentation or before final handoff.
- Do not re-read unchanged files or repeat successful commands unless new evidence makes it necessary.
- Do not broaden the requested scope unless doing so is necessary to complete the requested outcome.

## Command output

- Use `logcut` only inside the Dev Container.
- Use it only for finite, non-interactive commands where concise successful output is sufficient.
- Use `logcut` for supported Docker build commands and Git transfer commands such as `git push`, `git pull`, and `git fetch` when appropriate.
- Never use `logcut` for commands containing tokens, passwords, Authorization headers, signed URLs, private keys, or other secrets.
- Do not use `logcut` for Git information commands such as `git status`, `git log`, `git diff`, and `git show`, or for interactive, watch, follow, or long-running commands.
- When `logcut` preserves a failure log, inspect the summary first and then only the relevant section of the full log.
