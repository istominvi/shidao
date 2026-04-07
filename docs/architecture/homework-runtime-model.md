# Homework runtime model (Step 4)

**Date:** April 7, 2026  
**Status:** Implemented (MVP loop)

## Core rule

Homework content is **methodology-defined**. Teacher cannot edit canonical homework content.

Teacher can only:
- view methodology homework (read-only),
- issue it in scheduled lesson runtime,
- choose recipients (all / selected students),
- set due date,
- review submissions and set review state.

## Layering

1. `methodology_lesson_homework`
   - canonical homework baseline for a methodology lesson (0..1 for now).
2. `scheduled_lesson_homework_assignment`
   - runtime issuance bound to a concrete `scheduled_lesson`.
3. `student_homework_assignment`
   - per-student runtime state (assigned/submitted/reviewed/needs_revision), submission text, review note.

## Runtime flow

1. Teacher opens `/lessons/[scheduledLessonId]`.
2. Homework section shows methodology homework read-only.
3. Teacher issues homework to all or selected students with due date.
4. Student sees homework on dashboard and submits text response.
5. Teacher reviews student submission and marks `reviewed` or `needs_revision` with note.
6. Parent dashboard gets minimal projection (count/status visibility per child).

## Deferred intentionally

- teacher homework content editing or overrides,
- freeform homework authoring,
- heavy file uploads,
- communication threads,
- attendance,
- advanced parent/student UX polish.


## Communication cross-reference (Step 5)

Homework discussion is now a scoped view of the same group-student continuous communication container.
Homework does not own a separate isolated chat thread subsystem.
See `docs/architecture/communication-runtime-model.md`.
