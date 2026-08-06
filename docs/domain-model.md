# ShiDao V2 domain model

**Статус:** current implemented domain
**Актуально на:** 6 августа 2026 года

## Active product hierarchy

```text
Account
└── Course
    ├── CourseAttachment → StoredFile → private Storage object
    └── Lesson 1..N
        ├── LessonComponent 1..N
        └── StudentScreenSlide 1..N → component assignments
```

- `Account` is the ownership identity linked one-to-one to `auth.users`.
- `Course` is an editable owner-scoped draft.
- `Lesson` is an ordered Course document with a required title and an optional
  teacher comment (`summary`); the supported service path keeps its position
  dense.
- `LessonComponent` belongs directly to Lesson; the supported service/RPC path
  keeps one dense position plus registry type/version, payload, placement,
  visibility, and an optional
  Student Screen Slide assignment. Physically these are
  `lesson_component.placement_config` and `student_slide_id`; API/domain names
  are `placement` and `studentSlideId`.
- `StudentScreenSlide` is an ordered presentation grouping. It has no payload,
  title, instructions, or independent component order and is not a Lesson Step.
- `CourseAttachment` links a Course to `StoredFile`; the object itself is kept
  in the existing private `course-assets` bucket.

There is no active Methodology, Lesson Step/root Step, scheduled-lesson runtime,
fixture fallback, or per-lesson hardcoded renderer.

The database itself currently enforces positive+unique Lesson/Component
positions, not gaplessness after arbitrary direct INSERT. Append serialization
under concurrency is a documented next integrity hardening task.

## Authoring projections

- **План урока** returns all Lesson components in `position` order.
- **Экран ученика** returns only explicitly assigned components, grouped into
  ordered Slides while preserving the one canonical component order. New
  components are teacher-only until explicitly assigned.
- **Домашнее задание** is a separate Lesson surface and is not represented by a
  component group. Persisted homework is a later slice.
- **Материалы курса** is a Course-scoped attachment collection, not a global
  reusable library. Lesson-вкладка «Материалы» показывает read-only проекцию
  этой же коллекции и не вводит lesson-owned attachment relation.

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

The current production RouterAI slice validates generated Lesson content
against a deliberately limited subset of these same registry contracts before
explicit Apply. Its provider-compatible flat transport schema is converted to a
canonical typed plan and then validated again by registry payload contracts and
`lessonAddComponentInputSchema`. It introduces no new domain entity, second
registry, or physical schema.

Operational acceptance release `0276aed` подтвердил default
`google/gemini-2.5-flash-lite` через provider и authenticated no-write smoke;
это не изменило domain model.

Registry definitions own keys/schemas/defaults/capabilities. The current
payload editor is one switch over `ComponentTypeKey`; renderers use an
exhaustive typed map. Neither React implementation is embedded in the current
registry object.

## Current physical naming

- Product «Материалы курса» → `stored_file` + `course_attachment`.
- Product «Слайд экрана ученика» → `lesson_student_slide`.
- Component assignment → `lesson_component.student_slide_id`.
- There is no physical/canonical entity named `course_asset`. The current
  TypeScript read-model alias `CourseAsset` represents a linked `StoredFile`
  returned inside Course attachments; it is not a separate persisted object.

## Retained compatibility identity tables

The first forward migration deliberately does not reset `public` and does not
change Auth. Existing `parent`, `teacher`, `student`, `school`, membership and
preference/security tables remain temporarily for login/onboarding/session
compatibility, but they are not parents of Course content.

The authoritative physical schema is documented in
`docs/database/current-schema.md` and `supabase/schema/current-schema.sql`.

## Planned, not implemented

The following are target domains, not current tables or product capabilities:

- persisted Homework;
- new neutral LearnerProfile/Guardian/Group audience model;
- LessonSession/live runtime;
- learning history/progress;
- persistent AI quotas/usage ledger and AI change sets/undo;
- parsing/RAG sources;
- reusable cross-Course material/template library;
- chat/notifications and external MCP.

Sequencing lives in `docs/roadmap.md`. Future domains must not add Step/root
Step or make old School/Class/Methodology a parent of Course content.
