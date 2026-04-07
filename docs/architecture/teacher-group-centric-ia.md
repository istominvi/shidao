# Teacher IA: group-centric operational model (Step 1 + Step 2)

**Status:** Implemented Step 1 (IA alignment) + Step 2 (operations dashboard)  
**Date:** April 7, 2026

## Purpose

This document formalizes the first two restructuring steps for teacher-side UX:

- `group/class` becomes the primary operational context for teachers;
- lesson-content architecture remains intact;
- `/dashboard` becomes a real day-to-day teacher operations screen.

## Canonical content/runtime model (unchanged)

The following architectural decisions remain unchanged:

- **Methodology** is the pedagogical source of truth for lesson content.
- **Methodology lesson** remains separate from **scheduled lesson**.
- **Scheduled lesson** remains the runtime execution unit for a concrete class+time.
- Teacher lesson workspace `/lessons/[scheduledLessonId]` remains the concrete lesson execution screen.
- No methodology editor, no block editor, no block overrides, no AI/no-code layer in these steps.

## IA shift: primary vs secondary teacher surfaces

### Primary surfaces

1. `/dashboard` — teacher command center (actions + groups table + weekly schedule + alerts).
2. `/groups` — full index of teacher-accessible groups/classes.
3. `/groups/[groupId]` — teacher group workspace/overview.

### Secondary surface

4. `/lessons` — global cross-group lessons/schedule index.

### Stable execution surface

5. `/lessons/[scheduledLessonId]` — existing teacher lesson workspace (runtime execution).

## Step 1 (IA alignment)

Implemented in Step 1:

- route/navigation alignment (`/dashboard`, `/groups`, `/groups/[groupId]`, `/lessons`);
- teacher navigation moved toward group context;
- server-first read-model direction set.

## Step 2 (operations dashboard)

Implemented in Step 2:

- `/dashboard` rebuilt as teacher operations dashboard with visible quick actions:
  - add group,
  - add student,
  - open groups,
  - open lessons;
- `My groups` rendered as table-first operational section (search + filters + row actions);
- schedule block upgraded to weekly agenda across teacher groups;
- compact attention summary added for operational risks;
- `/groups` upgraded to full structured index using compatible operational read model;
- minimal real creation entry points added:
  - `/groups/new` (creates class and links it to teacher),
  - `/students/new` (creates student auth/profile and attaches to class).

## Pragmatic read-model heuristics (explicit)

Because class↔methodology direct assignment is not yet explicit in the current schema,
Step 2 uses grounded derivations:

- **Methodology label per group**: from nearest upcoming scheduled lesson for that group;
  fallback to last known scheduled lesson.
- **Progress**: `completed scheduled lessons / total lessons in derived methodology catalog`.
  If methodology cannot be derived, progress is shown as `N проведено` (without fake denominator).
- **Needs attention**: derived from transparent checks:
  - no students,
  - no derived methodology,
  - no upcoming lesson.

## Intentionally deferred (unchanged)

- homework implementation;
- thread/communication implementation;
- attendance implementation;
- full calendar subsystem;
- methodology editor / block editor;
- AI features.
