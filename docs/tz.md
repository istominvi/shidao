# ТЗ (актуализация доменной модели)

Дата: **2 апреля 2026**.

## Целевая модель

- `parent`
- `teacher`
- `student`
- `school`
- `school_teacher`
- `class`
- `class_teacher`
- `class_student`

## Ограничения модели

- `student` не содержит `teacher_id` и `school_id`.
- Привязка ученика к школе идёт только через `class_student -> class -> school`.
- `parent` и `teacher` — это отдельные сущности, а не роли.

## Онбординг преподавателя

На первом создании `teacher` автоматически создаются:

- школа,
- связь `school_teacher` с ролью `owner`,
- первый класс,
- связь `class_teacher`.

## Student auth compatibility

`student.internal_auth_email` сохранён как внутреннее инфраструктурное поле для безопасного перехода со старого login-flow.

## Teacher information architecture (Step 1, April 7, 2026)

- Операционный центр преподавателя переносится в контекст `class/group`.
- Основные teacher-маршруты:
  - `/dashboard` — обзор преподавателя;
  - `/groups` — список групп;
  - `/groups/[groupId]` — рабочая страница группы.
- `/lessons` сохраняется как вторичный глобальный индекс занятий по всем группам.
- `methodology` остаётся каноническим источником содержания, а `scheduled_lesson` — runtime-сущностью исполнения урока.
- Этот шаг фиксирует IA/read-model/routing направление; полные workflows homework/thread/progress планируются следующими этапами.

## Teacher operations dashboard (Step 2, April 7, 2026)

- `/dashboard` переведён в режим реального teacher command center.
- Добавлены рабочие entry points: создание группы (`/groups/new`) и создание ученика (`/students/new`).
- Добавлен маршрут `/methodologies` как read-only индекс методик, доступный с dashboard.
- Dashboard read-model строится server-side в `teacher-dashboard-operations` и включает:
  - table-first `Мои группы` с progress/status/next-lesson;
  - недельный schedule block по всем группам;
  - attention summary с операционными сигналами.
- `/groups` усилен до полного индексного списка с поиском и фильтрами.
- `/lessons` остаётся вторичным кросс-групповым индексом занятий.
- Намеренно отложено: homework, threads, attendance, full calendar subsystem, methodology/block editors, AI layer.

## Group setup + methodology binding + contextual scheduling (Step 3, April 7, 2026)

- Для `class` введено явное поле назначения методики: `class.methodology_id`.
- Это назначение теперь является основным source of truth для:
  - методики группы на dashboard/groups/group page;
  - denominator прогресса;
  - списка методологических уроков при планировании занятий из контекста группы.
- `/groups/[groupId]` теперь операционно покрывает:
  - назначение/смену методики;
  - roster группы и контекстный вход в создание ученика;
  - планирование занятия без повторного выбора группы.
- Прогресс считается честно:
  - numerator: только `scheduled_lesson.runtime_status = completed`;
  - denominator: общее число уроков в назначенной методике группы.
- Safe backfill в миграции:
  - если у группы все scheduled lessons принадлежат одной методике, она назначается автоматически;
  - при неоднозначности `methodology_id` остаётся `null` и группа помечается как требующая настройки.
- Всё ещё намеренно отложено: homework, thread/communication, attendance, advanced calendar UX, parent/student expansion.
