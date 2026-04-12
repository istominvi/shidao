# Lesson three-part model

## Canonical lesson structure

Each ShiDao lesson has 3 canonical parts:

1. **Teacher scenario** (methodology-facing pedagogical flow).
2. **Student lesson content** (shared learner-facing projection for student + parent).
3. **Homework** (methodology source + scheduled runtime assignment/submission/review).

## Source layer

- `methodology_lesson_block*` stores teacher scenario source.
- `methodology_lesson_student_content` stores learner-facing source payload (one row per methodology lesson).
- `methodology_lesson_homework` stores canonical homework source.

## Runtime layer

- `scheduled_lesson` is runtime execution shell.
- Teacher workspace `/lessons/[scheduledLessonId]` surfaces all 3 parts via tabs:
  - `Сценарий урока`
  - `Контент для ученика`
  - `Домашнее задание`
- Learner lesson rooms:
  - student: `/lesson-room/[scheduledLessonId]`
  - parent: `/children/[studentId]/lesson-room/[scheduledLessonId]`

## Explicitly deferred

- lesson/student-content authoring CMS,
- rich slide/presentation editor,
- multiple student-content templates per single lesson,
- heavy media-pipeline tooling,
- teacher-authored homework creation in runtime.
