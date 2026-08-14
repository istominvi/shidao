# ShiDao V2 domain model

**Статус:** current implemented domain
**Актуально на:** 14 августа 2026 года

## Active product hierarchy

```text
Account
├── canonical avatar exactly 1 → preset key XOR custom Storage object
├── own identity → LearnerProfile exactly 1
├── TeacherLearner 0..N → LearnerProfile
├── LearnerGroup 0..N
│   └── LearnerGroupMember 0..N → LearnerProfile
├── Course 0..N [learning_audience = children | educators]
│   ├── children-only direct audience → CourseLearner 0..N → LearnerProfile
│   ├── children-only group audience → CourseLearnerGroup 0..N → LearnerGroup
│   ├── children-only effective audience = unique(direct ∪ group members)
│   ├── CourseAttachment → StoredFile → private Storage object
│   ├── educator-only CourseAttestation → authored assessment definition
│   └── Lesson 1..N
│       ├── LessonComponent 1..N
│       ├── StudentScreenSlide 1..N → component assignments
│       └── children-only LessonRun 0..N
│           └── LearningRecord 0..N → LearnerProfile
│               └── recorded_by_account_id → Account
├── CoursePublication 0..N
│   ├── current_revision_id → latest submitted immutable revision
│   ├── approved_revision_id → approved immutable revision visible in catalog
│   └── CoursePublicationRevision 1..N → immutable snapshot
│       ├── EducatorCourseRevisionReview → pending | approved | rejected
│       ├── CoursePublicationAsset 0..N → private immutable object
│       └── CoursePublicationAttestation 0..1 → closed assessment snapshot
└── educator self-learning on exact approved revision
    ├── CoursePublicationSelfEnrollment 0..N
    ├── CoursePublicationLessonCompletion 0..N
    ├── CourseAttestationAttempt 0..N
    └── CourseAttestationAward 0..N

CoursePublicationRevision ← CoursePublicationOrigin ← independent child Course copy
```

- `Account` is the ownership identity linked one-to-one to `auth.users`.
- `Account` owns exactly one mandatory canonical avatar state, independently
  of Auth metadata and LearnerProfile. A preset state contains one of 20
  allowlisted keys and no Storage path; a custom state contains one immutable
  Account-scoped WebP path in the private `profile-avatars` bucket and no
  preset key. Existing and new Accounts always receive a preset fallback, so
  the supported UI can replace an avatar but cannot leave it empty; revision
  matching protects concurrent replacements.
- `Course` is an editable owner-scoped draft. Product `DELETE` is currently a
  recoverable soft archive through `course.archived_at`: active list/get hide
  the row, while authored children, attachments, LessonRuns and
  LearningRecords remain physical. Published Course must be explicitly
  unpublished first, and a Course with an open LessonRun cannot be archived.
  The user-JWT `archive_course` RPC checks active ownership and both blockers
  together with setting `archived_at` in one database transaction; reverse
  guards serialize archive, publish and open Run on the same Course row. This
  database contract and the dependent API/UI are current production after PR
  #242 rollout at exact commit
  `84ffefecda99d3b0a9da82bf1eaf8ce76d9c6ea1`. Permanent deletion and archive
  restore UI are not current behavior.
- `LearnerProfile` is the canonical learning identity and is not owned by a
  teacher. Every Account has exactly one linked profile; teacher-created
  offline profiles keep nullable `account_id` until recipient-bound claim or
  child activation. The global `display_name` is a canonical/offline fallback,
  not the teacher's editable directory label.
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
- `CoursePublication` is a stable catalog listing for one working Course.
  `CoursePublicationRevision` is its immutable, allowlisted point-in-time
  snapshot. These are persistence details, not a second user-facing product
  object: the interface consistently calls both the working object and the
  catalog item a «курс» and never requires a «шаблон» workflow.
- A published revision contains the generic Course description, Lesson titles
  and teacher comments, the canonical ordered Components, Student Screen
  Slides and immutable copies of ready Course attachments. It excludes private
  Course teacher preferences, audience links, learner/group identities,
  LessonRuns, LearningRecords, reports, schedules, AI consents and history.
- Adding a child catalog item creates a new owner-scoped Course with fresh
  Lesson, Component, Slide and StoredFile identities.
  `CoursePublicationOrigin` records provenance without coupling later edits:
  updating or unpublishing the source never rewrites a previously added Course.
  Educator publications never create this copy/origin.
- Publication dirty state compares a dedicated authored-content clock with the
  listing's acknowledged clock; audience and private teacher preferences do
  not participate. Immutable revision history is bounded by a 5 GiB
  per-Account DB quota, while each revision remains limited to 24 files,
  10 MiB each and 120 MiB total.
- Only active viewers can receive material URLs, and only a child publication
  can be copied. A publisher becoming non-active is atomically unpublished and
  is not republished on reactivation. Persisted orphan-Storage reconciliation
  and a permanent source-Course deletion/retention policy remain rollout
  prerequisites; current soft archive is not hidden physical deletion.
- `Course.learning_audience` classifies one shared authored model as
  `children` or `educators`; it does not create a second Course entity. Only an
  active Account with fresh `account.can_author_educator_courses=true` can
  create or mutate an educator Course. The value is immutable after creation.
- Every submitted educator revision receives an
  `EducatorCourseRevisionReview` state `pending | approved | rejected`.
  Catalog list, published detail, progress and attempts resolve exclusively
  through `CoursePublication.approved_revision_id`; a pending replacement does
  not displace the previously approved revision. Separate admin review UI is
  later, while the server-only review contract is current.
- Official status is persisted, not inferred from the author's display name:
  approved educator listings require `course_publication.is_shidao=true` and
  revision license `shidao_official_learning_v1`. Catalog UI still shows both
  the ShiDao brand and the expert author's name.
- An educator publication is official ShiDao self-learning content for the
  authenticated Account. Its enrollment, last-opened Lesson and Lesson
  completions are persisted against the exact approved revision; a newly
  approved revision therefore starts a separate progress context.
- The educator attestation definition is authored with the working Course and
  copied into the immutable publication revision without exposing its answer
  key. Reading or submitting the test requires `100%` Lesson completion for
  that same revision. The server derives score/pass state and writes attempts
  and durable Account awards; a client never supplies the score.
- Educator Course cannot be copied from the catalog or duplicated, and it has
  no roster, direct/group audience, schedule, LessonRun or teaching actions.
  Child Course keeps its existing independent-copy and teaching lifecycle.
- `/courses` is the catalog/owned list surface; its `children | educators`
  toggle is a list filter. Selecting an item opens the separate read-only
  published workspace `/courses/catalog/[publicationId]` with its own header
  and tabs. It is distinct from the owner Course Builder workspace.
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

The current production code-first registry contains 20 active types:

```text
heading
rich_text
callout
quote
image
video
audio
slideshow
single_choice_poll
matching_game
choice_quiz
fill_blanks
word_bank
sequence
categorize
free_response
external_link
word_builder
vocabulary_list
file
```

UI, application service and development MCP use the same Zod contracts. MCP
JSON Schema is generated from those contracts.

The current production manual picker is a 19-option presentation projection over
this 20-key runtime registry. It omits standalone `heading`, while existing
heading Components and the API/MCP/AI contracts remain supported. `rich_text`
schema version `1` is extended backward-compatibly with an optional plain-text
`title`; required Markdown `content` and old payloads without `title` remain
unchanged. This does not change the physical JSONB schema or require a migration.

`divider` is not an authored component type. The media/link types added in this
slice accept HTTPS URLs only. Interactive checks, including `free_response`,
keep answer state only inside the current preview; learner answer persistence,
attempts, scoring and teacher review are not part of this slice. Voice
recording, arbitrary third-party embeds and image matching remain later work.
The product comparison and rationale live in
[`docs/product/course-component-catalog.md`](./product/course-component-catalog.md).

The current RouterAI source contract validates generated Lesson content against
the deliberately limited `heading`, `rich_text`, `callout`,
`single_choice_poll` and `matching_game` subset of these same registry contracts before
explicit Apply. Its provider-compatible flat transport schema is converted to a
canonical typed plan and then validated again by registry payload contracts and
`lessonAddComponentInputSchema`. It introduces no new domain entity, second
registry, or physical schema.

Operational acceptance release `0276aed` подтвердил default
`google/gemini-2.5-flash-lite` через provider и authenticated no-write smoke;
это не изменило domain model.

Lesson planning and the compatibility course-scoped read-only assistant receive
a bounded
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
- Catalog listing and immutable revisions → `course_publication` +
  `course_publication_revision`; revision files →
  `course_publication_asset` + private `course-publication-assets` bucket.
- Educator revision review → `educator_course_revision_review`; approved
  catalog pointer → `course_publication.approved_revision_id`.
- Educator self-learning → `course_publication_self_enrollment` +
  `course_publication_lesson_completion`; authored/published assessment →
  `course_attestation` + `course_publication_attestation`; results →
  `course_attestation_attempt` + `course_attestation_award`.
- Provenance of a Course added from the catalog →
  `course_publication_origin`. It is metadata only, not a synchronization or
  inheritance relation.
- Product «Слайд экрана ученика» → `lesson_student_slide`.
- Component assignment → `lesson_component.student_slide_id`.
- Product «Проведение урока» → `lesson_run`.
- Product «Индивидуальная учебная запись» → `learning_record`.
- Canonical learner identity → `learner_profile`; teacher-local directory
  context → `teacher_learner`.
- Canonical Account avatar → mutually exclusive `account.avatar_preset_key` or
  `account.avatar_storage_path`, selected by `account.avatar_kind` and updated
  through the revision-aware server boundary; custom WebP objects live in the
  private `profile-avatars` bucket.
- Learner directory groups → `learner_group` + `learner_group_member`.
- Course audience sources → `course_learner` + `course_learner_group`;
  effective learners are a query projection, not another table.
- There is no physical/canonical entity named `course_asset`. The current
  TypeScript read-model alias `CourseAsset` represents a linked `StoredFile`
  returned inside Course attachments; it is not a separate persisted object.

## Retained legacy identity tables

Forward migrations deliberately did not reset `public` or replace Auth. The
current production contract moved login, onboarding, PIN/session invalidation
and learner identity workflows to the roleless Account boundary.
Existing `parent`, `teacher`, `student`, `school` and membership tables remain
as dormant legacy/recovery data; active V2 routes and services do not use them
as identity authorities, Course parents or audience sources. The final M4
contract cleanup removed obsolete active-role helpers and enums after two
verified roleless web releases and a read-only dependency audit; it did not
delete historical rows or rewrite old migrations.

The canonical identity/access contract is documented in
`docs/architecture/learner-identity-access-model.md`. The authoritative physical
schema is documented in `docs/database/current-schema.md` and
`supabase/schema/current-schema.sql`.

Current production implements the roleless target: every active Account has
exactly one linked canonical LearnerProfile, offline profiles may remain
unclaimed, and teaching/observer access is expressed through relations rather
than global product roles. Discovery, recipient-bound activation, safe merge,
archive/restore, learner-safe history/progress, observer grants, subject reset
and Course-scoped AI consent are implemented as projections and transactional
workflows over that model. M1–M6, verified backups, DB/API/GoTrue postflight and
the staged Coolify rollout recorded in the deployment runbook are complete.

## Planned, not implemented

The following remain later domains, not current tables or product capabilities:

- persisted Homework;
- live Student Screen synchronization/runtime cursor for an open LessonRun;
- automatic component-produced learner metrics and richer progress models on
  top of finalized LearningRecord;
- persistent AI quotas/usage ledger and AI change sets/undo;
- parsing/RAG sources;
- automatic merge/update of an already added Course when a newer catalog
  revision appears;
- organization moderation UI, ratings and additional official ShiDao catalog
  courses beyond the current educator review flow;
- LearnerProfile-scoped enrollment/consumption of child Course; current
  educator self-learning is Account-scoped and does not imply this access;
- Product/Order/Inventory, persisted cart/checkout, payment and delivery;
  current `/store` is a client-state UI demo and adds no commerce domain tables;
- chat/notifications and external MCP.

Sequencing lives in `docs/roadmap.md`. Future domains must not add Step/root
Step or make old School/Class/Methodology a parent of Course content.
