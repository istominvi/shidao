# Communication Center

**Статус:** canonical V2 product/application contract

**Дата решения:** 16 августа 2026 года

**Область:** сообщения между Account, Course chat, системные уведомления,
persisted System Assistant conversations и unified inbox

**Deployment boundary:** production DB current через CC1 + A2 atomic Assistant
schedule guard. Communication Center web/API/UI current на `v2.shidao.ru` из
exact source `2efaa86851fffc7e444af904fb900d9984caa6a8`; Coolify deployment
`otekp2zseg5ig2r05v6taabu` и production HTTP/auth/CSRF boundary postflight
успешны.

## Product decision

ShiDao использует одну глобальную точку входа **«Сообщения»** вместо отдельных
пункта навигации, колокольчика уведомлений и AI-launcher. Одна кнопка с общим
unread badge открывает единый список, но не превращает разные источники в одну
неразличимую доменную сущность.

```text
Сообщения
├── личный диалог Account ↔ Account
├── чат Course
├── ShiDao · Система
└── ShiDao ИИ · один из нескольких persisted диалогов
```

Пользовательский словарь не вводит параллельные сущности «центр уведомлений»,
«inbox» или «мессенджер». В интерфейсе это один раздел «Сообщения» и четыре
явно маркированных вида диалогов.

## Provenance

- Человеческое сообщение всегда подписано фактическим Account-отправителем.
- **ShiDao · Система** сообщает только committed typed domain facts. System
  item нельзя создать через human composer или provider output.
- **ShiDao ИИ** возвращает model-authored текст, результат явной AI-задачи или
  strict proposal. Он не изображает системный факт или другого человека.
- Точная метрика LessonRun принадлежит ShiDao. Если модель интерпретирует эту
  метрику, AI-вывод показывается отдельно и маркируется как ИИ.

## Human messaging

### Direct conversation

Первый разрешённый direct scope — два Account, между которыми существует
активная accepted teacher/learner relation. Offline LearnerProfile без
`account_id` не является получателем внутреннего сообщения. Pending или
archived relation не разрешает новый direct thread или отправку.

Глобального поиска Account нет. ObserverGrant сам по себе не даёт права писать.
Teacher-to-teacher discovery, arbitrary direct messages, attachments,
broadcast, moderation UI и внешняя доставка являются отдельными later slices.

### Course conversation

Course chat доступен владельцу active children Course и Account текущей
effective audience через linked LearnerProfile. Observer не входит
автоматически. Правило истории намеренно простое:

- текущий участник видит всю историю Course chat, включая сообщения до его
  присоединения;
- Account вне текущей Course audience не видит чат;
- повторное добавление возвращает доступ ко всей истории.

Из этого следует жёсткая privacy-граница: Course chat не содержит private
teacher comments, roster-wide or individual LearningRecord detail, чужие
learner metrics, security data или content, который не разрешён любому
текущему и будущему участнику Course.

## System notifications

System notification является персональной доставкой typed domain event
конкретному Account. В unified inbox все системные items образуют закреплённую
read-only ленту **ShiDao** без composer.

Первый event set:

- LessonRun назначен, перенесён или отменён;
- LessonRun завершён: owner получает только aggregate group metric, linked
  learner Account — только собственный learner-safe результат;
- важный результат подтверждённого AI/application action, когда он не является
  обычной синхронной репликой открытого диалога.

Transient «сохранено», локальная validation error или retry feedback остаются
inline/toast и не создают durable notification. Human message само даёт unread
состояние и не дублируется отдельным system item.

## Persisted AI conversations

Account может создать несколько AI-диалогов. Каждый диалог имеет название,
owner, видимый allowlisted page context и persisted turns. Context не является
произвольным URL/DOM и не открывает данные сверх существующего
System Assistant server contract.

AI provider получает bounded recent conversation с server storage, а не
доверяет присланной browser истории. Provider по-прежнему ничего не записывает
напрямую. Mutations проходят существующий поток:

```text
provider reply/proposal
→ persisted assistant turn
→ visible preview/action card
→ explicit user confirmation
→ canonical application service
→ verified result/audit state
```

Для confirmed `lesson.schedule_run` current source/DB использует отдельный A2
atomic compare-and-schedule boundary. Signed proposal фиксирует expected open
LessonRun id/`updated_at` (оба `null` для create) и exact sorted
LearnerProfile audience. При Apply authenticated RPC
`schedule_lesson_run_if_unchanged` в одной transaction блокирует и повторно
проверяет Course/Run/audience: create требует отсутствие open Run и точное
совпадение current effective Course audience, reschedule — exact open Run token
и draft roster. Только после успешного сравнения он вызывает canonical
`schedule_lesson_run`; mismatch становится stale action
(`lesson_run_changed`, SQLSTATE `55000`). Browser не передаёт Account/Auth UUID.
Это current database/source behavior, а не доказательство уже развёрнутого
Communication Center web flow.

ИИ может инициативно написать owner в исходный диалог после завершения ранее
запущенной durable задачи или в ответ на разрешённый system event. Это не даёт
ему права автоматически отправлять человеческое сообщение другому Account.
Такое сообщение сначала становится видимым draft, а фактический Send остаётся
отдельным действием пользователя.

Human messages никогда автоматически не входят в provider context. Передача
выбранного фрагмента ИИ требует отдельного явного действия и не входит в первый
slice.

## Unified inbox and unread

Unified inbox является read model поверх human threads, system notifications и
assistant conversations. Он задаёт сортировку, preview и общий unread badge,
но не определяет canonical sender, permissions или payload.

- Human unread считается относительно participant read cursor.
- System item различает unread и action-required state.
- AI unread считается по unseen assistant turns.
- Простое открытие центра не отмечает все источники прочитанными; read cursor
  меняется только при открытии конкретного диалога.

Desktop использует non-modal panel с возможностью расширения, mobile —
полноэкранную поверхность. Контекстные действия «Написать» и «Чат курса»
открывают тот же глобальный центр в нужном диалоге и не создают второй UI-flow.

## Authorization and persistence boundary

- Browser не передаёт `sender_account_id`; sender выводится из authenticated
  user-JWT/Account session.
- Public communication tables имеют RLS и closed ACL. Browser работает через
  узкие RPC/application services; `anon` не получает доступ.
- Direct access повторно проверяет active relation при каждом read/send.
- Course access повторно вычисляется из current owner/effective audience при
  каждом read/send; наличие старого thread/read row не сохраняет capability.
- Deep link повторно проходит authorization целевой Course/Lesson/Profile.
- Message body имеет bounded length; cursor pagination использует
  `(created_at, id)`, а RLS/access lookup columns индексируются.
- System events создаёт только trusted database/application boundary.
- AI conversation persistence не хранит JWT, secrets, full provider context,
  raw foreign history или attachment contents.

## Initial implementation boundary

Первый vertical slice включает:

- один global «Сообщения» launcher и unified inbox;
- direct threads для active linked Account;
- Course threads с current-audience/full-history rule;
- read-only ShiDao system feed и unread states;
- несколько persisted AI conversations поверх существующего Assistant;
- contextual entry points из Students и Course;
- responsive/keyboard/focus behavior и bounded cursor reads.

Вложения, edit/delete, visible read receipts, reactions, arbitrary Account
search, generic groups outside Course, push/email, voice, moderation UI,
AI-reading human chats и AI auto-send другому человеку остаются **later**.
Durable background AI worker и generalized event-driven AI suggestions также
расширяются отдельным slice; их schema не должна изображать process-local
request как надёжную background job.

## Relation to Lesson workflow

Communication не создаёт Lesson Step, второй Course/Lesson content order или
отдельный Schedule event. Course chat ссылается на существующий Course, а
Lesson notifications — на существующий LessonRun. Расписание остаётся
проекцией LessonRun, Student Screen — persisted Slide projection, Homework —
отдельной Lesson surface.
