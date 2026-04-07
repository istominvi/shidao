# Communication runtime model (Step 5)

**Date:** April 7, 2026  
**Status:** Implemented (MVP communication layer)

## Core decision

Communication is modeled as **two layers**:

1. **Continuous container**: one `group_student_conversation` per `class(group) + student`.
2. **Scoped projections**: each message can optionally reference:
   - `scheduled_lesson_id`,
   - `scheduled_lesson_homework_assignment_id`,
   - `topic_kind` (`general`, `lesson`, `homework`, `progress`, `organizational`).

This avoids both extremes:
- not isolated per-lesson silos,
- not one undifferentiated global chat.

## Storage

- `group_student_conversation`
  - unique by `(class_id, student_id)`.
- `group_student_message`
  - belongs to a conversation,
  - has sender role (`teacher` / `student` / `parent`),
  - keeps plain text body,
  - stores optional lesson/homework context references.

## Runtime behavior

- Conversation is created lazily (`ensureConversationByClassAndStudentAdmin`) when first requested/message sent.
- Full stream is available in teacher route:
  - `/groups/[groupId]/students/[studentId]/communication`.
- Lesson page `/lessons/[scheduledLessonId]` renders **lesson-scoped** and **homework-scoped** slices from the same container.
- Student dashboard can reply in:
  - homework-scoped context,
  - general class conversation context.
- Parent dashboard shows read-only recent messages for each child.

## Access constraints

- Teacher: only assigned group/class scope.
- Student: only own class membership scope.
- Parent: read-only projection for linked children.
- No cross-group and no cross-student mixing in projections.

## Deferred in this step

- attachments/files,
- voice messages,
- notifications,
- advanced unread state,
- attendance coupling,
- parent write participation.
