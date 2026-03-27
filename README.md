# ShiDao MVP Bootstrap

Демо-интерфейс на Next.js + Supabase миграции для MVP-модели данных.

## Запуск
```bash
npm install
npm run dev
```

## Маршруты
- `/` — Landing
- `/auth` — единый экран входа (взрослый/ученик), обе ветки используют Supabase Auth
- `/dashboard/teacher`
- `/dashboard/parent`
- `/dashboard/student`

## MVP-схема БД (Supabase)
Используются **только** таблицы домена:
- `adult`
- `adult_role`
- `organization`
- `student`

Ключевые правила:
- В MVP у ученика ровно один ответственный взрослый (`student.owner_adult_id`).
- Ответственный взрослый может быть `parent` или `teacher` (`student.owner_kind`).
- Таблиц `student_guardian_link` и `student_credentials` больше нет.
- Источник истины для аутентификации — Supabase Auth (`auth.users`), без custom password hash в доменных таблицах.

## Миграции
SQL-миграции находятся в `supabase/migrations`.

## Документы
- `docs/tz.md`
- `docs/autorization.md`
- `docs/deploy-coolify.md`
