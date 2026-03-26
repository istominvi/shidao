# ShiDao MVP Bootstrap

Базовый интерфейс Demo-версии на Next.js + миграции Supabase.

## Запуск
```bash
npm install
npm run dev
```

## Маршруты
- `/` — Landing
- `/auth` — Единый вход/регистрация взрослого + отдельный вход ученика
- `/dashboard/teacher`
- `/dashboard/parent`
- `/dashboard/student`

## Миграции
SQL миграции лежат в `supabase/migrations`.

## Документы
- `docs/tz.md`
- `docs/autorization.md`
- `docs/deploy-coolify.md`
