# Deploy ShiDao (Next.js) в Coolify

## 1) Подготовка
1. Создайте приложение **Next.js** в Coolify и подключите этот репозиторий.
2. Build command: `npm run build`
3. Start command: `npm run start`
4. Port: `3000`

## 2) Переменные окружения
Заполните из `.env.example`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

## 3) Миграции в Supabase
1. Откройте SQL Editor в Supabase.
2. Примените файл `supabase/migrations/202603260001_init_auth_and_roles.sql`.
3. Проверьте создание таблиц и RLS-политик.

## 4) Smoke checks
- `/` открывается (landing)
- `/auth` открывается
- `/dashboard/teacher`, `/dashboard/parent`, `/dashboard/student` открываются
