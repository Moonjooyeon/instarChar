---
title: Entry Flow UI/UX Improvement Plan
author: Codex
created: 2026-08-05
updated: 2026-08-05
version: 1.1.0
status: implemented
---

# Entry Flow UI/UX Improvement Plan

## Scope

- Login
- Home without a character
- Home with characters
- Three-step character creation and final confirmation
- First character feed
- First DM and character discovery

## Design Direction

The entry flow uses “a story continuing over time” as its product-specific visual language. Hairlines, numbered sequences, editorial spacing, and precise microcopy replace generic promotional cards. Purple remains an accent for progress and primary actions instead of becoming the entire surface.

The product reveals depth only after the first successful outcome. A new user enters one required character line, may skip personality and voice, reviews a short AI summary, and then receives a first post. Memory, relationships, publishing, character-to-character DM, and persona controls remain available as later choices instead of competing with that first outcome.

## Success Criteria

- Login explains what returns after authentication without competing calls to action.
- The empty state shows how one character setting becomes a feed and a relationship.
- The character list distinguishes identity, description, progress, and management actions.
- Character creation contains exactly three labeled input stages.
- The parsed-profile screen reads as a final review, not a fourth creation stage.
- The first feed presents one dominant action before revealing profile management.
- Direct DM uses ordinary language and does not require role or world choices.
- Discovery explains the consequence of adding a character before the action.
- Domain tests and the production build pass; existing controller type errors are recorded separately.
