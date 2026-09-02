# Requirements documentation instructions

These instructions apply to requirements documents under `docs/requirements/`.

## Purpose

- Describe what users, the product, quality, or the business must be able to achieve.
- Keep requirements focused on **What** and, when it helps explain the requirement, **Why**.
- Do not describe **How** a requirement will be realized. Leave that to design documentation.
- Keep requirements independent from a specific implementation approach.

## What / Why / How boundary

- **What** defines the capability, behavior, quality, or business outcome that must be satisfied.
- **Why** explains why that requirement exists or what user, product, quality, or business value it protects.
- **How** describes realization details such as interaction flow, internal responsibility, state management, APIs, events, data structures, DOM, source structure, or implementation technique. Keep **How** out of requirements documents.
- A requirement and its reason should be understandable together without consulting implementation or design details.

When writing **Why**:

- Explain the need, intent, or value behind the requirement rather than restating the requirement in different words.
- Keep the reason at the same user, product, quality, or business abstraction level as requirements.
- Do not add new behavior, constraints, supported scope, acceptance criteria, or quality guarantees that are not already part of the requirement.
- Do not use the reason to change, narrow, or broaden the meaning of the requirement.
- Do not duplicate Basic Design or Architecture decisions. If a reason depends on a specific realization choice, that content belongs in downstream design documentation instead.
- Write the reason so that downstream documents can reference the requirement ID and understand both the required outcome and its intent.

## Abstraction boundary

- Write from a user, product, quality, or business perspective.
- Leave concrete screen behavior, interaction flow, focus destination, and other realization details to design documents.
- Do not include source files, functions, variables, events, internal state, APIs, CSS, DOM structure, or test implementation details.
- Do not write statements that require reading source code to understand their meaning.

## Requirement IDs

Use requirement IDs to make individual requirements easy to reference from design, architecture, implementation, tests, Issues, and PRs.

Use the following prefixes unless another category is explicitly defined in this file.

| Prefix | Meaning | Use for |
| --- | --- | --- |
| `FR` | Functional Requirement | Capabilities or behavior that users or the product must be able to achieve. |
| `QR` | Quality Requirement | Qualities or constraints the product must satisfy, such as performance, reliability, compatibility, usability, or security. |

Examples:

- `FR-01`: A supported table row can be reordered.
- `QR-01`: YTR does not substantially increase the update cost of the supported table it reorders.

Do not introduce a new requirement prefix only to make a document look more structured. Add another prefix only when a distinct requirement category is actually needed, and define its meaning and intended use here before using it in requirements documents.

## Readability

- Use plain language understandable to non-technical readers, including management-level readers with no programming knowledge.
- Prefer outcomes and needs over implementation terminology.

## Examples

Good:

> What: First-time users must be able to clearly identify the entry point to row reordering.
>
> Why: So users can discover the capability without prior knowledge of the product.

Bad:

> Focus the row-reorder toolbar control when the first pointer event is handled.
