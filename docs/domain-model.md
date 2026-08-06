# ShiDao V2 domain model

**Статус:** current implemented domain
**Актуально на:** 7 августа 2026 года

## Active product hierarchy

```text
Account
├── LearnerProfile 0..N
└── Course 0..N
    ├── CourseLearner 0..N → LearnerProfile
    ├── CourseAttachment → StoredFile → private Storage object
    └── Lesson 1..N
        ├── LessonComponent 1..N
        ├── StudentScreenSlide 1..N → component assignments
        └── LessonRun 0..N
            └── LearningRecord 0..N → LearnerProfile
```

- `Account` is the ownership identity linked one-to-one to `auth.users`.
- `Course` is an editable owner-scoped draft.
- `LearnerProfile` is a neutral Account-owned learning identity. It does not
  reuse transitional `student`, `class` or `class_student`.
- `CourseLearner` is the direct Course audience. Group, Guardian and invitation
  flows are not required for the current scheduling slice.
- `Lesson` is an ordered Course document with a required title and an optional
  teacher comment (`summary`); the supported service path keeps its position
  dense. It is also the entity that can be scheduled repeatedly; there is no
  second runtime or methodological Lesson with copied content.
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
- `LessonRun` is one concrete appointment/conducting attempt of the same
  Lesson. One open row acts as the editable appointment; completed/cancelled
  rows form history. Its UI state is derived from `scheduled_at`, `started_at`,
  `ended_at` and `cancelled_at`; no `status` column exists.
- `LearningRecord` is the expected learner row while `occurred_at IS NULL` and
  the durable individual result after completion. It stores attendance,
  repeat recommendation, teacher comment and only small title/subject context,
  not a Lesson content snapshot.
- An open or completed Run has at least one LearningRecord. Cancellation
  deletes its drafts, so a retained cancelled Run legitimately has zero.

There is no active Methodology, Lesson Step/root Step, parallel scheduled-lesson
content model, `lesson_run_participant`, Lesson snapshot, fixture fallback, or
per-lesson hardcoded renderer.

Deleting a Lesson removes its Components, Slides and Runs. Draft
`LearningRecord` rows are removed; finalized rows remain attached to their
LearnerProfile with `lesson_run_id` and `source_lesson_id` cleared. The compact
`course_title_at_time`, `lesson_title_at_time` and `subject_at_time` fields keep
the result understandable without retaining Lesson payload.

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

Lesson planning and the read-only assistant now also receive a bounded
projection of completed Runs and finalized LearningRecords. Absence is marked
as absence, not interpreted as lack of understanding. Metrics beyond
attendance/repeat/comments remain a later additive extension.

Registry definitions own keys/schemas/defaults/capabilities. The current
payload editor is one switch over `ComponentTypeKey`; renderers use an
exhaustive typed map. Neither React implementation is embedded in the current
registry object.

## Current physical naming

- Product «Материалы курса» → `stored_file` + `course_attachment`.
- Product «Слайд экрана ученика» → `lesson_student_slide`.
- Component assignment → `lesson_component.student_slide_id`.
- Product «Проведение урока» → `lesson_run`.
- Product «Индивидуальная учебная запись» → `learning_record`.
- Course audience → `course_learner` → `learner_profile`.
- There is no physical/canonical entity named `course_asset`. The current
  TypeScript read-model alias `CourseAsset` represents a linked `StoredFile`
  returned inside Course attachments; it is not a separate persisted object.

## Retained compatibility identity tables

Forward migrations deliberately do not reset `public` and do not change Auth.
Existing `parent`, `teacher`, `student`, `school`, membership and
preference/security tables remain temporarily for login/onboarding/session
compatibility, but they are not parents of Course content or the source of the
new Course audience.

The authoritative physical schema is documented in
`docs/database/current-schema.md` and `supabase/schema/current-schema.sql`.

## Planned, not implemented

The following are target domains, not current tables or product capabilities:

- persisted Homework;
- Guardian, Group and invitation/claim flows around the implemented neutral
  LearnerProfile;
- live Student Screen synchronization/runtime cursor for an open LessonRun;
- automatic subject metrics and richer progress models on top of finalized
  LearningRecord;
- persistent AI quotas/usage ledger and AI change sets/undo;
- parsing/RAG sources;
- reusable cross-Course material/template library;
- chat/notifications and external MCP.

Sequencing lives in `docs/roadmap.md`. Future domains must not add Step/root
Step or make old School/Class/Methodology a parent of Course content.
