# ShiDao — глобальная спецификация полного рефакторинга

- **Статус:** утверждённая архитектурная спецификация
- **Проект:** `istominvi/shidao`
- **Активная ветка реконструкции:** `main`
- **Зафиксированный снимок V1:** `51a8bdaf177e5803f0f2aa5f9bc1f9d3b14c4842`
- **Архивные ссылки V1:** `archive/v1-2026-08-03`, `v1-snapshot-2026-08-03`
- **Публичный домен:** `shidao.ru` — landing-only
- **Рабочий адрес V2:** `v2.shidao.ru`
- **Активный контур:** существующие web deployment и self-hosted Supabase
- **Дата фиксации исходных решений:** 26 июля 2026 года
- **Дата обновления стратегии реконструкции:** 3 августа 2026 года
- **Дата подтверждения канонической Lesson-модели:** 4 августа 2026 года
- **Первый milestone реализации:** teacher course builder demo, зафиксирован 3 августа 2026 года

---

## 1. Назначение документа

Этот документ является единым источником требований для полного рефакторинга ShiDao.

Связанные обязательные документы:

- `docs/operations/v1-recovery-runbook.md` — проверка recovery set и безопасный возврат к V1;
- `docs/v2/TEACHER_COURSE_BUILDER_DEMO_MILESTONE.md` — первая цель реализации и сценарий показа заказчику;
- `docs/architecture/lesson-workflow-model.md` — каноническая модель
  `Course → Lesson → ordered Components` и Student Screen projection.

Целевая система проектируется как новый продукт внутри существующего репозитория и существующего инфраструктурного контура. Разработка продолжается непосредственно в ветке `main`, а прикладная схема перестраивается в текущей базе данных. Отдельный репозиторий и отдельный Supabase-проект для V2 не создаются.

Состояние V1 до начала реконструкции зафиксировано Git-ссылками и полным recovery snapshot. Старые прикладные модели, таблицы, миграции, маршруты, компоненты, fallback-данные и совместимость с предыдущей архитектурой не сохраняются в активной версии `main`, но исходное состояние остаётся доступным в архиве для полного восстановления.

Основная цель — построить простую, расширяемую и AI-native платформу, в которой:

- один аккаунт соответствует одному человеку;
- роли не являются типами аккаунта;
- учебная история хранится отдельно от изменяемого контента;
- курс является личным документом владельца;
- курс содержит уроки;
- каждый урок непосредственно содержит один ordered list компонентов;
- course-wide файлы хранятся как private attachments и используются
  компонентами по проверенным ссылкам;
- курс назначается одному учащемуся, одной группе либо никому;
- проведение урока отделено от документа урока;
- AI изменяет продукт только через типизированные инструменты;
- MCP является общим программным интерфейсом для внутренних и будущих внешних AI-клиентов.

---

# Часть I. Границы рефакторинга

## 2. Greenfield внутри существующего контура

Рефакторинг считается greenfield-разработкой на уровне прикладного кода и прикладной схемы, но выполняется in-place: в текущем репозитории, ветке `main`, существующем Supabase deployment и существующей базе PostgreSQL.

Разрешено и требуется:

- удалить и заново создать текущую прикладную схему `public` в контролируемое окно переключения;
- удалить старые миграции из активной версии `main` после подготовки и проверки новой baseline;
- удалить старые таблицы;
- удалить старые API-маршруты;
- удалить модель `methodology → methodology_lesson → scheduled_lesson`;
- удалить глобальные типы пользователей `teacher`, `parent`, `student`;
- удалить глобальный переключатель активной роли;
- удалить fixture-fallback'и;
- удалить специфические renderer'ы отдельных уроков;
- удалить старые URL без редиректов;
- удалить старые идентификаторы;
- удалить тестовую учебную историю;
- удалить старые коммуникационные модели;
- переписать прикладную интеграцию с базой, Auth, Storage и deployment-процессами там, где этого требует новая архитектура;
- продолжать изменять, удалять и создавать прикладные таблицы в текущей базе данных.

При этом запрещено без отдельного решения:

- удалять или перезаписывать архивную ветку, тег и recovery snapshot V1;
- заменять текущий Supabase-проект другим только ради реконструкции;
- удалять `auth.users` или переносить существующих пользователей между Auth-проектами;
- менять GoTrue, SMTP, email confirmation, JWT/API keys и базовую Storage-конфигурацию, если этого не требует отдельная согласованная задача;
- удалять весь PostgreSQL cluster или служебные схемы Supabase вместо контролируемой перестройки прикладной схемы.

Не требуется:

- перенос текущих учебных результатов;
- сохранение старых уроков, курсов, домашних заданий, сообщений и уведомлений;
- сохранение старой структуры миграций;
- compatibility layer;
- параллельная эксплуатация старого приложения;
- период наблюдения legacy-модели;
- old URL redirects.

## 3. Что сохраняется

Сохраняются:

1. Репозиторий `istominvi/shidao`, его Git-история и активная ветка `main`.
2. Архивная ветка `archive/v1-2026-08-03`, тег `v1-snapshot-2026-08-03` и полный Git bundle V1.
3. Текущий self-hosted Supabase deployment и текущая база PostgreSQL.
4. Текущая Supabase Auth-база и все существующие `auth.users`.
5. Возможность входа существующих пользователей с текущими логинами и паролями.
6. Текущие настройки GoTrue, SMTP, подтверждения почты, JWT/API keys и связанные secrets.
7. Текущий Storage service, его служебная схема, buckets и конфигурация. Удаление конкретных старых объектов допускается только как явный шаг новой модели.
8. Физические серверы и их проверенные версии образов, если они подходят целевой архитектуре.
9. Coolify как платформа развёртывания и текущие параметры deployment.
10. Домен `shidao.ru`.
11. Текущая методика только как неизменяемый исторический source в архивных
    refs/recovery snapshot; её возможный импорт в обычный direct-component
    Template требует отдельного решения.

Пароли не извлекаются, не расшифровываются и не переносятся в открытом виде. Сохраняются существующие записи Supabase Auth и их password hashes.

## 4. Источник истины после рефакторинга

После переключения активным источником истины становится состояние `main`:

- единственным источником истины для схемы является новая baseline-миграция;
- старые миграции отсутствуют в активной версии `main`, но остаются в архивных Git-ссылках и bundle;
- старые таблицы отсутствуют;
- старые TypeScript-данные и fixtures отсутствуют;
- документация обновлена под новую модель;
- код не содержит проверок legacy ID, legacy URL или legacy lesson type;
- проект разворачивается с нуля одной последовательностью команд.

Источником истины для восстановления V1 является recovery snapshot от 3 августа 2026 года. Он не участвует в обычной разработке, не коммитится в репозиторий и не изменяется вместе с V2.

---

# Часть II. Инфраструктура и окружения

## 5. Окружения

### 5.1 Активный контур реконструкции

- Публичный Web: `https://shidao.ru`.
- Рабочий Web V2: `https://v2.shidao.ru`.
- Ветка: `main`.
- `shidao.ru` показывает только лендинг; кнопки входа и регистрации неактивны.
- Любой внутренний URL на `shidao.ru`, включая старые ссылки на кабинет, расписание, уроки и Auth, возвращает страницу «Проект в разработке» со статусом HTTP 503.
- API на `shidao.ru` закрыт и возвращает HTTP 503.
- Полное приложение, Auth и внутренние маршруты доступны только на `v2.shidao.ru`.
- `v2.shidao.ru` закрыт от поисковой индексации до публичного запуска.
- Использует существующие Supabase, PostgreSQL, Auth, Storage, SMTP и email confirmation.
- Содержит сохранённые существующие Auth-аккаунты.
- Прикладные данные и таблицы могут удаляться и перестраиваться в ходе реконструкции.
- Параллельная работа V1 не требуется: при необходимости V1 восстанавливается из снимка целиком.

Оба домена обслуживаются одним существующим Coolify application и разделяются по HTTP `Host`. Это не два deployment и не две базы данных. Текущий сайт является средой разработки, а не рабочим production с пользовательскими данными, поэтому отдельный инфраструктурный V2-контур не требуется.

### 5.2 Будущий staging

`staging.shidao.ru` зарезервирован как возможное будущее окружение перед публичным запуском, но его создание не входит в обязательную подготовку текущей реконструкции.

Если staging будет создан, он должен иметь отдельные deployment, базу данных, Supabase Auth, Storage buckets, JWT/API keys, secrets, очередь, AI-лимиты и только синтетические тестовые данные. Размещение на тех же физических серверах допускается, совместное использование логических данных и secrets — нет.

## 6. Deployment

Для текущей реконструкции используются существующие:

- web deployment ShiDao в Coolify;
- два домена одного application: `shidao.ru` и `v2.shidao.ru`;
- self-hosted Supabase environment;
- PostgreSQL database, Auth и Storage внутри этого Supabase environment.

Worker добавляется в тот же активный контур, когда появляется первая фоновая задача. Создание четырёх параллельных production/staging deployment и второго Supabase environment не требуется.

Каждый реально созданный deployment имеет собственные health checks и журналы. Будущий staging, если он появится, разворачивается отдельно от активного контура.

## 7. Переменные окружения

Имена новых прикладных переменных разрешено изменить. Существующие Supabase URL/keys, JWT, GoTrue, SMTP и email confirmation сохраняются до отдельного решения об их ротации или замене. Целевая конфигурация разделяется по подсистемам.

```env
APP_ENV=
APP_BASE_URL=https://v2.shidao.ru
NEXT_PUBLIC_SITE_URL=https://shidao.ru
NEXT_PUBLIC_APP_URL=https://v2.shidao.ru
APP_SESSION_SECRET=
APP_SESSION_TTL_SECONDS=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

STORAGE_PROVIDER=
STORAGE_ENDPOINT=
STORAGE_REGION=
STORAGE_BUCKET_PRIVATE=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=

OPENROUTER_API_KEY=
AI_DEFAULT_MODEL=
AI_EMBEDDING_MODEL=
AI_QUOTA_DEFAULT_MONTHLY_UNITS=

WORKER_CONCURRENCY=
JOB_POLL_INTERVAL_MS=
MCP_SERVER_SECRET=
```

В текущем in-place контуре используются его существующие secrets. Если позднее создаётся staging, он не использует secrets активного контура.

## 8. Хранилище файлов

Целевое файловое хранилище — приватное S3-совместимое хранилище.

Требования:

- файлы приватные по умолчанию;
- доступ через короткоживущие signed URLs;
- ключ объекта не содержит исходное имя пользователя;
- хранится MIME type, размер, checksum и владелец;
- загрузка проверяется по размеру и MIME type;
- изображения могут иметь preview-версии;
- исходный файл не меняется после загрузки.

---

# Часть III. Базовые принципы предметной модели

## 9. Неподвижные принципы

1. Один аккаунт — один человек.
2. Роль не является типом аккаунта.
3. Пользователь не переключает глобальную роль.
4. Возможности определяются владением и отношениями к конкретной сущности.
5. Учебный профиль отделён от аккаунта.
6. Учебная история принадлежит учебному профилю.
7. Контент курса принадлежит владельцу курса.
8. У курса один владелец.
9. У курса одна аудитория или аудитория отсутствует.
10. Курс не изменяется автоматически при изменении группы.
11. Урок является редактируемым документом с одним ordered list компонентов.
12. Между Lesson и Component нет Step, скрытой root-группы или Slide.
13. Проведение урока является отдельной сущностью.
14. Один урок может проводиться неоднократно.
15. Course-wide attachment хранится один раз и проверяется по ownership.
16. Component непосредственно принадлежит одной Lesson; его payload и
    placement валидируются code-first registry.
17. История прохождения не зависит от удаления курса или урока.
18. AI не получает прямой доступ к базе данных.
19. Любое AI-изменение выполняется через валидируемые инструменты.
20. Архитектура MVP не включает школы и организации.

---

# Часть IV. Аккаунты, учебные профили и доступ

## 10. Account

`Account` представляет человека, использующего ShiDao. Account не имеет поля глобальной роли.

Любой Account потенциально может:

- создавать курсы и группы;
- создавать Lesson Components и загружать CourseAsset;
- создавать учебные профили;
- быть guardian для учебных профилей;
- получить собственный учебный профиль;
- учиться;
- проводить занятия;
- использовать AI.

Возраст не используется для запрета создания курсов или включения возможностей.

```text
account
- id UUID PK
- auth_user_id UUID UNIQUE NOT NULL
- username CITEXT UNIQUE NULL
- display_name TEXT NOT NULL
- avatar_file_id UUID NULL
- birth_date DATE NULL
- locale TEXT NOT NULL DEFAULT 'ru'
- timezone TEXT NOT NULL DEFAULT 'Europe/Moscow'
- status ENUM(active, suspended, deleted)
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

## 11. LearnerProfile

`LearnerProfile` представляет обучающегося и его долговременную учебную историю.

Учебный профиль может:

- принадлежать самому Account;
- существовать без Account;
- управляться несколькими guardian-аккаунтами;
- позже быть связан с Account;
- сохраняться после удаления курсов, уроков и групп.

```text
learner_profile
- id UUID PK
- self_account_id UUID UNIQUE NULL
- created_by_account_id UUID NOT NULL
- display_name TEXT NOT NULL
- avatar_file_id UUID NULL
- birth_date DATE NULL
- native_language TEXT NULL
- learning_language TEXT NULL
- current_level TEXT NULL
- interests JSONB NOT NULL DEFAULT []
- preferences JSONB NOT NULL DEFAULT {}
- status ENUM(active, archived)
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

У одного Account не более одного собственного LearnerProfile. Создание Account не создаёт LearnerProfile автоматически.

## 12. Guardian relation

Связь доверенного пользователя с учебным профилем называется `guardian`.

Не используются обязательные типы «мама», «папа», «бабушка» и т. п. Один LearnerProfile может иметь несколько guardian-аккаунтов.

```text
learner_guardian
- learner_profile_id UUID
- guardian_account_id UUID
- status ENUM(active, revoked)
- permissions JSONB
- created_at TIMESTAMPTZ
- revoked_at TIMESTAMPTZ NULL
- PRIMARY KEY (learner_profile_id, guardian_account_id)
```

Guardian по умолчанию может видеть профиль, расписание, домашние задания и учебную историю, а при соответствующем permission — управлять детским входом.

Guardian не получает доступ к `staff_only` Components и private CourseAsset
владельца курса и не участвует в чатах курса в MVP.

## 13. Профиль без Account и детский вход

Учебный профиль может использоваться без полноценного Supabase Auth Account.

Для MVP поддерживается вход:

- уникальный логин;
- короткий PIN.

```text
learner_profile_credential
- learner_profile_id UUID PK
- login CITEXT UNIQUE NOT NULL
- pin_hash TEXT NOT NULL
- pin_changed_at TIMESTAMPTZ
- failed_attempt_count INT NOT NULL DEFAULT 0
- locked_until TIMESTAMPTZ NULL
- enabled BOOLEAN NOT NULL DEFAULT TRUE
- created_by_account_id UUID NOT NULL
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

PIN:

- не хранится открыто;
- хэшируется Argon2id;
- имеет rate limiting и временную блокировку;
- может быть сброшен guardian;
- не показывается владельцу курса;
- не передаётся AI;
- не пишется в логи.

После успешного входа создаётся ограниченная profile-session.

## 14. Самостоятельное подключение полноценного Account

Пользователь учебного профиля может самостоятельно создать или подключить Account через настройки профиля.

После подтверждения личности:

- создаётся или выбирается единственный Account;
- `learner_profile.self_account_id` связывается с Account;
- учебная история остаётся в том же LearnerProfile;
- ограничения на создание курсов не вводятся.

Возраст не запускает автоматический переход.

## 15. Предотвращение дублей

Не допускается создание двух Account для одного человека.

Механизмы:

- уникальность email и телефона в Supabase Auth;
- перед созданием нового Account предлагается войти в существующий;
- learner-profile claim не создаёт новый Account, если человек уже вошёл;
- merge выполняется самим пользователем после повторной аутентификации;
- автоматическое объединение по имени запрещено.

## 16. Invitations

Все межличностные связи создаются через одноразовые приглашения.

Типы MVP:

```text
guardian_link
learner_profile_claim
```

```text
invitation
- id UUID PK
- type TEXT NOT NULL
- created_by_account_id UUID NOT NULL
- target_email CITEXT NULL
- target_phone TEXT NULL
- target_learner_profile_id UUID NULL
- token_hash TEXT NOT NULL
- payload JSONB NOT NULL
- expires_at TIMESTAMPTZ NOT NULL
- accepted_at TIMESTAMPTZ NULL
- accepted_by_account_id UUID NULL
- revoked_at TIMESTAMPTZ NULL
- created_at TIMESTAMPTZ
```

Токен хранится только как hash, имеет TTL, является одноразовым, может быть отозван и полностью аудируется.

---

# Часть V. Группы и аудитория

## 17. Group

Группа — личная сущность владельца.

```text
learner_group
- id UUID PK
- owner_account_id UUID NOT NULL
- title TEXT NOT NULL
- description TEXT NULL
- status ENUM(active, archived)
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

```text
learner_group_member
- group_id UUID
- learner_profile_id UUID
- joined_at TIMESTAMPTZ
- left_at TIMESTAMPTZ NULL
- added_by_account_id UUID
- PRIMARY KEY (group_id, learner_profile_id, joined_at)
```

Одна Group может быть аудиторией нескольких независимых Course.

## 18. Изменение состава группы

Добавление или удаление учащегося:

- не изменяет Course;
- не изменяет Lesson;
- не запускает AI;
- не перегенерирует Lesson Components;
- не меняет существующую учебную историю;
- не создаёт индивидуальное ДЗ автоматически;
- применяет существующее общее ДЗ, если оно есть;
- показывает владельцу индикатор, если учащемуся не назначено effective homework.

Владелец сам решает, требуется ли изменить или перегенерировать содержание.

---

# Часть VI. Курсы и шаблоны

## 19. Course

Course — личный документ одного Account.

У Course:

- один владелец;
- нет совместных редакторов;
- нет передачи владения;
- нет организации или школы;
- нет нескольких преподавателей;
- нет публичного шеринга;
- может отсутствовать аудитория;
- может быть ровно одна аудитория.

```text
course
- id UUID PK
- owner_account_id UUID NULL
- ownership_scope ENUM(personal, system)
- kind ENUM(course, template)
- title TEXT NOT NULL
- description TEXT NULL
- target_lesson_count INT NULL
- audience_type ENUM(none, learner, group)
- audience_learner_profile_id UUID NULL
- audience_group_id UUID NULL
- source_template_id UUID NULL
- settings JSONB NOT NULL DEFAULT {}
- archived_at TIMESTAMPTZ NULL
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

Ограничения:

- `audience_type=none`: оба audience FK равны NULL;
- `audience_type=learner`: заполнен только learner FK;
- `audience_type=group`: заполнен только group FK;
- personal course обязательно имеет owner;
- system template может не иметь личного owner.

## 20. Количество уроков

`target_lesson_count` — намерение пользователя, а не число placeholder-строк.

Пример:

- указано 26 уроков;
- AI создал первые 3;
- в базе существуют 3 Lesson;
- UI показывает `3 из 26 создано`;
- остальные уроки не представлены отдельными сущностями.

Отдельная карта курса и `outline_item` не создаются.

## 21. Копирование курса

Чтобы использовать похожий курс для другой аудитории, пользователь:

- копирует Course;
- либо создаёт Course из Template.

Копирование создаёт новые Course, Lesson, LessonComponent и
HomeworkDefinition. Course attachments копируются или переиспользуются только
через отдельную явную storage operation с проверкой ownership; неявной общей
глобальной библиотеки в активной модели нет.

## 22. Архивная методика и будущий системный Template

Methodology не является активной V2-сущностью и не является обязательной
runtime dependency. Снимок V1, включая прежнюю методику и её файлы, сохраняется
в архивных Git refs и recovery snapshot как исторический источник.

Если отдельной задачей будет одобрен системный Template `ShiDao`, importer:

- читает только явно выбранный архивный source;
- создаёт обычные Course, Lesson, ordered LessonComponent и course attachments;
- прогоняет payload/placement через универсальный registry;
- не переносит methodology IDs в активные сущности;
- не создаёт fixture fallback или уникальные lesson renderers;
- не является prerequisite первого Course Builder milestone или baseline.

---

# Часть VII. Уроки и проведения

## 23. Lesson

Lesson — редактируемый документ внутри Course.

```text
lesson
- id UUID PK
- course_id UUID NOT NULL
- position INT NOT NULL
- title TEXT NOT NULL
- summary TEXT NULL
- estimated_duration_minutes INT NULL
- settings JSONB NOT NULL DEFAULT {}
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

У Lesson нет preparation-status. Существование строки означает, что урок создан. Удаление строки означает, что урок удалён.

## 24. LessonSession

Конкретное проведение Lesson хранится отдельно. Один Lesson может иметь любое число LessonSession.

```text
lesson_session
- id UUID PK
- lesson_id UUID NOT NULL
- scheduled_at TIMESTAMPTZ NOT NULL
- started_at TIMESTAMPTZ NULL
- ended_at TIMESTAMPTZ NULL
- cancelled_at TIMESTAMPTZ NULL
- mode ENUM(live, ai_lesson, homework, self_practice, review)
- current_component_id UUID NULL
- created_by_account_id UUID NOT NULL
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

Статус вычисляется:

```text
cancelled_at != null                    → cancelled
started_at == null                      → scheduled
started_at != null and ended_at == null → in_progress
ended_at != null                        → completed
```

Прошедшая дата без `started_at` не означает completed. Такая Session считается пропущенной и должна быть явно отменена, перенесена или начата.

## 25. Повторное проведение

Для повторного проведения создаётся новая LessonSession. Lesson не копируется автоматически.

Изменения Lesson между сессиями разрешены. История учащегося сохраняет snapshot контекста на момент каждой Session.

## 26. Live runtime

```text
lesson_session_runtime
- lesson_session_id UUID PK
- current_component_id UUID NULL
- runtime_state JSONB
- version BIGINT
- updated_at TIMESTAMPTZ
```

Команды:

```text
start_session
set_current_component
next_component
previous_component
end_session
cancel_session
```

Ученический клиент получает изменения через Supabase Realtime. Polling допускается только как fallback.

---

# Часть VIII. Course assets и реестр компонентов

## 27. Component Type Registry

Реестр типов Lesson Component является code-first.

```ts
interface ComponentDefinition<TPayload, TPlacement> {
  key: string;
  version: number;
  category: string;
  title: string;
  payloadSchema: ZodSchema<TPayload>;
  placementSchema: ZodSchema<TPlacement>;
  defaultPayload: TPayload;
  defaultPlacement: TPlacement;
  capabilities: {
    teacherSurface: boolean;
    studentSurface: boolean;
    interactive: boolean;
    assessable: boolean;
    aiCreatable: boolean;
    aiEditable: boolean;
  };
  aiInstructions: string;
  renderers: {
    teacher: React.ComponentType;
    student?: React.ComponentType;
    preview?: React.ComponentType;
  };
}
```

JSON Schema генерируется из того же источника для UI, application service, MCP
и future AI orchestrator.

Не допускаются:

- дублирующиеся schema definitions;
- renderer, зависящий от ID конкретного Course или Lesson;
- условия по названию архивной методики;
- fallback на TypeScript fixture;
- отдельный table/entity на каждый component type.

## 28. Начальные типы компонентов

Обязательный P0 registry первого milestone:

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

Audio, video, flashcards, quiz, short response, ordering, fill-in-the-gap и AI
assistant могут добавляться позднее как отдельные registry keys с тем же
contract. Абстрактный универсальный `game` не используется.

## 29. CourseAsset

Файл или изображение хранится как private course-wide attachment.

```text
course_asset
- id UUID PK
- owner_account_id UUID NOT NULL
- course_id UUID NOT NULL
- storage_bucket TEXT NOT NULL
- storage_path TEXT NOT NULL
- original_filename TEXT NOT NULL
- mime_type TEXT NOT NULL
- size_bytes BIGINT NOT NULL
- checksum_sha256 TEXT NOT NULL
- status ENUM(pending, ready)
- created_at TIMESTAMPTZ
```

Course workspace открывает assets отдельным действием «Материалы курса».
Успешная загрузка не означает semantic parsing. Browser flow использует signed
access и пользовательский JWT, а не service role.

## 30. LessonComponent

Lesson непосредственно владеет одним ordered list компонентов.

```text
lesson_component
- id UUID PK
- lesson_id UUID NOT NULL
- type_key TEXT NOT NULL
- schema_version INT NOT NULL
- position INT NOT NULL
- payload JSONB NOT NULL
- placement JSONB NOT NULL DEFAULT {}
- visibility ENUM(staff_only, learner_visible)
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

Между Lesson и LessonComponent нет Step, root Step, Slide, Placement entity или
compatibility group. `(lesson_id, position)` уникален; mutations сохраняют
плотный порядок.

## 31. Ownership and reuse

LessonComponent принадлежит ровно одной Lesson. Для повторного использования
пользователь или AI явно копирует валидированный component payload в другую
Lesson; последующее редактирование не меняет независимые копии автоматически.

CourseAsset может использоваться несколькими компонентами того же Course через
asset ID внутри валидированного payload. Service проверяет, что asset имеет
`ready` status и принадлежит Course текущего actor.

Future reusable library может быть добавлена отдельным решением, но она не
вставляет новую обязательную сущность между Lesson и ordered Components и не
является частью текущего Definition of Done.

## 32. Lesson surfaces

Для выбранной Lesson существуют три UI-поверхности:

1. **План урока** — полный ordered list LessonComponent;
2. **Student Screen** — та же последовательность после server-side фильтра
   `visibility=learner_visible`;
3. **Домашнее задание** — отдельный persisted contract, не компонентная группа.

Название Lesson и teacher comment — поля Lesson. Course materials находятся в
header Course и не являются четвёртой Lesson tab.

## 33. Component mutations

Application service предоставляет операции create/update/delete/reorder через
`lessonId` или `componentId`. Payload и placement валидируются соответствующим
registry definition до записи. Reorder работает во всём списке Lesson.

Детерминированный assembler и future AI используют эти же operations. Ни UI,
ни MCP не передают внутренний parent/group ID помимо `lessonId`.

## 34. Visibility

MVP использует:

```text
staff_only
learner_visible
```

- `staff_only`: component доступен только владельцу Course;
- `learner_visible`: component доступен владельцу и learner projection.

Student Screen API физически исключает `staff_only` rows и не полагается на
CSS. После фильтра сохраняется относительный Lesson order.

---

# Часть IX. Домашние задания

## 35. Общая модель

Homework является самостоятельной частью Lesson и редактируется отдельно от основного содержания.

Lesson может иметь:

1. общее домашнее задание для всей аудитории;
2. индивидуальное переопределение для конкретного LearnerProfile.

## 36. HomeworkDefinition

```text
homework_definition
- id UUID PK
- lesson_id UUID NOT NULL
- scope ENUM(common, learner_override)
- learner_profile_id UUID NULL
- title TEXT NULL
- instructions TEXT NULL
- due_rule JSONB NULL
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

Ограничения:

- у Lesson не более одного `common`;
- у Lesson не более одного override для конкретного LearnerProfile;
- `learner_profile_id` обязателен только для `learner_override`.

```text
homework_component
- id UUID PK
- homework_definition_id UUID NOT NULL
- type_key TEXT NOT NULL
- schema_version INT NOT NULL
- position INT NOT NULL
- payload JSONB NOT NULL
- placement JSONB NOT NULL DEFAULT {}
```

Homework может переиспользовать component registry, но его ordered list
принадлежит HomeworkDefinition и не смешивается с `lesson_component`.

## 37. Effective homework

Для конкретного учащегося:

```text
если есть learner_override → используется override
иначе если есть common      → используется common
иначе                        → ДЗ не назначено
```

Общее ДЗ автоматически применяется к текущим и новым участникам аудитории. Индивидуальное ДЗ полностью переопределяет общее.

## 38. Интерфейс ДЗ

Владелец может:

- создать общее ДЗ всей группе;
- создать персональный override;
- скопировать common в персональный вариант;
- сгенерировать индивидуальные варианты AI;
- применить один вариант выбранным учащимся;
- очистить override и вернуть учащегося к common.

UI показывает:

- кому применяется common;
- у кого есть override;
- у кого нет effective homework;
- кто добавлен после подготовки индивидуальных вариантов;
- у кого ДЗ не проверено.

## 39. Выдача и история ДЗ

При фактической выдаче создаётся immutable assignment snapshot.

```text
learner_homework_assignment
- id UUID PK
- learner_profile_id UUID NOT NULL
- lesson_session_id UUID NULL
- source_homework_definition_id UUID NULL
- course_title_snapshot TEXT
- lesson_title_snapshot TEXT
- payload_snapshot JSONB
- assigned_at TIMESTAMPTZ
- due_at TIMESTAMPTZ NULL
- submitted_at TIMESTAMPTZ NULL
- checked_at TIMESTAMPTZ NULL
- status ENUM(assigned, in_progress, submitted, checked, cancelled)
```

Изменение HomeworkDefinition после выдачи не переписывает выданный snapshot.

---

# Часть X. Учебная история

## 40. Принцип независимости

Учебная история:

- принадлежит LearnerProfile;
- не удаляется при удалении Lesson, Course или Group;
- не зависит от текущего названия курса;
- не зависит от текущего содержимого компонента;
- сохраняет snapshot фактов на момент обучения.

Связи с Course/Lesson могут использовать `ON DELETE SET NULL`, но snapshots обязательны.

## 41. LearningRecord

```text
learning_record
- id UUID PK
- learner_profile_id UUID NOT NULL
- lesson_session_id UUID NULL
- source_course_id UUID NULL
- source_lesson_id UUID NULL
- mode ENUM(live, ai_lesson, homework, self_practice, review)
- course_title_snapshot TEXT NOT NULL
- lesson_title_snapshot TEXT NOT NULL
- lesson_position_snapshot INT NULL
- started_at TIMESTAMPTZ
- ended_at TIMESTAMPTZ
- duration_seconds INT
- summary TEXT NULL
- teacher_note TEXT NULL
- created_at TIMESTAMPTZ
```

## 42. LearningEvent

```text
learning_event
- id UUID PK
- learning_record_id UUID NOT NULL
- event_type TEXT NOT NULL
- occurred_at TIMESTAMPTZ NOT NULL
- lesson_component_id UUID NULL
- component_snapshot JSONB NULL
- payload JSONB NOT NULL
```

Примеры событий:

- component_shown;
- answer_submitted;
- answer_checked;
- hint_requested;
- word_seen;
- word_answered_correctly;
- word_answered_incorrectly;
- teacher_observation;
- ai_observation;
- session_pause;
- session_resume.

## 43. Словарный прогресс MVP

Главная учебная единица первой версии — слово.

```text
learner_word_state
- learner_profile_id UUID
- normalized_word TEXT
- language TEXT
- status ENUM(new, learning, familiar, mastered, needs_review)
- confidence NUMERIC
- correct_count INT
- incorrect_count INT
- exposure_count INT
- last_seen_at TIMESTAMPTZ
- next_review_at TIMESTAMPTZ NULL
- updated_at TIMESTAMPTZ
- PRIMARY KEY (learner_profile_id, language, normalized_word)
```

Расширенная taxonomy навыков и компетенций не входит в MVP.

## 44. AI inferences

```text
learner_inference
- id UUID PK
- learner_profile_id UUID NOT NULL
- category TEXT NOT NULL
- statement TEXT NOT NULL
- confidence NUMERIC NOT NULL
- evidence JSONB NOT NULL
- status ENUM(proposed, confirmed, rejected, expired)
- created_by_ai_job_id UUID NOT NULL
- confirmed_by_account_id UUID NULL
- created_at TIMESTAMPTZ
- resolved_at TIMESTAMPTZ NULL
```

Постоянно влияющие на персонализацию выводы подтверждаются человеком. Групповой learner profile не создаётся.

---

# Часть XI. Чат и уведомления

## 45. Единый мессенджер

Чат открывается как глобальная панель поверх интерфейса. Пользователь не переходит по Course для проверки сообщений.

Для каждого Course с аудиторией автоматически существует один thread:

- индивидуальный Course: владелец + учащийся;
- групповой Course: владелец + текущие учащиеся Group.

Название thread совпадает с названием Course. Guardian не включается.

## 46. ChatThread

```text
chat_thread
- id UUID PK
- type ENUM(course)
- course_id UUID UNIQUE NOT NULL
- title_snapshot TEXT NOT NULL
- created_at TIMESTAMPTZ
```

## 47. ChatMessage

Отправителем может быть Account или LearnerProfile.

```text
chat_message
- id UUID PK
- thread_id UUID NOT NULL
- sender_account_id UUID NULL
- sender_learner_profile_id UUID NULL
- body TEXT NOT NULL
- reply_to_message_id UUID NULL
- created_at TIMESTAMPTZ
- edited_at TIMESTAMPTZ NULL
- deleted_at TIMESTAMPTZ NULL
```

CHECK constraint требует ровно одного sender.

## 48. Участники thread

Участники вычисляются из Course audience.

При изменении Group:

- новый участник получает доступ к thread;
- удалённый участник теряет доступ к новым сообщениям;
- membership материализуется с датами вступления и выхода для корректной авторизации.

## 49. Уведомления

Уведомление адресуется Account либо LearnerProfile.

Категории MVP:

- upcoming_lesson;
- lesson_started;
- homework_assigned;
- homework_due;
- homework_submitted;
- homework_checked;
- chat_message;
- guardian_invitation;
- learner_claim_invitation;
- ai_job_completed;
- ai_job_failed;
- ai_quota_low.

Guardian-чат в MVP отсутствует.

---

# Часть XII. AI-native архитектура

## 50. AI provider

Первичная интеграция строится через OpenRouter-compatible adapter. Конкретная модель не зашивается в доменную логику.

Модели конфигурируются по use case:

- course planning;
- lesson generation;
- component generation;
- editing;
- AI lesson;
- teacher copilot;
- embeddings.

## 51. AI-режимы MVP

### 51.1 Screen-based AI lesson

AI:

- ведёт учащегося по Student Screen;
- пишет сообщения;
- задаёт вопросы;
- проверяет ответы;
- выбирает следующий доступный learner-visible Component;
- предлагает подсказки;
- сохраняет события;
- формирует proposed inferences.

### 51.2 Teacher copilot

Во время live session AI:

- видит разрешённый контекст;
- предлагает следующую реплику;
- предлагает следующий learner-visible Component;
- помогает сформулировать обратную связь;
- подготавливает заметки;
- не меняет runtime component cursor без tool action;
- не отправляет сообщения учащемуся без разрешённого режима автодействий.

### 51.3 Не входит в MVP

- realtime voice agent;
- видеопреподаватель;
- avatar lip sync;
- непрерывное распознавание голоса;
- синтез речи в реальном времени.

## 52. AI tools

AI не выполняет SQL и не получает service-role credentials.

Минимальный development/internal MCP первого milestone регистрирует ровно пять
tools:

```text
course.create_draft
course.get
course.add_lesson
lesson.add_component
lesson.reorder_component
```

Он не регистрирует tool создания Step и не принимает `stepId`. Более поздний
AI/tool registry может добавить, например:

```text
course.update
lesson.update
lesson.delete
lesson.update_component
lesson.delete_component
set_common_homework
set_learner_homework_override
create_learning_note
propose_learner_inference
search_source_chunks
estimate_ai_change
apply_change_set
undo_change_set
```

Каждый tool:

- имеет Zod schema и JSON Schema;
- проверяет actor и ownership;
- проверяет доступ к аудитории;
- валидирует component payload и placement через code-first registry;
- принимает idempotency key там, где нужно;
- пишет audit event.

## 53. Change sets

AI-редактирование выполняется через change set.

```text
ai_change_set
- id UUID PK
- account_id UUID NOT NULL
- status ENUM(draft, awaiting_confirmation, applying, applied, failed, reverted)
- target_type TEXT
- target_id UUID
- operations JSONB
- estimated_units INT
- applied_at TIMESTAMPTZ NULL
- reverted_at TIMESTAMPTZ NULL
- created_at TIMESTAMPTZ
```

Перед применением пользователь видит описание, список затрагиваемых сущностей, приблизительный расход, destructive operations и возможность undo.

Подтверждение обязательно для:

- удаления Lesson, Component или CourseAsset;
- массовой замены;
- изменения большого числа Lesson;
- перегенерации целого Course;
- назначения массового Homework;
- действий, затрагивающих LearnerProfile.

## 54. MCP

MCP является единым программным слоем AI-инструментов.

Первый сервер — локальный `stdio` adapter для development. Он вызывает тот же
CourseBuilderApplicationService, что UI, и не обращается к таблицам напрямую.
В дальнейшем тот же registry используется внутренним AI ShiDao, Codex, ChatGPT
и внешними AI-клиентами.

Внешний MCP-доступ не включается до появления OAuth/scoped tokens, rate limits, per-tool permissions, audit и revocation.

## 55. AI quota

Лимит относится к Account.

```text
ai_usage_ledger
- id UUID PK
- account_id UUID NOT NULL
- job_id UUID NULL
- operation_type TEXT
- model TEXT
- input_tokens INT
- output_tokens INT
- provider_cost NUMERIC NULL
- billed_units INT NOT NULL
- created_at TIMESTAMPTZ
```

```text
ai_quota_period
- account_id UUID
- period_start DATE
- period_end DATE
- included_units INT
- used_units INT
- bonus_units INT
- PRIMARY KEY (account_id, period_start)
```

UI показывает progress bar `использовано / доступно`, estimated units до операции и фактический расход после неё. Тарифные значения задаются конфигурацией и не фиксируются в этом документе.

---

# Часть XIII. Sources, RAG и фоновые задачи

## 56. Source library

```text
source_document
- id UUID PK
- owner_account_id UUID NOT NULL
- type ENUM(pdf, docx, text, markdown, image, audio, web_page, note)
- title TEXT NOT NULL
- file_id UUID NULL
- source_url TEXT NULL
- raw_text TEXT NULL
- status ENUM(uploaded, extracting, chunking, embedding, ready, failed)
- error_code TEXT NULL
- error_message TEXT NULL
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

## 57. Форматы первого релиза

Поддерживаются:

- PDF с текстовым слоем;
- DOCX;
- TXT;
- Markdown;
- изображения;
- аудио;
- веб-страницы;
- ручные заметки.

Не поддерживаются в MVP:

- OCR сканированных PDF;
- сложное восстановление таблиц;
- автоматический обход всего сайта;
- DRM-контент;
- скрытые или авторизованные веб-страницы.

## 58. Pipeline

```text
upload/import
→ validate
→ extract/transcribe/fetch
→ normalize
→ chunk
→ embed
→ index
→ ready
```

```text
source_chunk
- id UUID PK
- source_document_id UUID NOT NULL
- ordinal INT NOT NULL
- content TEXT NOT NULL
- metadata JSONB
- embedding VECTOR
- token_count INT
- created_at TIMESTAMPTZ
```

## 59. Queue

Используется PostgreSQL-backed очередь.

```text
background_job
- id UUID PK
- type TEXT NOT NULL
- status ENUM(queued, running, succeeded, failed, cancelled)
- priority INT
- account_id UUID NULL
- payload JSONB
- progress NUMERIC
- attempts INT
- max_attempts INT
- run_after TIMESTAMPTZ
- locked_at TIMESTAMPTZ NULL
- locked_by TEXT NULL
- error JSONB NULL
- created_at TIMESTAMPTZ
- started_at TIMESTAMPTZ NULL
- completed_at TIMESTAMPTZ NULL
```

Требования:

- `FOR UPDATE SKIP LOCKED`;
- retries с backoff;
- idempotency;
- timeout;
- cancellation;
- progress;
- dead-letter visibility;
- отдельный worker process.

## 60. Контекст AI

AI может видеть данные, к которым текущий пользователь имеет доступ.

Каждый вызов сохраняет actor, цель, перечень контекстных сущностей, модель, token usage, applied tools, результат и ошибки.

Секреты, PIN hashes, Auth credentials и service keys никогда не попадают в AI context.

---

# Часть XIV. Авторизация и безопасность

## 61. Общая модель доступа

Основной пользовательский доступ проверяется через RLS и строго типизированный server authorization layer.

`service_role` разрешён только для:

- worker;
- migrations;
- системных административных операций;
- выдачи ограниченной profile-session;
- операций, которые нельзя выполнить пользовательским JWT.

Нельзя использовать service role как обычный способ чтения всех данных в web routes.

## 62. Ownership policies

Account имеет полный доступ к своим Course, Group, CourseAsset, SourceDocument и
AI jobs.

LearnerProfile session имеет доступ только к собственному profile, назначенным
занятиям, learner-visible Student Screen Components, Homework, LearningRecord,
доступным chat threads и разрешённым CourseAsset.

Guardian имеет доступ только к связанным LearnerProfile и разрешённым данным.

## 63. Audit

```text
audit_event
- id UUID PK
- actor_account_id UUID NULL
- actor_learner_profile_id UUID NULL
- action TEXT NOT NULL
- target_type TEXT NULL
- target_id UUID NULL
- metadata JSONB
- ip_hash TEXT NULL
- user_agent TEXT NULL
- created_at TIMESTAMPTZ
```

Аудируются invitation, guardian link, claim, PIN reset, login failures, account merge, destructive operations, AI change sets, quota changes, permission failures и service-role operations.

## 64. Сессии

Поддерживаются:

- Supabase Auth session для Account;
- profile-session для login/PIN.

Profile-session:

- подписана сервером;
- имеет TTL;
- привязана к learner_profile_id;
- имеет session version;
- может быть отозвана guardian;
- не предоставляет Account-возможности;
- хранится в secure httpOnly cookie.

---

# Часть XV. API и серверная архитектура

## 65. Принципы API

- Next.js App Router;
- server actions или route handlers;
- единый domain/service layer;
- Zod validation;
- без SQL из React components;
- без service role в UI layer;
- стабильные error codes;
- idempotency для mutations;
- API не раскрывает таблицы напрямую.

## 66. Модули

```text
src/
  app/
  modules/
    accounts/
    learner-profiles/
    invitations/
    groups/
    courses/
    lessons/
    sessions/
    components/
    course-assets/
    homework/
    learning-history/
    chat/
    notifications/
    sources/
    ai/
    mcp/
    jobs/
    audit/
  shared/
    auth/
    db/
    errors/
    validation/
    observability/
```

Каждый module содержит domain, repository, service, schemas, authorization, API и tests.

## 67. Запрещённые legacy abstractions

В новом коде отсутствуют:

```text
methodology
methodology_lesson
lesson_step
lesson_slide
catalog_material как обязательный parent Lesson content
scheduled_lesson как копия урока
parent table
teacher table
student table
active global role
lesson_one_custom_v1
fixture fallback
legacy lesson renderer
```

`LessonSession` не является копией Lesson. Это событие проведения.

---

# Часть XVI. Пользовательский интерфейс

## 68. Главная навигация

Минимальные разделы:

- Курсы;
- Группы;
- Учащиеся;
- Источники;
- Календарь;
- Чат;
- AI usage;
- Настройки.

Переключателя «преподаватель / родитель» нет.

## 69. Курсы

Карточка Course показывает:

- название;
- аудиторию;
- количество созданных Lesson;
- `создано N из targetLessonCount`;
- ближайшую LessonSession;
- AI generation status;
- наличие незаполненного Homework;
- архивность.

## 70. Редактор урока

Header Course содержит:

- название и основные сведения Course;
- действие «Настройки»;
- действие «Материалы курса» для private course-wide attachments.

Слева пользователь выбирает Lesson или открывает modal «Добавить урок».
Название Lesson обязательно и хранится как поле Lesson, а не как Component.

Для выбранной Lesson доступны:

1. План урока — полный ordered list Components;
2. Student Screen — learner-visible projection того же списка;
3. Homework — отдельный Lesson contract;
4. future Schedule/session history и AI panel по мере реализации.

Component добавляется из registry palette, редактируется, удаляется,
перемещается во всём Lesson list и переключается между `staff_only` и
`learner_visible`.

## 71. Student experience

Учащийся видит:

- ближайшие занятия;
- текущий Student Screen;
- Homework;
- свою учебную историю;
- слова;
- сообщения;
- уведомления.

Учащийся не видит staff-only Components, private Course attachments, private AI
notes, данные других учащихся и Course как редактируемый документ.

## 72. Guardian experience

Guardian видит:

- связанные LearnerProfile;
- календарь;
- Homework;
- результаты;
- слова;
- подтверждённые AI-выводы;
- настройки детского входа.

Guardian не видит staff-only Components, private Course attachments, внутренний
chat Course, данные других учащихся и provider prompts.

## 73. Chat

Chat:

- доступен из любой страницы;
- открывается боковой панелью;
- содержит course threads;
- показывает unread count;
- поддерживает replies;
- не требует открытия Course;
- не содержит guardian thread в MVP.

## 74. AI progress

При AI-операции UI показывает:

- этап;
- progress;
- создаваемые сущности;
- estimated units;
- фактический расход;
- возможность отменить queued job;
- change set;
- undo после применения.

---

# Часть XVII. Удаление и жизненный цикл

## 75. Удаление Course и Lesson

Удаление Course:

- удаляет его Lesson;
- удаляет принадлежащие им LessonComponent;
- удаляет будущие LessonSession;
- удаляет или архивирует принадлежащие CourseAsset после проверки storage
  references;
- не удаляет LearningRecord;
- не удаляет LearnerWordState;
- не удаляет issued Homework snapshots;
- не удаляет подтверждённые AI inferences.

Удаление Lesson:

- удаляет документ, его LessonComponent и будущие sessions;
- не удаляет LearningRecord;
- не удаляет выданное Homework.

## 76. Удаление LearnerProfile

В MVP используется archive вместо обычного физического удаления. Физическое удаление требует отдельного privacy flow.

## 77. Удаление CourseAsset

При попытке удаления:

- UI показывает Components, payload которых ссылается на asset;
- service не оставляет сломанные references;
- storage object удаляется только после успешной авторизованной DB mutation;
- AI не удаляет используемый CourseAsset без подтверждения.

---

# Часть XVIII. Миграция

## 78. Стратегия

Миграция выполняется как контролируемая in-place реконструкция. Код продолжает развиваться в `main`, а новая прикладная модель создаётся в том же PostgreSQL/Supabase-контуре, который использовала V1.

### Шаг 1. Зафиксировать исходное состояние — выполнено 3 августа 2026 года

- snapshot commit: `51a8bdaf177e5803f0f2aa5f9bc1f9d3b14c4842`;
- архивная ветка: `archive/v1-2026-08-03`;
- аннотированный тег: `v1-snapshot-2026-08-03`;
- полный проверенный Git bundle со всей историей и refs;
- полный логический backup PostgreSQL: `pg_dumpall` и custom-format dump;
- холодный снимок PostgreSQL data directory;
- снимок `db-config` volume с ключом pgsodium;
- снимок физического Storage volume;
- снимок Docker Compose, `.env`, вспомогательных volumes, metadata контейнеров и версий образов;
- аварийный API-export прикладных таблиц, `auth.users`, Storage objects и OpenAPI schema;
- сохранённая конфигурация deployed V1 и Coolify.

Основная локальная копия находится в `.local-backups/v1-snapshot-2026-08-03` и исключена из Git. Вторая копия хранится на DB VDS в `/root/shidao-backups/v1-snapshot-2026-08-03`. Архив содержит secrets и пользовательские данные, поэтому не коммитится и не публикуется без шифрования.

Git bundle, SQL gzip, custom dump, cold data archive, db-config, Storage и Compose archive прошли структурную проверку; SHA-256 локальных и серверных копий совпали. После снимка тот же Supabase stack был запущен без пересоздания: 13 контейнеров вернулись к исходным образам, health endpoints ответили HTTP 200, хеш `.env` не изменился, контрольные количества записей совпали.

Полная репетиция восстановления на отдельном одноразовом VDS ещё не выполнялась. Она обязательна перед превращением текущего тестового контура в production, но не блокирует реконструкцию тестового проекта.

### Шаг 2. Продолжить разработку в текущем контуре

- продолжать работу непосредственно в `main`;
- использовать `v2.shidao.ru` на текущем web deployment и текущий Supabase stack;
- сохранять `auth.users`, password hashes, GoTrue, SMTP, email confirmation, JWT/API keys и Storage service configuration;
- удалять legacy code и создавать новые schema, UI, worker, MCP и AI tools по этапам;
- изменять прикладные таблицы текущей базы миграциями;
- перед каждой миграцией сверять проект по read-only schema sanity check;
- после изменения модели обновлять `docs/database/current-schema.md` и `supabase/schema/current-schema.sql`;
- сохранить архивную методику только в неизменяемом recovery set; не делать её
  dependency активной V2 или prerequisite удаления legacy tables.

Отдельный репозиторий, отдельная ветка V2 и отдельный Supabase-проект не создаются. Архивные refs и backup V1 остаются неизменяемой точкой возврата.

### Шаг 3. Контролируемая перестройка прикладной схемы

На время разрушительного переключения web заменяется страницей «сервис в разработке».

Далее:

- остановить worker;
- отключить старые mutations;
- сделать дополнительный актуальный pre-reset backup текущего состояния, если появившиеся после снимка V1 данные нужно сохранить;
- сохранить `auth`, служебные схемы Supabase, роли, extensions и серверную конфигурацию;
- удалить прикладную `public` schema;
- очищать только явно признанные ненужными Storage objects, не удаляя Storage service и его служебную конфигурацию;
- применить новую baseline;
- создать Account для каждого существующего `auth.users`;
- создать LearnerProfile для пользователей, которые ранее были учащимися;
- не создавать LearnerProfile автоматически для остальных;
- при наличии отдельно подготовленного и проверенного direct-component seed
  загрузить его как обычный Course/Template; отсутствие такого seed не
  возвращает Methodology в baseline;
- выполнить smoke tests;
- включить новое приложение.

Полный PostgreSQL cluster не удаляется и новый Supabase-проект не создаётся.

### Шаг 4. Проверка и откат

До включения V2 проверяются Postgres, Auth, REST, Realtime, Storage, вход существующего пользователя, email confirmation, отправка почты, основные RLS-сценарии и ключевые пользовательские маршруты.

Если требуется вернуть V1 целиком:

1. Остановить V2 и Supabase stack.
2. При необходимости отдельно сохранить текущее состояние V2.
3. Восстановить зафиксированные Compose/`.env`, PostgreSQL data или логический dump, `db-config` и Storage volume из одного согласованного snapshot.
4. Запустить Supabase на сохранённых версиях образов и проверить health Postgres, Auth, REST и Storage.
5. Развернуть `archive/v1-2026-08-03` либо `v1-snapshot-2026-08-03` с сохранённым Coolify environment.
6. Проверить вход, основные чтения/RPC и сохранённые Storage objects.

Операция восстановления выполняется только по отдельному явному решению, потому что она перезаписывает текущее состояние базы.

### Шаг 5. Удалить legacy из активной версии

Сразу после успешной перестройки:

- удалить старые migrations из `main`;
- удалить legacy docs и code;
- удалить старые SQL fixtures и test snapshots;
- удалить старые routes, redirects и ID mappings.

Архивные branch/tag, Git bundle и recovery snapshot не удаляются. Период параллельной эксплуатации legacy-модели не требуется.

## 79. Baseline migration

```text
supabase/migrations/
  00000000000000_baseline.sql
  00000000000001_seed_system_data.sql
```

Будущий direct-component Template seed может быть отдельным idempotent script,
но не является частью active schema model.

Эти файлы становятся активной baseline только после проверки на текущем Supabase-контуре. Старые migrations можно удалить из `main`, потому что их неизменённая копия уже зафиксирована в архивной ветке, теге и Git bundle.

## 80. Существующие Auth-пользователи

Для каждого существующего `auth.users` в той же базе создаётся Account. Экспорт/import между Supabase-проектами не выполняется, Auth-запись и её UUID не заменяются.

Приоритет display name:

1. подтверждённое имя из текущих прикладных данных;
2. user metadata;
3. login/email prefix;
4. технический placeholder с запросом заполнения.

Существующий пароль, подтверждённый email и действующие настройки входа продолжают работать, потому что Auth-запись, GoTrue и SMTP/email confirmation configuration не заменяются.

---

# Часть XIX. Производительность и масштаб

## 81. Плановые ориентиры

Система проектируется минимум для:

- нескольких тысяч Account;
- нескольких тысяч LearnerProfile;
- 300–500 одновременных live sessions как целевого запаса;
- 15–30 Lesson в среднем Course;
- большого числа private CourseAsset и LessonComponent;
- фоновой AI-генерации;
- будущего появления сотен организаций без их реализации в MVP.

## 82. Live updates

Основной механизм — Supabase Realtime.

Требования:

- подписка только на конкретную LessonSession;
- version для предотвращения пропущенных обновлений;
- reconnect;
- fallback fetch;
- отсутствие polling каждые 2 секунды как основной архитектуры;
- серверная проверка membership на каждое действие.

## 83. Индексы

Обязательные индексы:

- owner IDs;
- Course audience FKs;
- Lesson `(course_id, position)`;
- LessonComponent `(lesson_id, position)`;
- CourseAsset `(course_id, created_at)`;
- Session `(lesson_id, scheduled_at)`;
- active Group membership;
- Chat `(thread_id, created_at)`;
- unread Notifications;
- LearningRecord `(learner_profile_id, started_at)`;
- LearningEvent `(learning_record_id, occurred_at)`;
- WordState `(learner_profile_id, status)`;
- Jobs `(status, run_after, priority)`;
- vector index для source chunks;
- Invitation token hash;
- AI usage `(account_id, created_at)`.

---

# Часть XX. Наблюдаемость

## 84. Логи

Structured logs содержат request_id, actor, route/action, duration, status, error code, AI job ID и LessonSession ID.

PIN, токены, credentials, secrets и полный prompt payload в обычные логи не записываются.

## 85. Метрики

Минимальные метрики:

- web request latency и error rate;
- active live sessions;
- realtime reconnects;
- job queue depth и age;
- AI success/failure и provider latency;
- token usage и quota exhaustion;
- source processing failures;
- file upload failures;
- invitation acceptance;
- PIN login failures.

## 86. Alerts

Alerts создаются для:

- production health failure;
- остановки worker;
- backlog очереди;
- повторяющихся AI provider failures;
- database connection exhaustion;
- storage failure;
- высокой частоты auth failures;
- realtime degradation.

---

# Часть XXI. Тестирование и CI/CD

## 87. Обязательные проверки

```text
install
typecheck
lint
unit tests
database schema reset
RLS authorization tests
integration tests
build
Playwright smoke tests
```

## 88. Критические сценарии

### Account и LearnerProfile

- существующий Auth пользователь входит после reset;
- Account не получает глобальную роль;
- создание собственного LearnerProfile;
- profile без Account;
- несколько guardians;
- PIN login и lockout;
- самостоятельный claim;
- защита от дубля Account.

### Course

- личное владение;
- отсутствие шеринга;
- audience none/learner/group;
- копирование;
- Template instantiation;
- изменение Group не меняет Course;
- `N из targetLessonCount`.

### Lesson и Session

- несколько sessions одного Lesson;
- derived status;
- live runtime и Realtime;
- повторное проведение;
- удаление Lesson не удаляет LearningRecord.

### Components и Course assets

- Component непосредственно принадлежит Lesson;
- у Lesson один плотный ordered component list;
- add/update/delete/reorder не требуют Step/Slide/group ID;
- Student Screen сохраняет порядок после фильтра `learner_visible`;
- `staff_only` отсутствует в learner projection;
- payload/placement проходят registry schema validation;
- Component не может сослаться на чужой или pending CourseAsset;
- signed Storage access проверяет ownership.

### Homework

- common homework;
- learner override;
- новый участник наследует common;
- отсутствие common показывает unassigned;
- immutable issued snapshot.

### AI

- tools не обходят ownership;
- change set preview;
- confirmation и undo;
- quota;
- cancellation и retry;
- MCP schemas;
- no secrets in context.

### Security

- RLS IDOR tests;
- learner не читает другого learner;
- guardian видит только связанного learner;
- learner не видит `staff_only` Components и private CourseAsset;
- service role не используется в обычном user flow.

## 89. Accessibility и locale

MVP:

- русский интерфейс;
- архитектура готова к i18n;
- keyboard navigation;
- focus management;
- semantic HTML;
- accessible dialogs;
- contrast;
- aria labels;
- screen reader support основных flows;
- даты в timezone пользователя.

---

# Часть XXII. План реализации

## 90. Этап 0 — подготовка

- зафиксировать snapshot commit V1 — выполнено;
- создать и отправить архивную ветку и тег V1 — выполнено;
- создать и проверить полный Git bundle — выполнено;
- создать полный логический и физический snapshot Supabase/PostgreSQL/Storage — выполнено;
- сохранить полный локальный recovery set и отдельную серверную копию критических DB/Supabase-архивов с совпадающими SHA-256 — выполнено;
- исключить recovery set и локальную SSH-конфигурацию из Git — выполнено;
- продолжить реконструкцию в `main` и существующем Supabase-контуре — принятое решение;
- оставить на `shidao.ru` только лендинг и закрыть старые внутренние URL — выполнено;
- подключить `v2.shidao.ru` к тому же Coolify application — выполнено;
- разрешить `v2.shidao.ru/auth/confirm` в GoTrue без замены SMTP/Auth — выполнено;
- задокументировать проверку и процедуру восстановления V1 — выполнено, см. `docs/operations/v1-recovery-runbook.md`;
- настроить CI;
- при необходимости настроить страницу «сервис в разработке»;
- подготовить Account bootstrap для существующих `auth.users`;
- до публичного production-запуска отрепетировать полное восстановление на одноразовом VDS.

## 90.1 Первый вертикальный milestone — teacher course builder demo

До расширения AI/RAG/live-функций реализуется короткий доказуемый workflow:

```text
Курсы → Новый курс → форма и вложения → persisted Course
→ Lesson → ordered registry Components → Student Screen preview
```

Milestone включает минимальный code-first registry, Course workspace, десять базовых component types, простой assembler и development-only MCP adapter над общими application commands.

Полный scope, ограничения и Definition of Done находятся в
`docs/v2/TEACHER_COURSE_BUILDER_DEMO_MILESTONE.md`. Этот milestone разрешает
реализовать минимальный сквозной срез Course domain, Component platform и
CourseAsset Storage до завершения всех возможностей соответствующих этапов. Он
не разрешает обходить ownership/RLS, возвращать Step/Methodology compatibility,
смешивать teacher-private данные со Student Screen или публиковать внешний MCP
endpoint.

## 91. Этап 1 — новый фундамент

- baseline schema;
- Account;
- LearnerProfile;
- Guardian;
- profile login/PIN;
- invitations;
- RLS;
- audit;
- navigation.

## 92. Этап 2 — Course domain

- Group;
- Course;
- Template;
- Lesson;
- LessonSession;
- calendar;
- copy Course;
- optional archive-to-direct-component importer как отдельная будущая задача.

## 93. Этап 3 — Component platform

- code-first registry;
- direct LessonComponent;
- dense ordered mutations;
- teacher plan;
- learner-visible Student Screen projection;
- universal renderers;
- private CourseAsset Storage.

## 94. Этап 4 — обучение

- live runtime;
- Student Screen;
- optional current-component cursor without authored Step entity;
- LearningRecord;
- LearningEvent;
- WordState;
- teacher notes;
- AI inferences.

## 95. Этап 5 — Homework и коммуникации

- common Homework;
- individual overrides;
- assignment snapshots;
- unified Chat;
- Notifications.

## 96. Этап 6 — AI и RAG

- OpenRouter adapter;
- queue и worker;
- source pipeline;
- embeddings;
- MCP;
- tools;
- change sets;
- quotas;
- AI lesson;
- teacher copilot.

## 97. Этап 7 — переключение текущего контура на V2

- maintenance page;
- свежий pre-reset backup при наличии новых ценных данных;
- preserve Auth, GoTrue, SMTP, email confirmation, JWT/API keys и Storage service configuration;
- reset public schema;
- baseline;
- Account bootstrap;
- student-profile bootstrap;
- optional direct-component seed только если он отдельно подготовлен и проверен;
- smoke tests;
- launch.

---

# Часть XXIII. Definition of Done

Рефакторинг завершён, когда:

1. Старое приложение не используется.
2. Старые прикладные таблицы и миграции отсутствуют.
3. Все существующие Auth-пользователи могут войти.
4. Account не имеет глобальной роли.
5. Global role switch отсутствует.
6. Школы и организации отсутствуют в UI, API и schema.
7. Course имеет одного owner и не более одной audience.
8. Course может существовать без audience.
9. Course показывает target lesson count.
10. Lesson не имеет preparation status.
11. LessonSession отделена от Lesson.
12. Один Lesson имеет несколько sessions.
13. Lesson непосредственно владеет одним ordered list LessonComponent без
    Step/root Step, Slide или compatibility group.
14. План урока показывает полный список, а Student Screen server projection —
    только `learner_visible` Components в том же относительном порядке.
15. Add/update/delete/reorder Component работают через `lessonId`/`componentId`
    и сохраняют плотные уникальные позиции в пределах Lesson.
16. CourseAsset хранится в private Storage, проверяется по ownership и не
    объявляется проанализированным без фактического parsing pipeline.
17. UI, application service, MCP и future AI используют единый code-first
    component registry и сгенерированные из него schemas.
18. В active V2 нет Methodology domain, уникальных lesson renderers или fixture
    fallback; исторический source остаётся только в архиве.
19. Common Homework работает.
20. Individual Homework override работает.
21. Learning history переживает удаление Course/Lesson.
22. Word progress рассчитывается.
23. Unified course Chat работает.
24. Guardian не включён в course Chat.
25. AI lesson без голоса работает.
26. Teacher copilot работает.
27. Development MCP регистрирует канонические пять tools
    (`course.create_draft`, `course.get`, `course.add_lesson`,
    `lesson.add_component`, `lesson.reorder_component`), работает поверх
    application service и не публикуется внешне без security layer.
28. AI использует только typed tools.
29. AI quota видна пользователю.
30. Реконструкция выполнена в текущем контуре без замены Auth-проекта и повторной настройки SMTP/email confirmation; будущий staging, если он создан, изолирован.
31. CI проверяет schema, RLS, integration и build.
32. `v2.shidao.ru` разворачивается из чистого baseline без legacy dependencies.
33. Архивные refs, Git bundle и полный recovery snapshot V1 сохранены и не изменяются вместе с V2.
34. Процедура восстановления V1 документирована, а перед публичным production-запуском проверена на одноразовом окружении.
35. `shidao.ru` показывает только лендинг с неактивными Auth-кнопками, а остальные page/API URL возвращают HTTP 503.
36. `v2.shidao.ru` закрыт от индексации до явного решения о публичном запуске.

---

# Часть XXIV. Явно отложено

Не входит в текущий MVP:

- школы;
- организации;
- организационные роли;
- передача Course;
- совместное редактирование;
- несколько преподавателей Course;
- публичный marketplace;
- Course sharing;
- guardian chat;
- realtime voice AI;
- видеопреподаватель;
- OCR сканированных PDF;
- сложная taxonomy навыков;
- group learner profile;
- автоматическая перегенерация при изменении Group;
- автоматический переход ребёнка во взрослый режим;
- глобальные типы Account;
- role switch;
- legacy compatibility;
- старые URL redirects.

---

# Часть XXV. Решения, которые нельзя менять неявно

1. Один Account соответствует одному человеку.
2. Нет глобальных ролей.
3. Нет школ и организаций в MVP.
4. Один Course принадлежит одному Account.
5. Нет передачи и совместного владения.
6. Одна аудитория на Course.
7. Для другой Group создаётся копия Course.
8. Group может участвовать в нескольких Course.
9. Изменение Group не меняет Course автоматически.
10. Нет карты несуществующих Lesson.
11. Lesson и LessonSession разделены.
12. Один Lesson может проводиться многократно.
13. История принадлежит LearnerProfile.
14. Course/Lesson можно удалить без потери истории.
15. Lesson непосредственно содержит один ordered list Components; Step/root
    Step/Slide не являются active domain entities.
16. CourseAsset является course-wide private attachment; Component может
    ссылаться на него только после ownership/status validation.
17. Homework поддерживает common и learner override.
18. Guardian не участвует в course Chat.
19. AI lesson MVP не использует realtime voice.
20. Все существующие Supabase Auth users сохраняются.
21. Старые прикладные данные и миграции не сохраняются в активной версии `main`, но остаются в recovery snapshot V1.
22. Реконструкция выполняется в ветке `main` существующего репозитория, без отдельного репозитория V2.
23. Реконструкция выполняется в текущем Supabase/PostgreSQL-контуре, без отдельной базы V2.
24. Текущие Auth users, password hashes, GoTrue, SMTP, email confirmation и JWT/API configuration сохраняются.
25. Архивная ветка, тег, Git bundle и recovery snapshot V1 не изменяются и не удаляются в ходе реконструкции.
26. `shidao.ru` является публичным landing-only доменом без доступа к Auth и внутренним маршрутам.
27. Рабочая V2 доступна на `v2.shidao.ru` в том же Coolify/Supabase-контуре.
28. `staging.shidao.ru` является необязательным будущим окружением; если оно создаётся, то полностью изолируется.

---

# Приложение A. Карта основных таблиц

```text
account
learner_profile
learner_guardian
learner_profile_credential
invitation

learner_group
learner_group_member

course
lesson
lesson_component
course_asset
lesson_session
lesson_session_runtime

homework_definition
homework_component
learner_homework_assignment

learning_record
learning_event
learner_word_state
learner_inference

chat_thread
chat_thread_membership
chat_message
notification

stored_file
source_document
source_chunk

background_job
ai_change_set
ai_usage_ledger
ai_quota_period

audit_event
```

---

# Приложение B. Приоритет component types

## P0

- heading;
- rich text;
- callout;
- quote;
- divider;
- image;
- slideshow;
- single-choice poll;
- matching game;
- file.

## P1

- audio;
- video;
- flashcards;
- teacher note;
- instruction;
- vocabulary list;
- word card;
- single-choice quiz;
- short text response;
- open task;
- multiple-choice quiz;
- matching;
- ordering;
- fill-in-the-gap.

## P2

- AI assistant block;
- сложные интерактивные components;
- специализированные предметные компоненты.

---

# Приложение C. Основания спецификации

Документ сформирован на основании:

1. Исходного состояния репозитория `istominvi/shidao`, использованного при подготовке первой редакции, на commit `d173d5cde83888e1bbe33850d1e4456de4a4c355`.
2. `shidao_final_ai_course_builder_spec(1).md`.
3. `Модель пользовательских аккаунтов и учебных профилей ShiDao.pdf`.
4. Уточнений владельца продукта, полученных после анализа исходной архитектуры.
5. Зафиксированного снимка V1 на commit `51a8bdaf177e5803f0f2aa5f9bc1f9d3b14c4842`, branch `archive/v1-2026-08-03` и tag `v1-snapshot-2026-08-03`.
6. Проверенного recovery set `.local-backups/v1-snapshot-2026-08-03` и его серверной копии на DB VDS.
7. Решения владельца продукта от 3 августа 2026 года продолжить реконструкцию в `main` и в текущем Supabase/PostgreSQL-контуре.
8. Решения владельца продукта от 4 августа 2026 года использовать каноническую
   модель `Course → Lesson → ordered Components` без Step/root Step и без
   активного Methodology domain.
