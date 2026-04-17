# Teacher Lesson Runtime V1

## Канонический маршрут

- Канонический runtime-урок для teacher/student/parent остаётся: `/lessons/[scheduledLessonId]`.
- V1 не вводит параллельный runtime surface и не меняет role-aware routing.

## Целевой teacher-сценарий (V1)

`назначенный урок → выдача ДЗ → статусы по ученикам → переход в коммуникацию`

## Что делает Teacher Runtime V1

### 1) Оперативная сводка в teacher runtime

На teacher-странице урока добавлен верхний operational summary, который собирает в одном месте:

- статус проведения урока (`runtimeShell.runtimeStatus`);
- факт выдачи ДЗ;
- агрегаты по ДЗ (`assigned/submitted/reviewed/needs_revision`);
- сигналы по коммуникации (количество lesson-scoped и homework-scoped сообщений);
- shortlist учеников, требующих внимания (доработка, отправлено/не проверено, активная переписка).

Сводка строится из существующего read model (`workspace.projection.runtimeShell`, `workspace.homework`, `workspace.communication`) без новой схемы данных.

### 2) Homework tab как рабочая поверхность teacher

Вкладка ДЗ теперь работает как operational work surface:

- заметный issued/not-issued state и подсказка следующего шага;
- компактные KPI-чипы по выдаче/сдаче/проверке;
- отдельный индикатор «на проверку»;
- roster отсортирован по приоритету (needs_revision → submitted → assigned → reviewed);
- inline review actions в каждой строке ученика;
- в строке ученика видны коммуникационные сигналы и быстрые переходы к lesson/homework обсуждениям.

### 3) Интеграция коммуникации в workflow

Teacher может перейти из статуса ученика в профильный диалог без выхода из контекста:

- ссылка на lesson discussion;
- ссылка на homework discussion;
- счётчики сообщений рядом со статусом ученика.

## Что НЕ менялось в V1

- Не добавлялись новые таблицы/колонки и не создавались миграции.
- Не переписывался communication/homework backend service слой.
- Не менялась каноническая модель learner/parent runtime, кроме сохранения совместимости с teacher workflow.

## Что оставлено для V2

- SLA/recency сигналы (например, «новое за N часов», «последний ответ teacher/student»).
- Явные фильтры roster на UI (только «на проверку», только «доработка»).
- Сводные bulk-actions по проверке.
- Rich preview коммуникации (последнее сообщение + timestamp/author chips).
