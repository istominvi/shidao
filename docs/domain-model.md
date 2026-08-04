# ShiDao V2 domain model

## Active product hierarchy

```text
Account
└── Course
    ├── CourseAttachment → StoredFile → private Storage object
    └── Lesson 1..N
        └── LessonComponent 1..N
```

- `Account` is the ownership identity linked one-to-one to `auth.users`.
- `Course` is an editable owner-scoped draft.
- `Lesson` is an ordered Course document with a required title and an optional
  teacher comment (`summary`).
- `LessonComponent` belongs directly to Lesson and has one dense position,
  registry type/version, payload, placement, and visibility.
- `CourseAttachment` links a Course to `StoredFile`; the object itself is kept
  in the existing private `course-assets` bucket.

There is no active Methodology, Lesson Step/root Step, scheduled-lesson runtime,
fixture fallback, or per-lesson hardcoded renderer.

## Authoring projections

- **План урока** returns all Lesson components in `position` order.
- **Экран ученика** returns only `learner_visible` components while preserving
  relative order.
- **Домашнее задание** is a separate Lesson surface and is not represented by a
  component group. Persisted homework is a later slice.
- **Материалы курса** is a Course-level library, not a Lesson tab.

The canonical details and invariants live in
`docs/architecture/lesson-workflow-model.md`.

## Component registry

The first code-first registry contains:

```text
heading
rich_text
callout
quote
divider
image
slideshow
single_choice_poll
matching_game
file
```

UI, application service and development MCP use the same Zod contracts. MCP
JSON Schema is generated from those contracts.

## Retained compatibility identity tables

The first forward migration deliberately does not reset `public` and does not
change Auth. Existing `parent`, `teacher`, `student`, `school`, membership and
preference/security tables remain temporarily for login/onboarding/session
compatibility, but they are not parents of Course content.

The authoritative physical schema is documented in
`docs/database/current-schema.md` and `supabase/schema/current-schema.sql`.
