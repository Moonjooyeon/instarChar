# Documentation Guidelines

Document management conventions for the project.

---

## Directory Structure

```
documents/
├── references/
│   ├── README.md           # Index of all reference documents
│   ├── guidelines/         # Coding conventions (common + project-specific)
│   ├── plans/              # Service and feature plans
│   └── specs/              # Technical specs, architecture, DB design
└── app_tech_stacks.md      # Static tech stack reference
```

- `references/README.md` is the single entry point for all reference documents — keep it up to date when adding or removing files.
- Place new documents in the most specific matching subdirectory. Do not dump files directly under `documents/`.

---

## Language

- Documents under `documents/references/` must be written in **English**.
- Documents under all other folders (e.g., `documents/plan/`, `documents/spec/`) must be written in **Korean**.

---

## File Naming

- Format: `<prefix>_<topic>.md` in kebab-case (e.g., `report_performance-audit.md`)
- Guideline files follow a separate convention — see [Guideline Files](#guideline-files) below.

### Document Prefixes

| Prefix | Use |
|--------|-----|
| `report_` | Analysis reports, status reports, incident reports |
| `plan_` | Work plans, project plans, implementation plans |
| `proposal_` | Feature proposals, technical proposals |
| `guide_` | How-to guides, setup guides |
| `spec_` | Technical specifications, requirements specifications |
| `decision_` | Architecture decision records (ADRs) |
| `ref_` | Static reference material (tech stacks, glossaries, lookup tables) |

---

## Guideline Files

Guidelines live in `documents/references/guidelines/` and are split into two files per scope:

| File | Content |
|------|---------|
| `<name>.md` | Language / framework best practices — reusable in any project |

Always read **both** files for the relevant scope before starting work. When adding a new convention, decide which file it belongs to before writing it.

---

## Front Matter

Every document must start with:

```markdown
---
title:
author: black (black@ashwoodfriends.com)
created:
updated:
version:
status: draft | review | approved | deprecated
---
```

---

## Deprecation

When a document is no longer accurate:

1. Set `status: deprecated` in front matter.
2. Add a note at the top of the document pointing to the replacement (if one exists).
3. Keep the file in place — do not delete deprecated documents unless the content is entirely superseded and no references to it remain.

```markdown
> **Deprecated** — superseded by `spec_new-architecture.md`.
```

---

## Markdown Rules

- ATX-style headers (`#`) only — no Setext-style (`===`)
- Fenced code blocks with language identifiers
- Internal links: relative paths from the file's location
- Alt text on all images
- Tables for structured data, task lists for actionable items

### Internal Link Format

Use paths relative to the linking file:

```markdown
<!-- From documents/references/README.md linking to a guideline -->
[Express guidelines](guidelines/express.md)

<!-- From a guideline file linking to another guideline -->
[Project-specific conventions](express-project.md)
```

---

## Tech Stack Writing Rules

- Record all frontend/backend frameworks and libraries in `documents/references/tech-stacks/`.
- Each entry must include:
  - **Name**: package/library name
  - **Version**: exact or minimum version in use
  - **Purpose**: why it is used in this project
- When a new dependency is added during a task, append it with an **Added** date (ISO 8601, e.g., `2026-04-22`).

---

## Structure Writing Rules

### project.md
- Maximum directory depth: **3 levels**.
- Describe only top-level concerns: which apps exist under `apps/`, which shared packages are used, and what `scripts/`, `manifests/`, or other root folders are for.
- For each described folder, link to its `README.md` using a **relative path**.
- `project.md` serves as a table of contents; detailed explanations live in each folder's `README.md`.

### frontend.md / backend.md
- Maximum directory depth: **5 levels**.
- Purpose: help a reader understand the code structure of each app.
- Include a brief description of every sub-folder inside the app.
