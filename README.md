# ShiDao MVP

Продуктовый MVP на Next.js + Supabase (Auth + Postgres), обновлённый под school-centered модель.

## Запуск
```bash
npm install
npm run dev
```

## Основные маршруты
- `/` — лэндинг
- `/join` — единая регистрация для родителей и преподавателей
- `/login` — единый вход: email взрослого или логин ученика
- `/onboarding` — создание первого профиля (`parent` или `teacher`)
- `/dashboard/select-profile` — выбор профиля, если у пользователя есть и `parent`, и `teacher`
- `/dashboard/teacher` — кабинет преподавателя
- `/dashboard/parent` — кабинет родителя
- `/dashboard/student` — кабинет ученика

## Авторизация и маршрутизация
- Все аккаунты аутентифицируются через `auth.users` (Supabase Auth).
- После входа маршрутизация:
  1. если есть профиль `student` по `student.user_id` → `/dashboard/student`
  2. если есть оба профиля `teacher` и `parent` → `/dashboard/select-profile`
  3. если только `teacher` → `/dashboard/teacher`
  4. если только `parent` → `/dashboard/parent`
  5. иначе → `/onboarding`
- Модель не использует концепцию текущей роли пользователя в профиле.

## Текущая модель данных
Доменные таблицы:
- `parent`
- `teacher`
- `student`
- `school`
- `school_teacher`
- `class`
- `class_teacher`
- `class_student`

### Примечание по student login
В таблице `student` есть внутреннее техническое поле `internal_auth_email` для совместимости legacy входа ученика (логин ученика → email в Supabase Auth). Поле не является частью бизнес-домена и не показывается в UI.

## Миграции
SQL миграции находятся в `supabase/migrations`.
Последняя миграция: `202604020001_parent_teacher_school_model.sql`.
