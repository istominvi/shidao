# Teacher IA: group-centric operational model (Step 1 + Step 2 + Step 3)

**Status:** Implemented Step 1 (IA alignment) + Step 2 (operations dashboard) + Step 3 (group setup/runtime container)  
**Date:** April 7, 2026

## Purpose

This document formalizes the first two restructuring steps for teacher-side UX:

- `group/class` becomes the primary operational context for teachers;
- lesson-content architecture remains intact;
- `/dashboard` becomes a real day-to-day teacher operations screen.
- `/groups/[groupId]` becomes a real teaching container with setup + roster + contextual scheduling.

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
5. `/methodologies` — methodologies index (read-only in current step).

### Stable execution surface

6. `/lessons/[scheduledLessonId]` — existing teacher lesson workspace (runtime execution).

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
  - open methodologies;
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

## Step 4 (homework layer bound to scheduled lesson)

Implemented in Step 4:

- homework moved from deferred scope into first real post-lesson loop;
- methodology remains canonical source for homework content;
- teacher cannot edit methodology homework content and cannot create freeform homework;
- `/lessons/[scheduledLessonId]` now includes homework runtime controls:
  - read-only methodology homework card,
  - issue homework (all students or selected students),
  - due date,
  - student-by-student submission/review tracking,
  - review status + teacher review note.

### Domain separation (enforced)

- `methodology_lesson_homework` = canonical pedagogical definition.
- `scheduled_lesson_homework_assignment` = issuance in scheduled-lesson runtime context.
- `student_homework_assignment` = per-student submission/review state.

This keeps methodology content immutable from teacher runtime screens while enabling operational homework workflows.

## Step 3 (group setup + methodology binding + contextual scheduling)

Implemented in Step 3:

- explicit `class.methodology_id` binding is now the primary methodology source for group/class;
- `/groups/[groupId]` includes real setup and operations:
  - assign/change methodology;
  - visible roster with contextual student creation CTA;
  - schedule lesson directly in group context without re-selecting class;
- group-scoped scheduling is guarded:
  - if no methodology assigned, scheduling form is blocked by setup CTA;
  - methodology lesson options are limited to the assigned methodology only;
- progress semantics are explicit and honest:
  - numerator = completed scheduled lessons for the group (`runtime_status = completed`);
  - denominator = total methodology lessons in assigned methodology;
  - planned/in_progress/cancelled lessons do not count as completed;
- dashboard and `/groups` now rely on explicit assignment rather than scheduled-lesson inference.

### Backfill policy

Migration introduces safe backfill for existing groups:

- if all existing scheduled lessons of a class point to one methodology, class gets that methodology assigned;
- if methodology cannot be inferred unambiguously, assignment stays `null` and UI shows setup-needed state.


## Step 5 (communication layer with group-level continuity)

Implemented in Step 5:

- Introduced continuous communication container per `group(class) + student`.
- Added teacher full-thread surface:
  - `/groups/[groupId]/students/[studentId]/communication`.
- Lesson workspace `/lessons/[scheduledLessonId]` now includes lesson/homework-scoped discussion projections from the same underlying conversation.
- Student dashboard can reply in the same communication model (general + homework-scoped).
- Parent dashboard receives read-only communication projection for linked children.

### Why this model

- Better than isolated per-lesson threads: preserves continuity across lessons.
- Better than one global chat: keeps communication grounded in class/student runtime context.
