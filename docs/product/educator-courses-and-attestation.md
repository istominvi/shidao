# Курсы для педагогов и аттестация

**Статус:** current production database + web/API + authenticated authoring ACL
hotfix

**Актуально на:** 13 августа 2026 года

## Граница статусов

В production уже применён базовый E1 database contract: назначение курса
`children | educators`, immutable определение аттестации, Account attempts и
awards. Там же опубликован демонстрационный курс для преподавателя китайского
языка и сохранён ранее выданный результат. UUID parsing incident исправлен
current production release `22b486a7163453019d9720cb4fe0f36ed7c0228d`.

E2 migration `20260812150745_educator_course_governance_progress.sql` применена
к production DB с `COMMIT` в `2026-08-12T07:34:36Z`; DB postflight и E2
snapshot `2026-08-12T07:46:11Z` подтвердили governance, approved revision,
self-learning progress и official no-copy/no-roster/no-Run contract. Current
E2A content-guard ACL correction применена отдельно и отражена в snapshot
`2026-08-13T11:43:48Z`. Зависимые API/UI развёрнуты прежним coupled E2 rollout
и остаются current production без дополнительного web deployment.

## Одна модель Course, два учебных назначения

Курс для педагогов не является вторым Course type. Он использует ту же
каноническую authored-иерархию `Course → Lesson → ordered Components`,
Student Screen Slides, course-wide attachments и immutable publication
revision. Назначение хранится отдельно:

- `children` — «Обучение детей»;
- `educators` — «Обучение педагогов».

Это поле `course.learning_audience`; operational `audience_type` по-прежнему
описывает roster обычного детского Course и для этой классификации не
используется. Для educator Course оно обязано оставаться `none`.

В каталоге audience toggle является только фильтром списка. Он расположен в
одной toolbar-строке с поиском, фильтрами и выбором вида и не переносится на
страницу открытого курса. Фильтрация, facets и cursor выполняются server-side
внутри выбранного направления.

## Доверенный автор и обязательное согласование

Возможность создавать official educator Course задаёт canonical Account-флаг
`account.can_author_educator_courses`. Он имеет default `false`, не берётся из
редактируемого Auth metadata/JWT claim и возвращается свежим
`current_account_auth_context()`.

- Обычный Account создаёт только Course для обучения детей.
- Active Account с capability видит в `/courses/new` выбор «Обучение детей /
  Обучение педагогов».
- После создания `learning_audience` курса immutable. Отзыв capability
  останавливает дальнейшие educator content mutations, но не меняет Course на
  детский.
- Capability даёт право подготовить и отправить educator revision, но не право
  самостоятельно одобрить её для каталога.

### Current production authenticated authoring ACL hotfix

E2 schema использовала семь Course/content triggers через общий
`SECURITY INVOKER` guard. Guard вызывал закрытый
`educator_course_author_can_mutate(uuid)`, а обычный authenticated owner не
имеет и не должен получать прямой `EXECUTE` этого helper. В результате
разрешённый Component update (включая сохранение нового Text), а также другие
прямые Course-child mutations завершались `42501 permission denied`
раньше проверки `learning_audience` и author capability. Это дефект
execution-context/ACL, а не повреждение Component payload или authored данных.

Production forward migration
`20260813113041_fix_educator_course_content_guard_acl.sql` встроила тот же
predicate в invoker guard. Helper остаётся закрытым для browser roles; RLS,
table grants, capability semantics и семь trigger assignments не расширяются.
Exact apply завершился `COMMIT`. Postflight `12/12` подтвердил owner/invoker,
пустой `search_path`, closed ACL, inline predicate, семь triggers и отсутствие
policy drift; Account/Course/Lesson/Component counts остались `19/6/22/85`.
Authenticated educator `rich_text` same-value `UPDATE` прошёл внутри rollback
(`rollback_verified=true`). Current snapshot `2026-08-13T11:43:48Z` имеет
SHA-256
`0a6eab37e1bbecc0084e281496346e5436fcbd1ac2b42e102e89951e71ff258e`.
Отдельный web/Coolify deployment для DB-only исправления не требовался.

У educator Course авторская вкладка «Аттестация» содержит обязательное
определение итогового теста: вопросы, варианты, правильные ответы, объяснения и
проходной балл. Публикация без валидного определения запрещена.

Каждая отправленная educator revision получает review state
`pending | approved | rejected`. Только server-side admin review RPC может
одобрить или отклонить её; отдельный admin UI пока не реализован. До первого
approval курс отсутствует в каталоге. После approval каталог и published detail
читают только `course_publication.approved_revision_id` с official license и
`is_shidao=true`. Если автор отправил новую revision, прежняя approved revision
остаётся доступной, пока новая не одобрена.

В карточке и таблице сохраняется catalog publisher label. В заголовке
собственного published educator Course отдельный чёрный бренд-chip `ShiDao` не
дублируется: «Аттестован» занимает верхнюю строку, ниже показывается author login
текущей Account session. Для чужой публикации current schema пока предоставляет
только immutable publisher label; отдельный публичный author handle не
смоделирован и learner login alias для этой цели не используется.

## Published workspace и learner-safe projection

Открытие catalog item ведёт на отдельный route
`/courses/catalog/[publicationId]`. Compatibility-параметр старого inline
detail перенаправляет туда. Published workspace имеет собственный заголовок,
ссылку назад в выбранное направление каталога и вкладки:

1. **Уроки**;
2. **О курсе**;
3. **Материалы**;
4. **Аттестация** — только у educator Course.

Это content-read-only опыт самостоятельного обучения, а не owner Course
Builder: Account может сохранять свой progress и попытку, но не менять authored
Course. Published API строит learner-safe projection из immutable approved
revision:

- Lesson title и estimated duration доступны;
- показываются только `learner_visible` Components, назначенные на Student
  Screen Slides, с сохранением authored order;
- Lesson `summary`, `staff_only` Components, teacher preferences, roster,
  groups, LessonRuns, LearningRecords, reports/history и AI consent не выходят
  в browser;
- явно включённые в publication course-wide materials открываются через
  краткоживущие signed URLs; Storage paths и credentials не раскрываются.

Детский catalog Course сохраняет прежнее действие «Добавить в мои курсы» или
«Открыть мой курс» для владельца source. Educator Course нельзя добавить в
«Мои», скопировать из каталога или дублировать даже после аттестации. У него нет
roster, groups/direct learners, scheduling, LessonRun и действий проведения:
по нему учится только сам Account.

## Persisted progress и допуск к аттестации

Самостоятельное прохождение educator Course хранится на Account и exact
approved revision:

- `course_publication_self_enrollment` хранит начало и последний открытый
  Lesson;
- `course_publication_lesson_completion` хранит завершённые Lessons;
- `get_my_course_publication_progress(...)` возвращает last opened Lesson,
  ordered completed refs, completed/total counts, percent и complete;
- `set_my_course_publication_lesson_progress(...)` атомарно обновляет resume
  pointer и completion выбранного Lesson с expected revision guard.

Workspace показывает прогресс, позволяет продолжить с последнего открытого
урока и последовательно сохраняет открытия/отметки, не применяя устаревший
ответ к другой publication или revision. Progress новой approved revision
отделён от предыдущей.

Вкладка «Аттестация» видна сразу, но заблокирована до `100%` Lessons. Этот gate
проверяется не только в UI: и чтение теста, и его отправка server-side требуют
полного progress той же approved revision. Historical award из E1 migration
backfill получает revision-scoped enrollment и completions без tracked Account
UUID/email literals.

## Аттестация и результат

Попытка выполняется только против exact immutable approved revision. Browser
передаёт выбранные варианты, но score и факт прохождения вычисляет одна
транзакционная DB-функция по закрытому answer key.

- До успешной аттестации correct answer IDs и explanations не возвращаются.
- Submit содержит expected revision ID; stale форма отклоняется.
- На одну revision принимается не более пяти попыток Account за 15 минут.
- Attempts и awards закрыты от прямой browser table-записи.
- Успешный result создаёт durable Account award, показывает badge
  «Аттестован» уже в заголовке курса и добавляет credential во вкладку
  «Аттестация» учебного профиля.
- Новая approved revision требует отдельного полного progress и нового award;
  исторический результат остаётся в профиле и помечается как не относящийся к
  current revision.

Результат означает внутреннюю аттестацию ShiDao. Он не является
государственным удостоверением о повышении квалификации.

## Current production database baseline

E1 migration `20260812113000_educator_course_attestations.sql`, initial
dependent web/API release и product-data bootstrap развёрнуты. Bootstrap создал
курс «Современный урок китайского языка для детей: произношение, иероглифика и
формирующее оценивание» с шестью Lessons, шестью Components, шестью Slides и
десятью вопросами. Реальная DB/RPC попытка дала `9/10 = 90%` при пороге `80%`,
`passed=true`; profile RPC содержит одну credential. E2 database migration
добавила trusted-author/review/progress contract; postflight подтвердил одну
official approved educator publication, derived progress `6/6 = 100%`, одну
attempt/award, `90%` при threshold `80%` и отсутствие copy origin, roster,
group assignment и LessonRun. Последующий content-guard ACL hotfix применён
без изменения данных. Current snapshot `2026-08-13T11:43:48Z` имеет SHA-256
`0a6eab37e1bbecc0084e281496346e5436fcbd1ac2b42e102e89951e71ff258e`.

UUID parsing hotfix и dependent E2 API/UI развёрнуты в exact functional commit
`22b486a7163453019d9720cb4fe0f36ed7c0228d`.

Последующие общие UI-only refinements развёрнуты из exact source
`9e66fb548bef176486673149f466b269fd436b21`; они не изменяют educator schema,
progress или attestation semantics.

## Production web/API evidence

- Coolify deployment `ikw0bj347reelzotaqo15a39` развернул exact functional
  commit `22b486a7163453019d9720cb4fe0f36ed7c0228d` с `Success` за `2m39s`:
  `2026-08-12T07:56:00Z` — `2026-08-12T07:58:39Z`.
- Container `g9x4d9zn60jv35r7zf0xl6xj-075600861579` использует image tag exact
  commit и image ID
  `sha256:214e954aed0355c1881ea778e65dcb7f4c4cabcde4d7ac2e3f6022322bd8e027`;
  `SOURCE_COMMIT` exact, restart count `0`.
- HTTP postflight: V2 login/robots `200`, guest Courses `307` в login, landing
  root `200`, landing login/API `503`, missing/wrong CSRF Origin `403`, exact
  V2 Origin без session `401`.
- Current container после UI-only rollout использует exact image tag
  `9e66fb548bef176486673149f466b269fd436b21`, image ID
  `sha256:8b2eb3609531ba08fca946dde633dc1946821ade3ec1b408be09bafd4ef172d7`
  и restart count `0`.

## Later

- admin UI для выдачи author capability и review educator revisions;
- лицензированный issuer, юридически значимое удостоверение и проверяемый
  certificate number;
- proctoring, ручная проверка и задания со свободным ответом;
- согласованная expiration/retake policy и optional self-study deadlines.
