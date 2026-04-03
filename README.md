# ShiDao MVP

Продуктовый MVP на Next.js + Supabase (Auth + Postgres), обновлённый под единый auth/routing UX.

## Запуск
```bash
npm install
npm run dev
```

## Основные маршруты
- `/` — лэндинг
- `/join` — единая регистрация взрослого аккаунта
- `/join/check-email` — экран подтверждения отправки письма
- `/auth/confirm` — серверный callback для подтверждения email из письма
- `/login` — единый вход для взрослых и учеников
- `/onboarding` — создание первого взрослого профиля (`parent` или `teacher`)
- `/dashboard` — единый приватный маршрут кабинета
- `/settings/security` — управление PIN и настройками безопасности

## Auth и routing модель
- Один взрослый auth-аккаунт может иметь `parent`, `teacher` или оба профиля.
- Ученик — отдельный auth-аккаунт и отдельная сессия.
- Роли больше не живут в URL (нет `/dashboard/teacher`, `/dashboard/parent`, `/dashboard/student`, `/dashboard/select-profile`).
- Взрослый после первого подтверждённого входа без профиля направляется на `/onboarding`.
- При наличии двух взрослых профилей активный кабинет выбирается по `user_preference.last_active_profile` (дефолт: `parent`).
- Переключение профиля делается через dropdown в аватарке, без перелогина и без смены сессии.

## Server-side login resolution
Единый endpoint `POST /api/auth/login` принимает:
- `identifier` (email взрослого / логин ученика / будущий телефон)
- `secret` (пароль или PIN)

Flow:
1. Нормализация identifier.
2. Email-подобный identifier → попытка взрослого password login.
3. Не-email identifier → серверный lookup ученика в `student.internal_auth_email`.
4. Сначала проверка пароля.
5. Если пароль не подошёл и найден пользователь ученика → проверка PIN через `verify_user_pin`.
6. Во всех ошибках наружу возвращаются только безопасные обобщённые сообщения.

## Signup + email confirm
- `/join` регистрирует только взрослый auth-аккаунт.
- Форма `/join` отправляется в серверный endpoint `POST /api/auth/signup` (без direct browser вызова Supabase Auth).
- На signup нет выбора роли, телефона и student signup.
- После регистрации — экран `/join/check-email` с инструкцией подтвердить email и затем войти.
- Подтверждение email проходит через `/auth/confirm`, после чего пользователь направляется на `/login`.
- Выбор роли выполняется только после входа на `/onboarding`.

## User preference
Новая таблица `public.user_preference` хранит:
- `last_active_profile`
- `last_selected_school_id`
- `theme`
- `settings` (jsonb)

Добавлены helpers/RPC:
- `ensure_user_preference`
- `set_last_active_profile`
- `get_last_active_profile`
- `set_last_selected_school`
- `upsert_user_theme`
- `merge_user_settings`

## User security + PIN
Новая таблица `public.user_security` хранит:
- только `pin_hash` (без хранения PIN в открытом виде)
- счётчик неудачных попыток
- временную блокировку (`pin_locked_until`)
- таймстемпы жизненного цикла PIN

Добавлены helpers/RPC:
- `set_user_pin`
- `verify_user_pin`
- `clear_user_pin`
- `reset_pin_attempts`

## Миграции
SQL миграции находятся в `supabase/migrations`.
Ключевая новая миграция: `202604030001_user_preference_and_security.sql`.
