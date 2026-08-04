# ShiDao V1 — runbook восстановления

- **Статус:** проверенный recovery baseline; полная репетиция на отдельном VDS ещё не выполнена
- **Дата снимка:** 3 августа 2026 года
- **V1 commit:** `51a8bdaf177e5803f0f2aa5f9bc1f9d3b14c4842`
- **Ветка:** `archive/v1-2026-08-03`
- **Аннотированный тег:** `v1-snapshot-2026-08-03`
- **Активная разработка:** `main`, `v2.shidao.ru`, существующий self-hosted Supabase

Этот документ предназначен в том числе для нового агента Codex. Он описывает, что было сохранено перед реконструкцией V2 и как безопасно вернуть код, данные или весь V1-контур.

Это только recovery-документ, а не описание active domain. Текущее состояние V2
зафиксировано в [`docs/project-state.md`](../project-state.md), обычное
развёртывание и rollback V2 — в
[`docs/operations/v2-deployment-runbook.md`](./v2-deployment-runbook.md).
Термины Methodology/Step ниже относятся исключительно к исторической V1.

## 1. Главные правила безопасности

1. Восстановление не запускается автоматически и не следует из обычной задачи разработки. Нужна явная команда владельца продукта с указанием требуемого режима восстановления.
2. Полное восстановление V1 означает downtime и перезапись текущего состояния V2. Перед ним обязательно создаётся и проверяется свежий pre-restore snapshot V2, если текущее состояние может представлять ценность.
3. До явного подтверждения допустимы только read-only проверки recovery-артефактов, Git-ссылок, дискового пространства и состояния сервисов.
4. Нельзя удалять, перемещать или переписывать ветку `archive/v1-2026-08-03`, тег `v1-snapshot-2026-08-03` и каталог `.local-backups/v1-snapshot-2026-08-03`.
5. Нельзя делать `git reset --hard` активной ветки `main` ради просмотра V1. Для V1 используется отдельный worktree, отдельный clone или отдельное deployment-окружение.
6. Нельзя выводить в логи или ответы содержимое `.codex/*.local.toml`, Supabase `.env`, Coolify environment, JWT/API keys, SMTP secrets и архивов с private config.
7. Физическое и логическое восстановление PostgreSQL — альтернативные пути. Их нельзя смешивать в одной попытке без отдельного плана.
8. Архивы сначала распаковываются в узкий временный каталог, проверяются и только после этого устанавливаются на целевые пути. Не использовать широкие рекурсивные удаления, невалидированные переменные и пути вроде `/`, `$HOME` или `~`.
9. Первая полная репетиция должна выполняться на одноразовом VDS. Активный V2 demo-контур не является площадкой для первой проверки процедуры.

## 2. Что было подготовлено

Перед началом реконструкции V2 были выполнены следующие действия:

- V1 зафиксирована commit `51a8bdaf177e5803f0f2aa5f9bc1f9d3b14c4842`;
- создана и отправлена в GitHub ветка `archive/v1-2026-08-03`;
- создан и отправлен аннотированный тег `v1-snapshot-2026-08-03`;
- создан полный Git bundle со всей историей и refs;
- создан логический `pg_dumpall` с ролями и всеми базами;
- создан custom-format dump базы `postgres`;
- при остановленном PostgreSQL создан физический архив `volumes/db/data`;
- сохранён Docker volume `supabase_db-config`, включая ключ pgsodium;
- сохранён физический Storage volume;
- сохранены точные Supabase Compose tree, `.env`, supporting volumes, версии образов и container inspect;
- сделан аварийный API-export таблиц, Auth users и Storage objects;
- сохранены Coolify container/image inspect и локальная private-конфигурация;
- recovery-набор исключён из Git через `.gitignore`;
- создана вторая копия критических DB/Supabase-артефактов на DB VDS;
- после снимка прежний Supabase stack был запущен без recreation и прошёл health/count проверки;
- 3 августа 2026 года локальные SHA-256, серверные SHA-256 и Git bundle были повторно проверены.

## 3. Источники восстановления

### 3.1 GitHub

- repository: `istominvi/shidao`;
- branch: `archive/v1-2026-08-03`;
- tag: `v1-snapshot-2026-08-03`;
- tag после dereference обязан указывать на `51a8bdaf177e5803f0f2aa5f9bc1f9d3b14c4842`.

### 3.2 Полный локальный recovery set

Каталог:

```text
.local-backups/v1-snapshot-2026-08-03/
```

Он содержит private data и намеренно не коммитится. Ключевые пути:

```text
repository/shidao-v1-all-refs.bundle
infrastructure/local-private-config.tar.gz
infrastructure/coolify-v1-container-inspect.json.gz
infrastructure/coolify-v1-image-inspect.json.gz
supabase/repository-db-definition.tar.gz
supabase/api-export/
supabase/db-vds/postgres-all.sql.gz
supabase/db-vds/postgres-custom.dump
supabase/db-vds/postgres-data.tar.gz
supabase/db-vds/db-config-volume.tar.gz
supabase/db-vds/storage-volume.tar.gz
supabase/db-vds/supabase-stack-config-and-volumes.tar.gz
```

Внутри recovery set находятся дополнительные private-инструкции:

```text
.local-backups/v1-snapshot-2026-08-03/README.md
.local-backups/v1-snapshot-2026-08-03/RESTORE.md
.local-backups/v1-snapshot-2026-08-03/supabase/db-vds/README.md
```

### 3.3 Серверная копия DB/Supabase

На DB VDS сохранена отдельная копия критических DB/Supabase-архивов:

```text
/root/shidao-backups/v1-snapshot-2026-08-03
```

Доступ выполняется только через локальный secret `.codex/ssh-db.local.toml`. Серверная копия не заменяет локальный Git/Coolify recovery set: Git дополнительно защищён remote refs и bundle, а Coolify/private config находятся в локальном наборе.

## 4. Read-only проверка перед восстановлением

Из корня репозитория:

```bash
git fetch origin --tags
git rev-parse archive/v1-2026-08-03
git rev-parse 'v1-snapshot-2026-08-03^{}'
git bundle verify .local-backups/v1-snapshot-2026-08-03/repository/shidao-v1-all-refs.bundle
shasum -a 256 -c .local-backups/v1-snapshot-2026-08-03/SHA256SUMS.txt
```

Ожидаемый commit ветки и dereferenced tag:

```text
51a8bdaf177e5803f0f2aa5f9bc1f9d3b14c4842
```

На DB VDS:

```bash
cd /root/shidao-backups/v1-snapshot-2026-08-03
sha256sum -c SHA256SUMS.remote.txt
```

Все строки должны завершаться `OK`. Если хотя бы один hash или Git ref не совпадает, остановить восстановление и сообщить владельцу проекта.

## 5. Выбор режима восстановления

### Режим A — только посмотреть или запустить код V1

Использовать, если БД V2 менять не нужно.

- создать отдельный detached worktree или clone;
- checkout immutable tag/commit;
- поднять отдельное временное web-окружение;
- не направлять его на активную изменённую V2-базу, если код V1 может выполнять записи;
- предпочтительно использовать восстановленную копию V1 DB на одноразовом VDS.

Пример безопасного checkout:

```bash
git worktree add --detach ../shidao-v1-restore v1-snapshot-2026-08-03
```

Если GitHub недоступен, использовать bundle:

```bash
git clone .local-backups/v1-snapshot-2026-08-03/repository/shidao-v1-all-refs.bundle ../shidao-v1-restore
git -C ../shidao-v1-restore checkout --detach 51a8bdaf177e5803f0f2aa5f9bc1f9d3b14c4842
```

### Режим B — восстановить только данные

Использовать только после определения точной цели:

- отдельная disposable DB для анализа;
- выборочный logical restore;
- полный logical restore;
- полный physical restore.

Для точного восстановления self-hosted Supabase предпочтителен согласованный physical set: Postgres data + db-config volume + Storage + Compose/.env. `postgres-all.sql.gz` и `postgres-custom.dump` являются независимыми logical fallback-путями.

### Режим C — полностью вернуть V1 на прежние домены

Это наиболее рискованный режим. Он заменяет текущий V2 web и текущие данные состоянием на 3 августа 2026 года. Нужны явное подтверждение владельца, окно недоступности и свежий snapshot V2.

## 6. Preflight для полного восстановления

Перед первым изменяющим действием агент обязан:

1. Зафиксировать, что владелец явно выбрал полный rollback, а не временный просмотр V1.
2. Уточнить допустимый downtime и судьбу текущих V2-данных.
3. Создать fresh snapshot текущего V2, если его нужно сохранить, и проверить его hashes.
4. Сохранить read-only состояние текущих доменов, Coolify application, web environment, GoTrue redirect allowlist и Supabase container/image versions.
5. Проверить свободное место для одновременного хранения V1, V2 и временной распаковки.
6. Проверить все Git refs, bundle и SHA-256 по разделу 4.
7. Прочитать private `README.md` и `RESTORE.md` внутри recovery set.
8. Подготовить обратный план: как вернуть pre-restore V2 snapshot, если V1 не проходит smoke tests.
9. Для первой попытки использовать одноразовый VDS и не менять DNS активного сайта.

## 7. Порядок полного восстановления

### Шаг 1. Остановить записи

- перевести web в maintenance;
- остановить worker/cron/background jobs;
- убедиться, что новые записи в Postgres и Storage больше не появляются;
- записать время начала rollback.

### Шаг 2. Подготовить V1-код

- создать отдельный checkout V1 по immutable tag/commit;
- проверить `HEAD` против `51a8bdaf177e5803f0f2aa5f9bc1f9d3b14c4842`;
- не изменять `main`, архивную ветку или тег;
- восстановить private web environment из recovery set без печати secrets.

### Шаг 3. Восстановить Supabase как согласованный physical set

Использовать версии из `server-runtime.txt`, Compose snapshot и container inspect. Зафиксированная версия PostgreSQL: `supabase/postgres:15.8.1.085`.

Рекомендуемый порядок:

1. Остановить текущий Supabase Compose stack.
2. Проверить, что остановлены все процессы, использующие Postgres data и Storage volume.
3. Распаковать V1-архивы в отдельные временные каталоги и проверить структуру/владельцев файлов.
4. Установить сохранённый Supabase Compose tree и `.env` из `supabase-stack-config-and-volumes.tar.gz`.
5. Установить `postgres-data.tar.gz` как `/supabase/docker/volumes/db/data`.
6. Восстановить `db-config-volume.tar.gz` в Docker volume `supabase_db-config`.
7. Установить `storage-volume.tar.gz` как `/supabase/docker/volumes/storage`.
8. Запустить stack в тех же версиях образов.
9. Дождаться health status всех сервисов до запуска web V1.

Ключ pgsodium и связанный `db-config` должны соответствовать физической копии Postgres. Нельзя брать их из другого окружения.

### Шаг 4. Восстановить web deployment

- развернуть V1 checkout, а не `main`;
- восстановить Coolify environment из private infrastructure archive;
- сверить image/container metadata с сохранёнными inspect-файлами;
- направить `shidao.ru` на V1 только после прохождения внутренних smoke tests;
- `v2.shidao.ru` можно оставить maintenance/disabled до отдельного решения;
- не публиковать MCP или внутренние административные endpoints.

### Шаг 5. Проверить результат

Минимальные контрольные значения V1:

```text
auth.users = 19
methodology = 1
student = 5
scheduled_lesson = 14
Storage communication-media objects = 2
```

Проверить:

- PostgreSQL, Auth, REST и Storage health;
- 13 Supabase containers вернулись к ожидаемым образам и состояниям;
- вход существующего пользователя;
- email confirmation/recovery callback;
- чтение representative public tables и основных RPC;
- загрузку обоих сохранённых Storage objects;
- старые страницы кабинета, расписания и уроков;
- отсутствие подключения V1 web к V2 DB;
- домен и TLS.

Только после этого можно завершать maintenance.

## 8. Logical fallback

Если physical restore невозможен, доступны:

- `postgres-all.sql.gz` — роли и все базы;
- `postgres-custom.dump` — custom-format dump базы `postgres`;
- `supabase/api-export/` — аварийный последний источник отдельных данных и Storage objects.

Logical restore не заменяет автоматически Compose configuration, Auth/GoTrue secrets, JWT/API keys, pgsodium root key и физический Storage. Для него нужен отдельный план совместимости и отдельная проверка ownership/extensions/roles.

## 9. Если восстановление не прошло

1. Не продолжать серию непроверенных исправлений на активном контуре.
2. Вернуть maintenance.
3. Сохранить логи и точное место ошибки без secrets.
4. Если V2 был затронут, восстановить созданный в preflight snapshot V2.
5. Повторить попытку только после анализа на одноразовом окружении.

## 10. Текущий уровень гарантии

На 3 августа 2026 года подтверждено:

- Git branch/tag доступны в GitHub;
- bundle содержит полную историю и проходит `git bundle verify`;
- все локальные файлы из `SHA256SUMS.txt` совпадают;
- все шесть критических server-side DB/Supabase archives совпадают с `SHA256SUMS.remote.txt`;
- архивы прошли структурные проверки при создании;
- исходный Supabase stack после cold snapshot успешно вернулся в работу.

Ещё не подтверждено единственным окончательным способом: полный restore всего набора на отдельном чистом VDS. Эта репетиция обязательна до публичного production launch, но не блокирует работу active V2 customer-demo контура.

## 11. Чек-лист передачи агенту Codex

Перед rollback агент должен кратко сообщить владельцу:

- какой режим A/B/C выбран;
- какие текущие V2-данные будут затронуты;
- создан ли fresh V2 snapshot;
- совпали ли Git refs и SHA-256;
- выполнялась ли попытка на disposable VDS;
- какие домены будут переключены;
- как будет выполнен rollback самого rollback.

Без этих ответов разрешён только read-only аудит recovery set.
