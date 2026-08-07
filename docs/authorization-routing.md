# Auth, domains and routing

**Статус:** current implementation
**Канонический app host:** `v2.shidao.ru`
**Последний подтверждённый functional release:** `757044c`

Teacher-only `/schedule` и `/students` развёрнуты и проверены на release
`fea7f80`.

Standalone `demo.shidao.ru` и cache recovery старого permanent redirect
развёрнуты и проверены на release `7021801`.

Deployed canonical learner slice не добавляет новые public routes:
существующие teacher-only URLs и learner-profile API сохраняются, но доступ к
canonical profile идёт через `teacher_learner`, а history — через
`learning_record.recorded_by_account_id`.

Target roleless navigation, self/observer routes и invitation/claim access
остаются **next**. Их полный execution contract находится в
[`LEARNER_IDENTITY_COMPLETION_PROMPT.md`](./v2/LEARNER_IDENTITY_COMPLETION_PROMPT.md);
до фактического cutover описанные ниже teacher/parent/student guards являются
current behavior.

## Host matrix

| Host                         | Поведение                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `shidao.ru`, `www.shidao.ru` | `/` и landing assets доступны; внутренние pages переписываются на maintenance с HTTP 503; `/api/*` возвращает JSON 503         |
| `v2.shidao.ru`               | Полное Auth и приложение; `X-Robots-Tag: noindex, nofollow, noarchive`; `robots.txt` запрещает crawling                        |
| `brand.shidao.ru`            | только `/` переписывается на `/brand`; другие paths сейчас проходят обычный routing                                            |
| `model.shidao.ru`            | только `/` переписывается на `/model`; другие paths сейчас проходят обычный routing                                            |
| `demo.shidao.ru`             | Safe root/deep links переписываются на standalone `/demo` с Guest session и noindex; unsafe methods возвращают 405; V2 API нет |
| localhost/любой другой host  | Обычный route handling без host split                                                                                          |

Каноническая реализация находится в `src/middleware.ts` и
`src/lib/deployment-access.ts`.

Текущая защита не является полной application-host allowlist: неизвестные
hosts и non-root paths `brand`/`model` проходят в приложение. Standalone demo
имеет отдельную read-only/noindex границу, но общая изоляция всё ещё зависит от
proxy/DNS routing. Это известный P0 hardening debt; до исправления нельзя
направлять на web application новые публичные hosts.

`demo.shidao.ru` содержит только исторический UI-прототип с фиктивными
client-only данными. Clean paths сохраняются в адресной строке и после reload,
но middleware всегда обслуживает их через `/demo`. Demo не получает V2 session,
не вызывает Supabase/application API и не является compatibility layer для
Step/Methodology или подтверждением persistence показанных сценариев.
Одноразовый вход `/?restored=1` отправляет `Clear-Site-Data: "cache"` и после
hydration заменяет URL на `/`: это снимает ранее закэшированный permanent `308`
у браузеров, которые открывали demo во время redirect-периода.

## Public/Auth routes V2

```text
/
/login
/join
/join/check-email
/forgot-password
/reset-password
/auth/confirm
```

Auth callback принимает только поддерживаемые token types, проверяет
`token_hash` через Supabase Auth, записывает encrypted app session и принимает
только safe relative `next`.

## Entry flow

### Signup с подтверждением email

1. Guest отправляет форму `/join`.
2. Supabase Auth создаёт неподтверждённого пользователя и отправляет письмо.
3. Пользователь открывает `https://v2.shidao.ru/auth/confirm`.
4. Callback верифицирует token server-side и записывает app session.
5. Для `signup/email` redirect по умолчанию ведёт в `/courses`.

Повторный login после успешного confirm не обязателен.

### Обычный login

1. Guest открывает `/login`.
2. Server проверяет credentials через Supabase Auth и создаёт app session.
3. Transitional V1 `student` identity направляется в `/courses`; это routing
   compatibility, а не уже реализованный learner product V2.
4. Adult без parent/teacher profile направляется в `/onboarding`.
5. Adult с профилем направляется в `/courses`.

Safe relative `next` сохраняется. Absolute и protocol-relative redirect targets
отклоняются.

## Active private routes

Session-protected application:

```text
/onboarding
/courses
/courses/new
/courses/[courseId]
/courses/[courseId]/student-preview
```

Teacher-required application:

```text
/schedule
/students
```

Оба маршрута доступны только `adult-with-profile` с активным profile
`teacher`. Guest/degraded session перенаправляется в `/login`, взрослый без
профиля — в `/onboarding`, active Parent и transitional Student — в `/courses`.
Пункты «Расписание» и «Ученики» поэтому присутствуют только в teacher primary
navigation; Parent и Student сохраняют пункт «Курсы».

Profile-required settings:

```text
/settings/profile
/settings/security
```

`/courses` намеренно находится под общим authenticated layout, а не под
`(profile-required)`: новый `account` bootstraps Course ownership независимо
от старого parent/teacher profile. Onboarding/profile compatibility остаётся
переходным identity flow.

`/schedule` и `/students` являются реальными teacher workflows, а не
восстановлением старых domain routes. Schedule читает и изменяет LessonRun через
V2 application service. Students читает projection
`teacher_learner + learner_profile`, управляет teacher-local profiles/groups и
историей через существующие learner-profile API/RPC. Dashboard, methodology,
старые group/scheduled-lesson, notification и lesson pages удалены и не являются
compatibility routes.

## V2 API namespaces

Auth/session:

```text
/api/auth/*
/api/onboarding
/api/preferences/*
/api/settings/*
```

Course Builder:

```text
/api/v2/courses
/api/v2/courses/[courseId]
/api/v2/courses/[courseId]/assemble
/api/v2/courses/[courseId]/attachments/*
/api/v2/courses/[courseId]/lessons
/api/v2/courses/[courseId]/student-preview
/api/v2/lessons/[lessonId]
/api/v2/lessons/[lessonId]/components
/api/v2/components/[componentId]
/api/v2/components/[componentId]/reorder
/api/v2/components/[componentId]/student-screen
/api/v2/learner-profiles
/api/v2/learner-profiles/[learnerProfileId]
/api/v2/learner-profiles/[learnerProfileId]/history
/api/v2/learner-groups
/api/v2/learner-groups/[learnerGroupId]
/api/v2/lesson-runs
/api/v2/lesson-runs/[lessonRunId]
/api/v2/lesson-runs/[lessonRunId]/{start,complete,cancel}
/api/v2/courses/[courseId]/audience
/api/v2/courses/[courseId]/history
/api/v2/lessons/[lessonId]/runs
/api/v2/lessons/[lessonId]/history
```

## Request/data flow

```text
browser UI
→ same-origin Next.js route handler
→ encrypted app session
→ short-lived Supabase user access token
→ CourseBuilderApplicationService | LessonRunsApplicationService
→ repository / Storage adapter
→ Supabase Data/Storage API
→ RLS + ownership checks
```

Browser components не получают database credentials и не выполняют прямой SQL.
`service_role` не используется в обычном Course Builder browser flow или
development MCP.

Serialized Student Screen assignment/reorder/delete RPC дополнительно
проверяют `auth.uid() → account → course` внутри узкой transaction boundary.

## Authorization boundaries

- App session идентифицирует Auth user и содержит short-lived Supabase tokens.
- Course принадлежит `account`, где `account.auth_user_id = auth.uid()`.
- Lesson, Components, Slides и attachments наследуют Course ownership.
- Teacher-only `/schedule` и `/students` дополнительно проходят server layout
  guard по active teacher profile до render client workspace.
- Canonical `learner_profile` не имеет teacher owner. Текущий teacher видит его
  только через собственную `teacher_learner` relation; локальное имя и archive
  state принадлежат этой relation.
- Group membership и direct Course audience принимают только profile с активной
  relation owner Account; другой teacher не может назначить canonical ID без
  своей relation.
- `LearningRecord` history текущего teacher ограничена
  `recorded_by_account_id = current_account_id()`.
- `/students` не обращается к transitional `student/class/class_student` и не
  выдаёт login compatibility identity за LearnerProfile/Group.
- Nullable `learner_profile.account_id` не создаёт learner session, route access
  или право читать teacher comments/history; linked Account может выбрать
  только собственную canonical profile row. Claim/invitation/observer flows ещё
  не реализованы.
- Learner preview сейчас является owner-only preview, а не публичным enrollment
  endpoint.
- Student Screen response создаётся server-side и физически исключает
  `lesson.summary`, `staff_only` Components и attachments, на которые не
  ссылается learner-visible Component.
- MCP использует тот же пользовательский JWT и application service.

Полный identity/access contract находится в
[`docs/architecture/learner-identity-access-model.md`](./architecture/learner-identity-access-model.md).

## CSRF and session revocation

Global middleware выполняет Origin/Sec-Fetch-Site guard до route handler, но
текущая configured-origin policy всё ещё допускает landing host как Origin для
unsafe V2 requests. Строгая app-host boundary и cross-subdomain regression test
остаются P0 hardening debt. На demo host unsafe methods блокируются отдельной
read-only policy до CSRF/application routes; полный production host allowlist
тоже ещё не реализован.

Encrypted app sessions содержат issue time и version:

- `user_security.sessions_invalid_before` — per-user cutoff;
- `APP_SESSION_VERSION` — global all-user invalidation;
- recovery session отдельно ограничивает reset-password flow.

## Изменения, требующие совместного обновления

При добавлении route/host/Auth behavior обновить вместе:

- `src/lib/auth.ts` и route helpers;
- layouts/access guards;
- middleware/CSRF policy;
- Auth redirect tests и browser smoke;
- этот документ и `docs/project-state.md`;
- GoTrue allowlist/Next environment только если это действительно требуется.
