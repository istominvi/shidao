# ShiDao — глобальная спецификация полного рефакторинга

**Статус:** утверждённая архитектурная спецификация  
**Проект:** `istominvi/shidao`  
**Базовая ветка:** `main`  
**Зафиксированный исходный commit:** `d173d5cde83888e1bbe33850d1e4456de4a4c355`  
**Основной домен:** `shidao.ru`  
**Staging:** `staging.shidao.ru`  
**Дата фиксации решений:** 26 июля 2026 года

---

## 1. Назначение документа

Этот документ является единым источником требований для полного рефакторинга ShiDao.

Целевая система проектируется как новый продукт внутри существующего репозитория и существующего инфраструктурного контура. Старые прикладные модели, таблицы, миграции, маршруты, компоненты, fallback-данные и совместимость с предыдущей архитектурой не сохраняются.

Основная цель — построить простую, расширяемую и AI-native платформу, в которой:

- один аккаунт соответствует одному человеку;
- роли не являются типами аккаунта;
- учебная история хранится отдельно от изменяемого контента;
- курс является личным документом владельца;
- курс содержит уроки;
- уроки используют материалы из единого каталога;
- один материал применяется повторно и обновляется централизованно;
- курс назначается одному учащемуся, одной группе либо никому;
- проведение урока отделено от документа урока;
- AI изменяет продукт только через типизированные инструменты;
- MCP является общим программным интерфейсом для внутренних и будущих внешних AI-клиентов.

---

# Часть I. Границы рефакторинга

## 2. Greenfield внутри существующего проекта

Рефакторинг считается greenfield-разработкой на уровне прикладного кода и прикладной базы данных.

Разрешено и требуется:

- удалить всю текущую прикладную схему базы данных;
- удалить старые миграции;
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
- переписать конфигурацию приложения, базы, Auth, Storage и deployment-процессов.

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

1. Репозиторий `istominvi/shidao` и его Git-история.
2. Физические серверы, если они подходят целевой архитектуре.
3. Coolify как платформа развёртывания.
4. Домен `shidao.ru`.
5. Новый staging-домен `staging.shidao.ru`.
6. Текущая Supabase Auth-база и все существующие `auth.users`.
7. Возможность входа существующих пользователей с текущими логинами и паролями.
8. Текущая методика как основа нового системного шаблона ShiDao после конвертации.

Пароли не извлекаются, не расшифровываются и не переносятся в открытом виде. Сохраняются существующие записи Supabase Auth и их password hashes.

## 4. Источник истины после рефакторинга

После переключения:

- единственным источником истины для схемы является новая baseline-миграция;
- старые миграции отсутствуют;
- старые таблицы отсутствуют;
- старые TypeScript-данные и fixtures отсутствуют;
- документация обновлена под новую модель;
- код не содержит проверок legacy ID, legacy URL или legacy lesson type;
- проект разворачивается с нуля одной последовательностью команд.

---

# Часть II. Инфраструктура и окружения

## 5. Окружения

### 5.1 Production

- Web: `https://shidao.ru`
- На время разработки: статическая страница «ShiDao находится в разработке».
- После запуска: production-версия приложения.
- Содержит сохранённые существующие Auth-аккаунты.
- Не содержит старых прикладных данных.

### 5.2 Staging

- Web: `https://staging.shidao.ru`
- Полноценное тестовое приложение.
- Отдельная база данных.
- Отдельный Supabase Auth.
- Отдельные Storage buckets.
- Отдельные JWT/API keys и secrets.
- Отдельная очередь задач.
- Отдельные AI-лимиты.
- Только синтетические тестовые данные.

Допускается размещение production и staging на одних физических серверах, но они не используют общие базы, buckets, Auth-пользователей, очереди или secrets.

## 6. Deployment

В Coolify создаются как минимум:

- `shidao-production-web`;
- `shidao-production-worker`;
- `shidao-staging-web`;
- `shidao-staging-worker`;
- production Supabase environment;
- staging Supabase environment.

Каждое окружение имеет независимые health checks и журналы.

## 7. Переменные окружения

Имена переменных разрешено изменить. Целевая конфигурация разделяется по подсистемам.

```env
APP_ENV=
APP_BASE_URL=
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

Production и staging не используют общие secrets.

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
11. Урок является редактируемым документом.
12. Проведение урока является отдельной сущностью.
13. Один урок может проводиться неоднократно.
14. Материал хранится в каталоге один раз.
15. Урок хранит ссылки и размещения материалов.
16. Изменение материала распространяется на все уроки, которые на него ссылаются.
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
- создавать материалы;
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

Guardian не получает доступ к закрытым материалам владельца курса и не участвует в чатах курса в MVP.

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
- не перегенерирует материалы;
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

Копирование создаёт новые Course, Lesson, LessonSlide, Placement и HomeworkDefinition.

CatalogMaterial по умолчанию не копируются: новый Course ссылается на те же материалы.

## 22. Системный шаблон ShiDao

Текущая методика конвертируется в новый системный Template `ShiDao`.

Требования:

- удалить старые methodology IDs;
- преобразовать контент в Lesson;
- преобразовать элементы в CatalogMaterial;
- преобразовать ученический экран в LessonSlide и Placement;
- преобразовать педагогические заметки в teacher-surface placements;
- удалить уникальные renderer'ы;
- использовать только универсальный registry;
- проверить шаблон на staging;
- загрузить его в production после reset.

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
- current_slide_id UUID NULL
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
- current_slide_id UUID NULL
- runtime_state JSONB
- version BIGINT
- updated_at TIMESTAMPTZ
```

Команды:

```text
start_session
set_current_slide
next_slide
previous_slide
end_session
cancel_session
```

Ученический клиент получает изменения через Supabase Realtime. Polling допускается только как fallback.

---

# Часть VIII. Материалы и реестр компонентов

## 27. Material Type Registry

Реестр типов материалов является code-first.

```ts
interface MaterialTypeDefinition<TPayload, TPlacement> {
  key: string;
  version: number;
  category: string;
  title: string;
  payloadSchema: ZodSchema<TPayload>;
  placementSchema: ZodSchema<TPlacement>;
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
    teacher?: React.ComponentType;
    student?: React.ComponentType;
    preview?: React.ComponentType;
  };
}
```

JSON Schema генерируется из того же источника для MCP и AI tools.

Не допускаются:

- дублирующиеся schema definitions;
- renderer, зависящий от ID конкретного Lesson;
- условия по названию методики;
- fallback на TypeScript fixture.

## 28. Начальные типы материалов

Минимальный набор:

- rich text;
- heading;
- image;
- audio;
- video;
- file;
- teacher note;
- instruction;
- vocabulary list;
- word card;
- flashcards;
- single-choice quiz;
- multiple-choice quiz;
- short text response;
- matching task;
- ordering task;
- fill-in-the-gap;
- open task;
- AI assistant block.

## 29. CatalogMaterial

Материал хранится в личном каталоге пользователя и не принадлежит конкретному Course.

```text
catalog_material
- id UUID PK
- owner_account_id UUID NULL
- ownership_scope ENUM(personal, system)
- type_key TEXT NOT NULL
- title TEXT NOT NULL
- current_revision_id UUID NOT NULL
- archived_at TIMESTAMPTZ NULL
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

Отдельный раздел «материалы уровня курса» не создаётся.

## 30. MaterialRevision

```text
material_revision
- id UUID PK
- material_id UUID NOT NULL
- revision_number INT NOT NULL
- schema_version INT NOT NULL
- payload JSONB NOT NULL
- created_by_account_id UUID NULL
- created_by_ai_job_id UUID NULL
- change_summary TEXT NULL
- created_at TIMESTAMPTZ
```

Lesson всегда отображает `current_revision_id`.

Ревизии нужны для undo, восстановления, AI-аудита, расследования ошибок и фиксации версии материала в учебной истории. Пользователь не выбирает ревизию в обычном flow.

## 31. Повторное использование

Один CatalogMaterial может использоваться:

- в нескольких Course;
- в нескольких Lesson;
- на нескольких Student Slides;
- несколько раз на одном Slide;
- в teacher document;
- в homework.

Обновление CatalogMaterial меняет отображение во всех текущих местах использования.

## 32. Lesson surfaces

В Lesson есть две независимые поверхности:

1. `teacher_document`;
2. `student_screen`.

Teacher document не обязан повторять структуру Student Screen. Student Screen состоит из слайдов.

```text
lesson_slide
- id UUID PK
- lesson_id UUID NOT NULL
- position INT NOT NULL
- title TEXT NULL
- settings JSONB
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

## 33. Placement

```text
material_placement
- id UUID PK
- lesson_id UUID NOT NULL
- surface ENUM(teacher_document, student_screen)
- slide_id UUID NULL
- material_id UUID NOT NULL
- position INT NOT NULL
- visibility ENUM(staff_only, learner_visible, guardian_visible)
- placement_config JSONB NOT NULL DEFAULT {}
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

Правила:

- для `student_screen` обязателен `slide_id`;
- для `teacher_document` `slide_id` равен NULL;
- payload хранится в MaterialRevision;
- layout, размер, подпись и параметры показа хранятся в `placement_config`;
- assessment-логика материала хранится в payload.

## 34. Visibility

MVP использует:

```text
staff_only
learner_visible
guardian_visible
```

- `staff_only`: только владелец Course;
- `learner_visible`: владелец и учащиеся аудитории;
- `guardian_visible`: владелец, учащийся и guardians именно этого учащегося.

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
homework_material_placement
- id UUID PK
- homework_definition_id UUID NOT NULL
- material_id UUID NOT NULL
- position INT NOT NULL
- placement_config JSONB
```

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
- не зависит от текущего содержимого материала;
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
- material_id UUID NULL
- material_revision_id UUID NULL
- payload JSONB NOT NULL
```

Примеры событий:

- material_shown;
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
- material generation;
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
- выбирает следующий доступный материал;
- предлагает подсказки;
- сохраняет события;
- формирует proposed inferences.

### 51.2 Teacher copilot

Во время live session AI:

- видит разрешённый контекст;
- предлагает следующую реплику;
- предлагает материал или слайд;
- помогает сформулировать обратную связь;
- подготавливает заметки;
- не переключает слайды без tool action;
- не отправляет сообщения учащемуся без разрешённого режима автодействий.

### 51.3 Не входит в MVP

- realtime voice agent;
- видеопреподаватель;
- avatar lip sync;
- непрерывное распознавание голоса;
- синтез речи в реальном времени.

## 52. AI tools

AI не выполняет SQL и не получает service-role credentials.

Примеры tools:

```text
get_course
list_course_lessons
create_lesson
update_lesson
reorder_lessons
delete_lesson
create_material
update_material
place_material
move_placement
remove_placement
create_slide
update_slide
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
- валидирует material payload;
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

- удаления Lesson или Material;
- массовой замены;
- изменения большого числа Lesson;
- перегенерации целого Course;
- назначения массового Homework;
- действий, затрагивающих LearnerProfile.

## 54. MCP

MCP является единым программным слоем AI-инструментов.

Первый потребитель — внутренний AI ShiDao. В дальнейшем тот же registry используется для Codex, ChatGPT и внешних AI-клиентов.

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

Account имеет полный доступ к своим Course, Group, CatalogMaterial, SourceDocument и AI jobs.

LearnerProfile session имеет доступ только к собственному profile, назначенным занятиям, Student Screen, Homework, LearningRecord, доступным chat threads и разрешённым materials.

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
    materials/
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
- Материалы;
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

Основные области:

1. Teacher document.
2. Student Screen slides.
3. Homework.
4. Schedule и session history.
5. AI panel.

Материал перетаскивается из каталога или создаётся AI.

Редактирование CatalogMaterial предупреждает, что изменение появится во всех references, и показывает количество мест использования.

## 71. Student experience

Учащийся видит:

- ближайшие занятия;
- текущий Student Screen;
- Homework;
- свою учебную историю;
- слова;
- сообщения;
- уведомления.

Учащийся не видит teacher document, staff-only materials, private AI notes, данные других учащихся и Course как редактируемый документ.

## 72. Guardian experience

Guardian видит:

- связанные LearnerProfile;
- календарь;
- Homework;
- результаты;
- слова;
- подтверждённые AI-выводы;
- настройки детского входа.

Guardian не видит teacher document, staff-only materials, внутренний chat Course, данные других учащихся и provider prompts.

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
- удаляет будущие LessonSession;
- удаляет placements;
- не удаляет CatalogMaterial;
- не удаляет LearningRecord;
- не удаляет LearnerWordState;
- не удаляет issued Homework snapshots;
- не удаляет подтверждённые AI inferences.

Удаление Lesson:

- удаляет документ и будущие sessions;
- не удаляет LearningRecord;
- не удаляет CatalogMaterial;
- не удаляет выданное Homework.

## 76. Удаление LearnerProfile

В MVP используется archive вместо обычного физического удаления. Физическое удаление требует отдельного privacy flow.

## 77. Удаление Material

При попытке удаления:

- UI показывает references;
- предлагается archive;
- hard delete запрещён, пока существуют placements;
- AI не удаляет используемый Material без подтверждения.

---

# Часть XVIII. Миграция

## 78. Стратегия

Миграция выполняется как контролируемый reset.

### Шаг 1. Зафиксировать исходное состояние

- сохранить commit;
- сделать технический backup БД;
- экспортировать список `auth.users`;
- проверить вход существующих пользователей;
- экспортировать текущую методику для трансформации.

Backup является только страховочным техническим артефактом и не становится частью новой модели.

### Шаг 2. Создать staging

- отдельный deployment;
- отдельный Supabase;
- новая baseline;
- synthetic data;
- end-to-end tests.

### Шаг 3. Реализовать новую систему

- удалить legacy code;
- создать новую schema и UI;
- создать worker и MCP;
- создать AI tools;
- конвертировать ShiDao template.

### Шаг 4. Production reset

Production web заменяется страницей «сервис в разработке».

Далее:

- остановить production worker;
- отключить старые mutations;
- сохранить `auth` schema;
- удалить прикладную `public` schema;
- очистить ненужные Storage objects;
- применить новую baseline;
- создать Account для каждого существующего `auth.users`;
- создать LearnerProfile для пользователей, которые ранее были учащимися;
- не создавать LearnerProfile автоматически для остальных;
- загрузить системный ShiDao template;
- выполнить smoke tests;
- включить новое приложение.

### Шаг 5. Удалить legacy

Сразу после успешного reset:

- удалить старые migrations;
- удалить legacy docs и code;
- удалить старые SQL fixtures и test snapshots;
- удалить старые routes, redirects и ID mappings.

Период наблюдения legacy-модели не требуется.

## 79. Baseline migration

```text
supabase/migrations/
  00000000000000_baseline.sql
  00000000000001_seed_system_data.sql
  00000000000002_seed_shidao_template.sql
```

Seed шаблона может быть отдельным idempotent script.

## 80. Существующие Auth-пользователи

Для каждого `auth.users` создаётся Account.

Приоритет display name:

1. подтверждённое имя из текущих прикладных данных;
2. user metadata;
3. login/email prefix;
4. технический placeholder с запросом заполнения.

Существующий пароль продолжает работать, потому что Auth-запись не заменяется.

---

# Часть XIX. Производительность и масштаб

## 81. Плановые ориентиры

Система проектируется минимум для:

- нескольких тысяч Account;
- нескольких тысяч LearnerProfile;
- 300–500 одновременных live sessions как целевого запаса;
- 15–30 Lesson в среднем Course;
- большого числа файлов;
- повторного использования Materials;
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

### Materials

- единый CatalogMaterial;
- использование в нескольких Lesson;
- update появляется во всех placements;
- revision и undo;
- visibility;
- schema validation.

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
- learner не видит staff material;
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

- создать архитектурную ветку;
- зафиксировать текущий commit;
- создать staging domain;
- создать staging Supabase;
- настроить CI;
- настроить production placeholder;
- подготовить Auth preservation script.

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
- ShiDao template converter.

## 93. Этап 3 — Material platform

- registry;
- CatalogMaterial;
- revisions;
- teacher surface;
- slides;
- placements;
- universal renderers;
- file storage.

## 94. Этап 4 — обучение

- live runtime;
- Student Screen;
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

## 97. Этап 7 — production reset

- production maintenance page;
- preserve Auth;
- reset public schema;
- baseline;
- Account bootstrap;
- student-profile bootstrap;
- system template;
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
13. Student Screen работает через Slides.
14. Teacher document независим от Student Screen.
15. Materials хранятся в каталоге.
16. Lesson ссылаются на Materials.
17. Изменение Material распространяется на references.
18. Уникальных lesson renderers и fixture fallback нет.
19. Common Homework работает.
20. Individual Homework override работает.
21. Learning history переживает удаление Course/Lesson.
22. Word progress рассчитывается.
23. Unified course Chat работает.
24. Guardian не включён в course Chat.
25. AI lesson без голоса работает.
26. Teacher copilot работает.
27. MCP используется внутренним AI.
28. AI использует только typed tools.
29. AI quota видна пользователю.
30. Production и staging изолированы.
31. CI проверяет schema, RLS, integration и build.
32. `shidao.ru` разворачивается из чистого baseline без legacy dependencies.

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
15. Material является общей ссылочной сущностью.
16. Обновление Material применяется во всех references.
17. Homework поддерживает common и learner override.
18. Guardian не участвует в course Chat.
19. AI lesson MVP не использует realtime voice.
20. Все существующие Supabase Auth users сохраняются.
21. Старые прикладные данные и миграции не сохраняются.
22. Staging расположен на `staging.shidao.ru`.
23. Production расположен на `shidao.ru`.

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
lesson_session
lesson_session_runtime
lesson_slide

catalog_material
material_revision
material_placement

homework_definition
homework_material_placement
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

# Приложение B. Приоритет material types

## P0

- rich text;
- image;
- teacher note;
- instruction;
- vocabulary list;
- word card;
- single-choice quiz;
- short text response;
- open task;
- file.

## P1

- audio;
- video;
- flashcards;
- multiple-choice quiz;
- matching;
- ordering;
- fill-in-the-gap.

## P2

- AI assistant block;
- сложные интерактивные materials;
- специализированные предметные компоненты.

---

# Приложение C. Основания спецификации

Документ сформирован на основании:

1. Текущего состояния репозитория `istominvi/shidao` на commit `d173d5cde83888e1bbe33850d1e4456de4a4c355`.
2. `shidao_final_ai_course_builder_spec(1).md`.
3. `Модель пользовательских аккаунтов и учебных профилей ShiDao.pdf`.
4. Уточнений владельца продукта, полученных после анализа исходной архитектуры.
