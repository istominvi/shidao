# ShiDao MVP

Продуктовый MVP на Next.js + self-hosted Supabase (Auth + Postgres). Текущее состояние: auth и routing уже унифицированы, основной приватный маршрут — единый `/dashboard`.

## Запуск
```bash
npm install
npm run dev
```

Перед запуском обязательно задайте `APP_SESSION_SECRET` (и в dev, и в prod):
```bash
# Пример: сгенерировать 32 байта (64 hex-символа) секрета
openssl rand -hex 32
```
```bash
APP_SESSION_SECRET=<your-generated-secret>
```
Требования:
- переменная обязательна, fallback-значений нет;
- минимальная длина — `32` символа;
- используйте криптографически случайный секрет с высокой энтропией.

## Основные маршруты
- `/` — лэндинг
- `/join` — регистрация взрослого аккаунта
- `/join/check-email` — экран «проверьте почту» при обязательном email confirmation
- `/auth/confirm` — callback подтверждения email
- `/login` — единый вход
- `/onboarding` — создание первого взрослого профиля
- `/dashboard` — единый приватный кабинет
- `/settings/security` — управление PIN и параметрами безопасности

## Auth и routing модель
- Один взрослый auth-account может иметь профили `parent`, `teacher` или оба.
- Ученик — отдельный auth-account и отдельный session contour.
- Роли не живут в URL: сегменты вида `/dashboard/<role>` удалены.
- Если взрослый вошёл впервые и у него ещё нет профиля, он направляется на `/onboarding`.
- Активный взрослый кабинет хранится в `user_preference.last_active_profile` (по умолчанию `parent`).
- Переключение профиля (`parent`/`teacher`) — через dropdown аватарки, без перелогина.

## Единый login flow (`POST /api/auth/login`)
Вход принимает:
- `identifier`: email взрослого или логин ученика;
- `secret`: пароль или PIN.

Фактический порядок обработки:
1. Нормализация `identifier`.
2. Если это email-формат — попытка взрослого входа по паролю.
3. Если не email — server-side lookup ученика в `student.internal_auth_email`.
4. Сначала всегда проверяется пароль.
5. Если пароль не подошёл и распознан ученик — используется PIN fallback через `verify_user_pin`.
6. После успеха: устанавливается app-session cookie, выполняется best-effort `user_preference`/context resolution, затем routing на `/onboarding` (если нужно) или `/dashboard`.

## Signup и email confirmation
### Режим 1: `ENABLE_EMAIL_AUTOCONFIRM=true`
- Подтверждение email отключено.
- После signup пользователь направляется на `/login?registered=1`.
- SMTP для этого режима не обязателен.

### Режим 2: `ENABLE_EMAIL_AUTOCONFIRM=false`
- Подтверждение email обязательно.
- После signup пользователь направляется на `/join/check-email`.
- До подтверждения вход недоступен.
- После подтверждения через `/auth/confirm` вход становится доступен.

**Текущий рабочий production/self-hosted режим:**
- `ENABLE_EMAIL_AUTOCONFIRM=false`
- SMTP включён
- confirm flow работает end-to-end

## Self-hosted email auth (кратко)
- SMTP provider: VK WorkSpace
- SMTP host: `smtp.mail.ru`
- Рабочий SMTP порт для текущего VPS: `2525`
- Signup → email → confirm → login работает фактически в текущей конфигурации
- Детальный runbook: `docs/email-auth-selfhosted-supabase.md`

## Preference и Security
### `user_preference`
Основные поля:
- `last_active_profile`
- `last_selected_school_id`
- `theme`
- `settings` (jsonb)

Helpers/RPC:
- `ensure_user_preference`
- `set_last_active_profile`
- `get_last_active_profile`
- `set_last_selected_school`
- `upsert_user_theme`
- `merge_user_settings`

Если RPC недоступны в self-hosted инсталляции, используется fallback через PostgREST upsert/patch.

### `user_security`
Основные поля:
- `pin_hash` (PIN хранится только в hash-виде)
- `pin_failed_attempts`
- `pin_locked_until`
- служебные timestamp-поля жизненного цикла PIN

Helpers/RPC:
- `set_user_pin`
- `verify_user_pin`
- `clear_user_pin`
- `reset_pin_attempts`

## Миграции
Миграции находятся в `supabase/migrations`.
Ключевые для текущего auth/routing/prefs/security состояния:
- `202603260001_init_auth_and_roles.sql`
- `202603270002_auth_onboarding_unified_signin.sql`
- `202604020001_parent_teacher_school_model.sql`
- `202604030001_user_preference_and_security.sql`

## Безопасность секретов
- Не коммитьте реальные `.env`.
- Не храните SMTP credentials в документации.
- Используйте только placeholders (`<app-password>`, `<secret>`) и secret store.
- Если секреты могли попасть в логи/чаты/скриншоты — ротируйте их.
