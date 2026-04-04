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
- `/join/check-email` — экран подтверждения отправки письма (используется только когда email confirmation обязателен)
- `/auth/confirm` — серверный callback для подтверждения email из письма
- `/login` — единый вход для взрослых и учеников
- `/onboarding` — создание первого взрослого профиля (`parent` или `teacher`)
- `/dashboard` — единый приватный маршрут кабинета
- `/settings/security` — управление PIN и настройками безопасности

## Auth и routing модель
- Один взрослый auth-аккаунт может иметь `parent`, `teacher` или оба профиля.
- Ученик — отдельный auth-аккаунт и отдельная сессия.
- Роли больше не живут в URL (нет `/dashboard/teacher`, `/dashboard/parent`, `/dashboard/student`, `/dashboard/select-profile`).
- Взрослый после первого входа без профиля направляется на `/onboarding`.
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
6. После успешного входа: установка app-session cookie, best-effort ensure `user_preference`, и route resolution (`/onboarding` для взрослых без профиля, иначе `/dashboard`).
7. В server logs пишется диагностический этап, если flow падает.

## Signup и email-confirm режимы
### Self-hosted/dev режим (`ENABLE_EMAIL_AUTOCONFIRM=true`)
- `/join` создаёт взрослого пользователя в Supabase Auth.
- После успешной регистрации пользователь уходит на `/login?registered=1`.
- UI не обещает письмо и не отправляет на `/join/check-email`.
- SMTP не обязателен для прохождения signup → login в этом режиме.

### Email-confirm режим (`ENABLE_EMAIL_AUTOCONFIRM=false`)
- После регистрации пользователь попадает на `/join/check-email`.
- Подтверждение email проходит через `/auth/confirm`, после чего пользователь направляется на `/login`.


## Email auth / SMTP (self-hosted Supabase)
- В production/self-hosted режиме email auth проходит через Supabase Auth (GoTrue) и SMTP-провайдера VK WorkSpace (`smtp.mail.ru`).
- Для нашего VPS рабочий SMTP submission-порт: `2525` (а не стандартные `25/465/587`, которые были недоступны на сетевом уровне).
- Подробная практическая документация (архитектура, рабочие env, known issues, runbook): `docs/email-auth-selfhosted-supabase.md`.

## User preference
Таблица `public.user_preference` хранит:
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

Примечание по self-hosted совместимости:
- если RPC `ensure_user_preference` или `set_last_active_profile` отсутствует, серверный слой использует fallback через direct PostgREST upsert/patch.

## User security + PIN
Таблица `public.user_security` хранит:
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
Ключевая миграция для preference/security функций: `202604030001_user_preference_and_security.sql`.
