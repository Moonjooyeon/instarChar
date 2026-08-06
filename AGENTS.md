# AGENTS.md

This file provides guidelines for Codex when working with the code in this repository.

As a senior full-stack developer with deep expertise in Typescript, Python, React, Vite, and FastAPI, you prioritize clean code, highly maintainable architecture, and the latest best practices.

Please ensure that any code, changes, and refactorings you create adhere to the core principles and naming conventions outlined below.


## Project Overview

alive is a full-stack mobile app where user-created characters operate their own SNS accounts. Users define a character's personality, speech style, world, relationships, and media, then the app lets that character publish feed posts, interact through comments, and exchange DMs in its own voice.


### Tech Stack

- Frontend: TypeScript, React 18, Vite 5, Capacitor 8 for iOS and Android app shells, CSS defined in the app source
- Backend: Python, FastAPI
- Database: PostgreSQL
- Testing: Playwright for frontend end-to-end tests
- Legacy `supabase-schema.sql` is reference-only; the active runtime uses backend-owned OAuth, FastAPI, and PostgreSQL. Do not remove legacy references unless the task asks for it.


## Process Rules

### Work Artifacts Storage
- All work artifacts generated during tasks — including plan mode plans, mockups, and similar files — must be saved in the `documents` folder.
- Do NOT save to the `references` folder unless explicitly instructed.

### Process Execution Prohibition
- Do NOT start frontend or backend app processes directly.
- Always review and verify changes within already-running processes.
- If a change cannot be verified in a running process, provide the user with a step-by-step review guide instead of starting a new process.


## References
- Refer to the `documents/references/README.md` file.

### Structures
- Please refer to the **Structure** section in the `documents/references/README.md`.

### Guidelines
- Please refer to the **Guidelines** section in the `documents/references/README.md`.


## Behavioral Guidelines

### Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## ALIVE Workflow Skill

For ALIVE project analysis, planning, implementation, review, testing, or release-readiness work, use `.agents/skills/alive-engineering-workflow/SKILL.md`. Load only the reference matching the current task mode.


## Core Rules
- Type hints required on **all** function parameters and return values
- No `Any` type — use `object` or specific Unions (Python), `unknown` (TypeScript)
- Max 20 lines per function — single responsibility
- No blank lines inside function bodies
- Early returns to reduce nesting
- Pure async — never mix sync/async

## Available Skill Routing

Use only skills that exist in this workspace or the active Codex environment. Do not invent slash commands.

Choose one primary route first. Add a second focused route only when the task genuinely crosses boundaries:

| User intent | Primary route | Follow-up route |
|---|---|---|
| Vague idea, requirements, or scope | `alive-discovery` | `alive-engineering-workflow` |
| Cross-layer plan, implementation, review, or release | `alive-engineering-workflow` | `alive-frontend-architecture`, `alive-ai-quality`, or `alive-qa` as needed |
| Frontend placement, component, state, overlay, or funnel | `alive-frontend-architecture` | `alive-qa` for behavior verification |
| Bug, regression, or unexpected failure | `alive-debugging` | `alive-engineering-workflow` after the cause is confirmed |
| Browser/user-flow/test evidence | `alive-qa` | `alive-debugging` when a failure needs diagnosis |
| Prompt/generation/character/safety/cost behavior | `alive-ai-quality` | `alive-qa` for cross-layer evidence |

- ALIVE project analysis, planning, implementation, review, or release -> `.agents/skills/alive-engineering-workflow/SKILL.md`
- ALIVE ambiguous product ideas, requirements, or scope -> `.agents/skills/alive-discovery/SKILL.md`
- ALIVE React/Vite structure, components, state, overlays, or UI architecture -> `.agents/skills/alive-frontend-architecture/SKILL.md`
- ALIVE debugging or regressions -> `.agents/skills/alive-debugging/SKILL.md`
- ALIVE browser/user-flow QA -> `.agents/skills/alive-qa/SKILL.md` plus the browser skill when an existing app process is available
- ALIVE AI behavior or prompt quality -> `.agents/skills/alive-ai-quality/SKILL.md`
- Codex skill creation or maintenance -> the available `skill-creator` skill

The engineering workflow coordinates project work; focused skills add domain rules only when their trigger matches. If no skill matches, follow this file and the project references directly.
