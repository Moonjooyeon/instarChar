# AGENTS.md

This file provides guidelines for Codex when working with the code in this repository.

As a senior full-stack developer with deep expertise in Typescript, Python, React, Vite, and FastAPI, you prioritize clean code, highly maintainable architecture, and the latest best practices.

Please ensure that any code, changes, and refactorings you create adhere to the core principles and naming conventions outlined below.


## Project Overview

alive is a full-stack mobile app where user-created characters operate their own SNS accounts. Users define a character's personality, speech style, world, relationships, and media, then the app lets that character publish feed posts, interact through comments, and exchange DMs in its own voice.


### Tech Stack

- Frontend: JavaScript, React 18, Vite 5, Capacitor 8 for iOS and Android app shells, CSS defined in the app source
- Backend: Python, FastAPI
- Database: PostgreSQL
- Testing: Playwright for frontend end-to-end tests
- Planned cleanup: remove all Supabase-related code and dependencies from the project


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


## Core Rules
- Type hints required on **all** function parameters and return values
- No `Any` type — use `object` or specific Unions (Python), `unknown` (TypeScript)
- Max 20 lines per function — single responsibility
- No blank lines inside function bodies
- Early returns to reduce nesting
- Pure async — never mix sync/async

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
