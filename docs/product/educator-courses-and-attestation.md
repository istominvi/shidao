# Курсы для педагогов и аттестация

**Статус:** production database current; dependent web rollout next

**Актуально на:** 12 августа 2026 года

## Граница статусов

В production уже применён базовый E1 database contract: назначение курса
`children | educators`, immutable определение аттестации, Account attempts и
awards. Там же опубликован демонстрационный курс для преподавателя китайского
языка и сохранён ранее выданный результат. Записанный dependent web release
`28387a9863afeccf4a6ad332dcf0f01048a69e67` имеет известный UUID parsing
incident; исправляющий его source ещё не имеет отдельного production deployment
evidence.

E2 migration `20260812150745_educator_course_governance_progress.sql` применена
к production DB с `COMMIT` в `2026-08-12T07:34:36Z`; DB postflight и current
snapshot `2026-08-12T07:43:11Z` подтвердили governance, approved revision,
self-learning progress и official no-copy/no-roster/no-Run contract. Зависимые
API/UI реализованы в repository, но ещё не имеют отдельного production web
deployment evidence. Ниже **current database** относится к production DB, а
application surfaces остаются repository current / production next.

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

В карточке, таблице и заголовке published educator Course одновременно
показываются бренд `ShiDao` и имя эксперта-автора, а не один из них.

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
group assignment и LessonRun. Current snapshot имеет SHA-256
`6df94ceabbc902b66b4c592998f1770ea62442a68255ddd6133a3b9d75745949`.

UUID parsing hotfix и dependent E2 API/UI входят в следующий web rollout. Эти
DB-факты не являются доказательством deployment отдельного workspace и toolbar
в running application.

## Production next

Для завершения dependent application rollout необходимо отдельно:

1. пройти release gates и развернуть exact dependent web release;
2. подтвердить `SOURCE_COMMIT`, image digest, restart и host/CSRF/API
   boundaries;
3. подтвердить authenticated catalog, approved-revision visibility, named
   expert + ShiDao, persisted resume/progress, `100%` attestation gate, badge и
   profile credential без copy/duplicate/roster/run действий.

## Later

- admin UI для выдачи author capability и review educator revisions;
- лицензированный issuer, юридически значимое удостоверение и проверяемый
  certificate number;
- proctoring, ручная проверка и задания со свободным ответом;
- согласованная expiration/retake policy и optional self-study deadlines.
