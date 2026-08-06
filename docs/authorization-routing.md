# Auth, domains and routing

**Статус:** current implementation
**Канонический app host:** `v2.shidao.ru`
**Последний deployed baseline:** `7021801`

Teacher-only `/schedule` и `/students` развёрнуты и проверены на release
`fea7f80`.

Standalone `demo.shidao.ru` и cache recovery старого permanent redirect
развёрнуты и проверены на release `7021801`.

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

Новые `/schedule` и `/students` являются UI-shells, а не восстановлением старых
domain routes. Они читают только существующий owner-scoped
`GET /api/v2/courses`; новых schedule/student mutation API нет. Dashboard,
methodology, старые group/scheduled-lesson, notification и lesson pages удалены
и не являются compatibility routes.

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
```

## Request/data flow

```text
browser UI
→ same-origin Next.js route handler
→ encrypted app session
→ short-lived Supabase user access token
→ CourseBuilderApplicationService
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
- Данные Course в этих shells приходят через тот же owner-scoped
  `/api/v2/courses`; выбранная дата Schedule остаётся локальным UI state.
- `/students` не обращается к transitional `student/class/class_student` и не
  выдаёт login compatibility identity за LearnerProfile/Group.
- Learner preview сейчас является owner-only preview, а не публичным enrollment
  endpoint.
- Student Screen response создаётся server-side и физически исключает
  `lesson.summary`, `staff_only` Components и attachments, на которые не
  ссылается learner-visible Component.
- MCP использует тот же пользовательский JWT и application service.

## CSRF and session revocation

Global middleware выполняет Origin/Sec-Fetch-Site guard до route handler и
использует `NEXT_PUBLIC_APP_URL=https://v2.shidao.ru` как configured app origin;
без него применяется request Host/X-Forwarded-Host fallback. Regression test
отклоняет unsafe request с Origin `shidao.ru` к `v2.shidao.ru`. На demo host
unsafe methods блокируются отдельной read-only policy до CSRF/application
routes. Полный production host allowlist остаётся отдельным P0 hardening debt.

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
