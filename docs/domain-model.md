# ShiDao V2 domain model

**Статус:** current implemented domain
**Актуально на:** 7 августа 2026 года

## Active product hierarchy

```text
Account
├── claimed identity → LearnerProfile 0..1 (nullable account_id)
├── TeacherLearner 0..N → LearnerProfile
├── LearnerGroup 0..N
│   └── LearnerGroupMember 0..N → LearnerProfile
└── Course 0..N
    ├── direct audience → CourseLearner 0..N → LearnerProfile
    ├── group audience → CourseLearnerGroup 0..N → LearnerGroup
    ├── effective audience = unique(active direct learners ∪ group members)
    ├── CourseAttachment → StoredFile → private Storage object
    └── Lesson 1..N
        ├── LessonComponent 1..N
        ├── StudentScreenSlide 1..N → component assignments
        └── LessonRun 0..N
            └── LearningRecord 0..N → LearnerProfile
                └── recorded_by_account_id → Account
```

- `Account` is the ownership identity linked one-to-one to `auth.users`.
- `Course` is an editable owner-scoped draft.
- `LearnerProfile` is the canonical learning identity and is not owned by a
  teacher. Its nullable unique `account_id` is a future claim point; current
  creation/backfill leaves it unlinked. The global `display_name` is a
  canonical/offline fallback, not the teacher's editable directory label.
- `TeacherLearner` links an Account acting as teacher to a LearnerProfile. It
  owns that teacher's local `display_name` and `archived_at`. Product delete
  archives this relation, removes only that teacher's future group/Course links
  and keeps the canonical profile, finalized LearningRecords and already
  scheduled Run membership.
- `LearnerGroup` is a reusable Account-owned set of existing LearnerProfiles.
  A profile may belong to zero, one or several groups; deleting a group deletes
  only its membership and Course links. Membership and direct Course audience
  require an active TeacherLearner relation for the same Account.
- Course audience persists two independent source sets: direct
  `CourseLearner` links and `CourseLearnerGroup` links. Its effective audience
  is their active, deduplicated learner union. Source order is deliberately not
  persisted because audience is a set, not a lesson sequence.
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
  not a Lesson content snapshot. `recorded_by_account_id` permanently records
  which Account created the observation; current teacher history and AI reads
  are filtered by that provenance.
- An open or completed Run has at least one LearningRecord. Cancellation
  deletes its drafts, so a retained cancelled Run legitimately has zero.
- Scheduling resolves the current effective Course audience only for a new
  Run. Its draft LearningRecords freeze the concrete learners, so later group
  edits affect future appointments but never rewrite an existing one.

There is no active Methodology, Lesson Step/root Step, parallel scheduled-lesson
content model, `lesson_run_participant`, Lesson snapshot, fixture fallback, or
per-lesson hardcoded renderer.

Deleting a Lesson removes its Components, Slides and Runs. Draft
`LearningRecord` rows are removed; finalized rows remain attached to their
LearnerProfile with `lesson_run_id` and `source_lesson_id` cleared. The compact
`course_title_at_time`, `lesson_title_at_time` and `subject_at_time` fields keep
the result understandable without retaining Lesson payload, while
`recorded_by_account_id` keeps its author explicit.

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
projection of completed Course Runs, the selected groups/direct learners and
finalized LearningRecords recorded by the current teacher for the effective
learners across that teacher's courses. Names come from TeacherLearner, overlap
between audience sources is deduplicated, and another teacher's observations
are not included merely because the canonical LearnerProfile is the same.
Absence is marked as absence, not interpreted as lack of understanding. Metrics
beyond attendance/repeat/comments remain a later additive extension.

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
- Canonical learner identity → `learner_profile`; teacher-local directory
  context → `teacher_learner`.
- Learner directory groups → `learner_group` + `learner_group_member`.
- Course audience sources → `course_learner` + `course_learner_group`;
  effective learners are a query projection, not another table.
- There is no physical/canonical entity named `course_asset`. The current
  TypeScript read-model alias `CourseAsset` represents a linked `StoredFile`
  returned inside Course attachments; it is not a separate persisted object.

## Retained compatibility identity tables

Forward migrations deliberately do not reset `public` and do not change Auth.
Existing `parent`, `teacher`, `student`, `school`, membership and
preference/security tables remain temporarily for login/onboarding/session
compatibility, but they are not parents of Course content or the source of the
new Course audience.

The canonical identity/access contract is documented in
`docs/architecture/learner-identity-access-model.md`. The authoritative physical
schema is documented in `docs/database/current-schema.md` and
`supabase/schema/current-schema.sql`.

## Planned, not implemented

The following are target domains, not current tables or product capabilities:

- persisted Homework;
- Guardian/observer and invitation/claim flows around the implemented canonical
  LearnerProfile;
- merge of duplicate offline profiles and cross-provider access to records;
- live Student Screen synchronization/runtime cursor for an open LessonRun;
- automatic subject metrics and richer progress models on top of finalized
  LearningRecord;
- persistent AI quotas/usage ledger and AI change sets/undo;
- parsing/RAG sources;
- reusable cross-Course material/template library;
- chat/notifications and external MCP.

Sequencing lives in `docs/roadmap.md`. Future domains must not add Step/root
Step or make old School/Class/Methodology a parent of Course content.
