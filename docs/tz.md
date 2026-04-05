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
