# Teacher IA: group-centric operational model (Step 1)

**Status:** Implemented Step 1 (IA alignment)  
**Date:** April 7, 2026

## Purpose

This document formalizes the first restructuring step for teacher-side UX:

- `group/class` becomes the primary operational context for teachers;
- lesson-content architecture remains intact;
- dashboard and top-level navigation align with this center of gravity.

This is an IA/read-model/routing alignment step, **not** the full implementation of future scheduling/homework/communication flows.

## Canonical content/runtime model (unchanged)

The following architectural decisions remain unchanged:

- **Methodology** is the pedagogical source of truth for lesson content.
- **Methodology lesson** remains separate from **scheduled lesson**.
- **Scheduled lesson** remains the runtime execution unit for a concrete class+time.
- Teacher lesson workspace `/lessons/[scheduledLessonId]` remains the concrete lesson execution screen.
- No methodology editor, no block editor, no block overrides, no AI/no-code layer in this step.

## IA shift: primary vs secondary teacher surfaces

### Primary surfaces

1. `/dashboard` — teacher overview with groups + upcoming lessons.
2. `/groups` — index of teacher-accessible groups/classes.
3. `/groups/[groupId]` — teacher group workspace/overview.

### Secondary surface

4. `/lessons` — global cross-group lessons/schedule index.

### Stable execution surface

5. `/lessons/[scheduledLessonId]` — existing teacher lesson workspace (runtime execution).

## Why groups are the operational center

Teacher work is naturally group-scoped:

- students belong to groups;
- scheduling is tied to a group/class;
- methodology assignment and delivery context are meaningful at group level;
- future progress/homework/communication contexts are also group-scoped.

Therefore, teacher navigation should begin with group visibility and group entry points, while keeping global lessons list as a secondary cross-group index.

## Step 1 implementation boundaries

Implemented in this step:

- route/navigation alignment (`/dashboard`, `/groups`, `/groups/[groupId]`, `/lessons`);
- teacher dashboard reframed as operational overview;
- teacher group index and initial group overview pages;
- server-first read-models for group-centric pages and dashboard;
- lessons hub copy reframed as global index.

Intentionally deferred:

- full group-contextual scheduling UX (e.g. schedule directly from group methodology context);
- homework implementation;
- thread/communication implementation;
- attendance/progress implementation (placeholders only);
- parent/student projections for new group-derived contexts.

## Follow-up stages (high level)

1. **Contextual scheduling**
   - schedule from group page and/or methodology-first group context,
   - reduce reliance on global form-first scheduling.

2. **Group outcomes and continuity**
   - progress snapshots,
   - homework workflows,
   - structured communication threads.

3. **Richer projections**
   - parent/student-facing derived projections from teacher/group/scheduled-lesson runtime data.
