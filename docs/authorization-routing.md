# Auth, domains and routing

**Статус:** current production roleless release

**Канонический app host:** `v2.shidao.ru`

**Текущий functional application source:**
`1d4e5deff83cbdc1b479b16e4220cf799327009f`; подробный release evidence см. в
[`docs/project-state.md`](./project-state.md). Описанные ниже roleless routes,
host/CSRF hardening и identity invitation flows прошли M1–M6 production apply,
exact Coolify SHA и browser/API postflight.

## Host matrix

Production middleware использует explicit allowlist:

| Host                         | Текущее поведение                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `shidao.ru`, `www.shidao.ru` | landing root/assets/email templates; internal pages → maintenance 503, `/api/*` → JSON 503    |
| `v2.shidao.ru`               | Auth, roleless application, identity invitation pages/API; global noindex                     |
| `demo.shidao.ru`             | standalone read-only historical demo; safe clean paths, no V2 session/API, unsafe methods 405 |
| `brand.shidao.ru`            | только `/`; non-root 421                                                                      |
| `model.shidao.ru`            | только `/`; non-root 421                                                                      |
| localhost/loopback           | разрешён только вне production                                                                |
| любой другой routed host     | 421 `Misdirected Request`, no-store/noindex                                                   |

Если production `Host` и `X-Forwarded-Host` одновременно заданы и различаются,
request отклоняется 421. Таким образом DNS/proxy routing не является
единственной security boundary.

Canonical implementation:
`src/middleware.ts`, `src/lib/deployment-access.ts`.

Landing exact-allowlist включает четыре public GoTrue email templates. Они
ведут на `RedirectTo` app callback и не открывают остальные app routes на
landing host.

## CSRF boundary

Для unsafe `POST | PUT | PATCH | DELETE` в production допускается ровно Origin
`https://v2.shidao.ru`:

- landing/demo/brand/model/unknown origin отклоняются;
- missing или malformed Origin в production отклоняется;
- `NEXT_PUBLIC_SITE_URL` не расширяет allowlist;
- runtime `NEXT_PUBLIC_APP_URL` не может расширить production origin за пределы
  canonical app host;
- cross-subdomain и forwarded-host mismatch покрыты regression tests.

Demo по-прежнему блокирует unsafe methods собственной read-only policy до
application routing. Реализация: `src/lib/server/csrf.ts` и middleware.

## Public/Auth routes

```text
/
/login
/join
/join/check-email
/forgot-password
/reset-password
/auth/confirm
/identity/invitations/[invitationId]
```

Identity invitation page требует authenticated recipient, но является
route-level entry из email. Ее responses имеют:

```text
Cache-Control: no-store
Referrer-Policy: no-referrer
```

Raw application invitation token приходит только во fragment, удаляется через
History API до network work и никогда не отправляется серверу в URL/Referer.

### Email callback и tokenless handoff

1. GoTrue email содержит только Auth `token_hash`, supported type и safe
   `/auth/confirm?...` redirect.
2. Callback server-side вызывает Auth verify, записывает encrypted app session
   и не доверяет arbitrary absolute `next`.
3. Для identity email callback создаёт короткоживущий encrypted HttpOnly
   handoff cookie, привязанный к invitation id/kind, Auth user и verified email
   digest.
4. Browser попадает на tokenless `/identity/invitations/[id]`; Auth token hash
   и application bearer token не остаются в адресе страницы.
5. Wrong Account/email получает один generic fail-closed response.

Signup/login/recovery используют тот же self-hosted Supabase Auth/SMTP. Auth,
SMTP, JWT/API keys и base Storage config этот release не меняет.

## Login and Account entry

Обычный email login и existing learner login/PIN сходятся к одному roleless
Account:

```text
identifier
→ email login OR server-only account_login_alias lookup
→ optional Account PIN verification
→ Supabase session
→ encrypted app session
→ /courses or safe relative next
```

Active login path не читает legacy `student.login/internal_auth_email` и не
выбирает actor kind `adult | student`. Internal Auth email остаётся server-only.
Rate limit/lockout и session cutoff находятся на Account credential boundary.

Onboarding собирает display name/locale/timezone Account. Он не создаёт
Teacher/Parent profile и не предлагает role switch. Existing account может
сразу работать в пустых sections; `/courses` означает authoring ownership, а не
learner enrollment.

## Roleless private routes

Любому authenticated Account доступны:

```text
/onboarding
/courses
/courses/new
/courses/catalog/[publicationId]
/courses/[courseId]
/courses/[courseId]/student-preview
/schedule
/students
/store
/profile
/learning-profile                 # compatibility redirect → /profile
/observing                        # compatibility redirect → /students?tab=observing
/settings                         # compatibility redirect → /profile?tab=settings
/settings/profile                 # compatibility redirect → /profile?tab=settings
/settings/security                # compatibility redirect → /profile?tab=settings#security
/settings/observers               # compatibility redirect → /profile?tab=observers
```

Guest/degraded session redirectится на `/login`. Folder names
`(teacher-required)` и `(profile-required)` остаются только filesystem
compatibility; их layouts проверяют Account session и не читают legacy
Teacher/Parent/Student role.

Resource access остаётся relation/ownership-scoped:

- Course authoring — owner Account only;
- `/courses/catalog/[publicationId]` — authenticated read-only projection
  approved publication revision. Детский Course может быть скопирован в новый
  owner Course; official educator Course хранит только Account-scoped progress
  и аттестацию и никогда не предоставляет authoring, roster или LessonRun;
- `/students` — teacher-local `teacher_learner`, groups и recorder-scoped raw
  history текущего Account; вкладка `?tab=observing` использует отдельные
  active observer grants и safe projection;
- `/store` — current production client-state UI-only demo: статический
  ассортимент учебных товаров и React-state cart/checkout. Он не читает Course,
  Lesson, roster или LearningRecord, не вызывает order/payment API и не пишет
  в database/Storage;
- `/profile` — единый Account/profile section; query `tab` принимает
  только `history | attestation | observers | settings`, а отсутствие/неверное
  значение открывает `profile`. Вкладки содержат linked subject safe
  history/progress, share code, observer grants, Account security/email, AI
  consent и subject lifecycle;
- `/observing` — protected compatibility redirect на
  `/students?tab=observing`;
- `/learning-profile`, `/settings`, `/settings/profile`, `/settings/security` и
  `/settings/observers` — protected compatibility redirects в соответствующие
  вкладки `/profile`; query и email-change flags сохраняются, а security URL
  указывает на `#security`;
- Student Screen по-прежнему owner preview, не learner Course access.

Primary navigation для каждого Account в current production UI:

```text
Расписание / Ученики / Курсы / Магазин
```

Account menu:

```text
Профиль / История / Аттестация / Наблюдатели / Настройки / Выход
```

Trigger Account menu не показывает имя: только avatar `40 × 40 px` с радиусом
`12 px`. Dropdown header показывает ФИО и публичный email без avatar;
разделителя под ним или между группами пунктов нет. Account menu входит в общий
dropdown surface contract вместе с contextual `ActionMenu`,
Course/Students/Store filters и Schedule calendar. Панель имеет ровно `6 px`
внутреннего inset, белый фон, radius `12 px`, обычный `border: 0`, одну тень
`0 18px 46px rgba(20, 20, 20, 0.18)` и не использует blur. В forced-colors тень
уступает системной границе `1px solid CanvasText` на `Canvas`. Native `select`,
самостоятельные modal dialogs и reference/demo-only surfaces в этот contract не
входят. Отдельной Settings navigation больше нет.

Avatar обязателен на Account DB boundary. Header получает только safe session
projection `kind/presetKey/revision`: preset читается из immutable local asset,
custom image — через same-origin authenticated `/api/settings/profile/avatar`.
Private Storage path, signed token и Account id в browser SessionView не
выдаются. У private bucket нет browser policies: GET/POST route сначала
проверяет app session и revocation, а Storage и pointer writes выполняет только
server credential. POST принимает либо allowlisted preset key с expected
revision, либо multipart JPEG/PNG/WebP до 5 MiB; server сохраняет только
нормализованный `512 × 512` WebP. Cross-account path, direct browser write и
stale revision fail closed.

Вкладка «Настройки» показывает compact avatar card с текущим изображением и
двумя действиями: `Загрузить фото` и `Выбрать аватар`. Preset modal рендерит
двадцать static WebP только после открытия; `next/image` работает в
`unoptimized` mode, поэтому browser запрашивает
`/avatars/presets/sd-avatar-v1-XX.webp` напрямую, без `/_next/image`. Radio
selection является только preview и сохраняется исключительно по явному
`Сохранить`; close/backdrop/Escape/`Отмена` ничего не меняют. Upload сначала
открывает native file picker, затем отдельный square preview с тем же explicit
save contract.

Implementation: `src/app/(app)/profile/`, `src/components/profile/`,
`src/lib/navigation/profile-nav.ts`,
`src/components/account/avatar-settings-form.tsx` и
`src/app/api/settings/profile/avatar/route.ts`.

## V2 API namespaces

### Auth/session

```text
/api/auth/login
/api/auth/signup
/api/auth/recovery
/api/auth/reset-password
/api/auth/session
/api/auth/reauth
/api/onboarding
/api/preferences/*
/api/settings/*
```

`/api/auth/reauth` записывает recent-reauth time только в sealed app session.
Client-supplied timestamp не является authority для credential reset, unlink
или erasure.

### Course Builder, schedule and teacher directory

Existing `/api/v2/courses`, Lessons, Components, attachments, audience,
history, LessonRun and LearnerGroup routes сохраняются. Teacher profile routes:

```text
/api/v2/learner-profiles
/api/v2/learner-profiles/[learnerProfileId]
/api/v2/learner-profiles/[learnerProfileId]/history
/api/v2/learner-profiles/[learnerProfileId]/identity-invitations
/api/v2/learner-directory
/api/v2/learner-directory/[learnerProfileId]/[restore|delete]
```

Current catalog/self-learning boundary:

```text
/api/v2/course-catalog
/api/v2/course-catalog/[publicationId]
/api/v2/course-catalog/[publicationId]/copy          # children only
/api/v2/course-catalog/[publicationId]/progress      # educator revision
/api/v2/course-catalog/[publicationId]/attestation   # educator revision
/api/v2/courses/[courseId]/publication
/api/v2/courses/[courseId]/duplicate                 # children only
/api/v2/courses/[courseId]/attestation               # trusted educator author
/api/v2/me/attestations
```

Все catalog/attestation endpoints требуют Account session. Browser не получает
answer key до успешной current-revision аттестации; score вычисляется в DB.

### Discovery, invitation and merge

```text
/api/v2/learner-connections
/api/v2/learner-connections/[connectionId]/[accept|reject|cancel]
/api/v2/email-connections/[connectionId]/[preview|accept|reject]
/api/v2/identity-invitations/[invitationId]/[preview|accept|reject|activate]
/api/v2/learner-merges/[mergeOperationId]/[preview|confirm|cancel]
/api/v2/learner-credential-recovery
/api/v2/learner-credential-recovery/[grantId]/[reset|revoke]
```

Server returns only generic delivery-attempted/not-found errors; browser never
receives recipient email digest, token digest, Auth UUID, internal email or raw
PIN/session cutoff.

### Self, observer and AI consent

```text
/api/v2/me/learning-profile
/api/v2/me/learning-profile/history
/api/v2/me/learning-profile/progress
/api/v2/me/learning-profile/share-code
/api/v2/me/learning-profile/unlink/[preview|confirm]
/api/v2/me/learning-profile/erasure/[preview|confirm]
/api/v2/observers
/api/v2/observers/[relationshipId]/[accept|reject|revoke|leave|rename]
/api/v2/email-observer-invitations/[relationshipId]/[preview|accept|reject]
/api/v2/observations
/api/v2/observations/[learnerProfileId]/history
/api/v2/observations/[learnerProfileId]/progress
/api/v2/courses/[courseId]/ai-consent-requests
/api/v2/me/ai-consents
/api/v2/ai-consents/[consentId]/[grant|revoke]
```

## Request/data flow

```text
browser
→ same-origin Next route
→ encrypted app session + recent-reauth state
→ short-lived Supabase user JWT
→ strict Zod input
→ application service
→ user-JWT repository OR narrow server-only admin adapter
→ strict allowlisted RPC output
→ RLS / auth.uid() / recipient digest / ownership checks
```

Administrative adapter uses service role only for Auth Admin, verified email
binding, keyed token digest and server-only AI projection. It always passes an
actor Auth UUID verified from the app session; browser cannot choose this
principal.

All identity RPC outputs are parsed through strict nested schemas. Unexpected
DB fields fail closed as generic API error instead of being serialized.

## Alias and stale URL contract

- Individual teacher profile URLs resolve merged source UUID through
  actor-scoped alias lookup and continue on the canonical target.
- The resolver never exposes a target without the current teacher relation.
- Bulk Group/Course/Run UUID payloads fail with one generic inaccessible-profile
  error; client must reload/reselect current rows rather than globally resolving
  arbitrary aliases.
- Erasure deletes lineage aliases, so an old UUID no longer redirects or
  reveals the new empty profile.

## Authorization summary

- Account/profile exactly-one is a deferred DB invariant, not a UI convention.
- Teacher raw LearningRecord remains recorder-scoped.
- Subject/observer have no raw table SELECT and read only finalized,
  non-superseded safe projections with explicitly shared comments.
- Teacher relation never grants observer access; observer relation never grants
  teacher mutations.
- AI consent is separate from observer and Course access and is checked on every
  request against owner/audience/expiry/revision.
- Invitation/claim/observer tokens are one-time digests; wrong recipient fails
  closed.
- Destructive subject flows require recent reauth plus expiring preview
  fingerprint.

Full contract:
[`docs/architecture/learner-identity-access-model.md`](./architecture/learner-identity-access-model.md).

## Current / next / later

**Current:** roleless routes/navigation, Account login/PIN, strict host/CSRF
boundary, all identity/observer APIs and UI above. M1–M6, backups, schema
snapshot, Coolify deploy и authenticated browser/API postflight завершены.

**Next:** дальнейшая authoring/accessibility полировка по roadmap без возврата
role switch или отдельной identity-модели.

**Current outside identity:** authenticated Account может самостоятельно
проходить approved educator publication; этот revision-scoped progress и
аттестация не предоставляют доступ к детскому Course или LearnerProfile.

**Current production outside identity:** `/store` доступен
любому authenticated Account как client-state demo без реального заказа, оплаты,
delivery или persistence. Его границы описаны в
[`docs/product/store-demo.md`](./product/store-demo.md).

**Later:** enrollment/consumption детских Course через LearnerProfile, live
Student Screen, Homework/RAG, communication, billing and external MCP. Identity
completion does not imply any of those capabilities.
