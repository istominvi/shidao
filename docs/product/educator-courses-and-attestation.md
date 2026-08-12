# Курсы для педагогов и аттестация

**Статус:** current production
**Актуально на:** 12 августа 2026 года

## Current production

E1 database contract и demonstration product data применены к production.
Initial dependent API/UI commit
`28387a9863afeccf4a6ad332dcf0f01048a69e67` развёрнут через Coolify, но
последующая authenticated проверка выявила application parsing incident.
Production hotfix исправляет этот application boundary без изменения уже
выданной аттестации или database data.

Каталог Course разделён по учебному назначению, а не по роли Account:

- `children` — «Обучение детей»;
- `educators` — «Обучение педагогов».

Это отдельное поле `course.learning_audience`; operational `audience_type`
по-прежнему описывает roster обычного Course и для этой классификации не
используется. Один roleless Account может создавать, проходить и наблюдать
разные учебные сценарии без переключения типа пользователя.

Audience toggle находится в одной toolbar-строке с поиском,
фильтрами и выбором вида. При смене направления каталог очищает masked error
state перед отображением нового результата.

У опубликованного курса для педагогов есть итоговая вкладка «Аттестация».
Определение теста принадлежит authored Course, но попытка выполняется только
против immutable current publication revision. Клиент передаёт выбранные
варианты; score и факт прохождения вычисляет одна транзакционная DB-функция по
закрытому answer key. Успешный результат создаёт durable Account award.

Badge «Аттестован» в заголовке относится только к текущей опубликованной
редакции. Учебный профиль сохраняет ранее выданные результаты и явно отмечает,
если курс уже имеет другую редакцию или недоступен. Результат означает
прохождение теста внутри ShiDao и не заявляется государственным удостоверением
о повышении квалификации.

## Production incident и hotfix

Authenticated read-only проверка подтвердила один educator Course в catalog
RPC и одну credential с `certified=true` в profile RPC. Следовательно, сообщения
об отсутствии связи и невозможности выполнить операцию не отражали состояние
сети или базы: данные и RPC projection были доступны.

Причиной был более узкий application contract. Deterministic bootstrap создаёт
publication, revision и snapshot identifiers через `md5(...)::uuid`; это
допустимые UUID PostgreSQL, но RFC-strict `z.uuid` отклонял их при разборе
ответа. Application использует единый PostgreSQL UUID contract на основе
`z.guid` для этих границ и добавляет regression tests для такого формата. В тот
же hotfix входят очистка masked error state при переключении направления и
inline-размещение audience toggle в общей toolbar. Release gate прошёл:
typecheck, lint, format, build, unit `527/527` и strict production-mode browser
suite `22/22`, включая educator catalog, reload и profile credential.

## Граница безопасности

- Владелец Course не считается участником и не получает результат от факта
  владения или копирования.
- До успешной отправки browser projection не содержит правильных ответов и
  объяснений.
- Attempts и awards закрыты от прямой браузерной записи; выдача происходит
  вместе со scoring.
- Отправка содержит ожидаемый revision ID; если Course обновился между
  загрузкой и проверкой, сервер отклоняет устаревшую форму. На одну revision
  принимается не более пяти попыток Account за 15 минут.
- Educator publication можно скопировать в авторский Course только после
  аттестации по current revision: иначе копия раскрыла бы владельцу answer key.
  После допуска переносится определение теста, но попытки и awards не
  копируются. Допуск проверяется до Storage copy и повторно внутри DB clone.
- Новая publication revision требует повторной аттестации для badge текущей
  редакции, не удаляя исторический результат из профиля.

## Current production: первый демонстрационный курс

Отдельный идемпотентный bootstrap завершился `COMMIT` в
`2026-08-12T03:10:45Z`. Он создал и опубликовал курс «Современный урок
китайского языка для детей: произношение, иероглифика и формирующее
оценивание» с шестью Lessons, шестью Components, шестью Slides и итоговым
тестом из десяти вопросов. Реальная попытка дала `9/10 = 90%` при пороге
`80%`, `passed=true`, и создала один Account award через обычный scoring RPC.

Финальный authenticated postflight подтвердил `certified=true`, все `10`
review keys доступны только после award, а профиль содержит одну credential по
этому курсу. В production ровно один такой educator Course, одна published
publication с одним immutable definition, одна attempt и одна award.

Bootstrap требует явные psql vars `publisher_account_id` и
`attested_account_id`. Значения Account UUID и email не фиксируются в tracked
files; demonstration product data живут в отдельном bootstrap, а не в schema
migration.

## Later

- лицензированный issuer, юридически значимое удостоверение и проверяемый
  certificate number;
- enrollment/consumption всей программы курса, progress и deadlines;
- proctoring, ручная проверка и задания со свободным ответом;
- policy повторных попыток и срок действия результата.
