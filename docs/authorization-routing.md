# Авторизация и маршрутизация (актуально на апрель 2026)

## Что считается нормой

- Единая точка входа: `/login`.
- Серверный auth-flow через API-роуты (`/api/auth/*`) и внутреннюю app-session cookie.
- Единый callback подтверждений: `/auth/confirm`.
- Единый приватный вход: `/dashboard` (без role-segments в URL).

## Login flow

`POST /api/auth/login` принимает:

- `identifier`: email взрослого или логин ученика;
- `secret`: пароль или PIN.

Порядок обработки:

1. Нормализация `identifier`.
2. Если `identifier` похож на email — password login взрослого.
3. Если это не email — lookup ученика по `student.login`, затем password login через `student.internal_auth_email`.
4. Если пароль не подошёл и это ученик — PIN fallback (`verify_user_pin`).
5. После успеха пишется app-session и рассчитывается redirect:
   - есть взрослые профили → `/dashboard`;
   - профилей ещё нет → `/onboarding`.

## Confirm flow (`/auth/confirm`)

Маршрут принимает `token_hash`, `type`, `next` и обрабатывает типы:

- `signup`, `email` → `/login?confirmed=1`;
- `recovery` → `/reset-password`;
- `invite` → `/onboarding`;
- `email_change` → `/settings/profile?emailChanged=1`.

`next` нормализуется только в безопасный внутренний путь (`/...`) с fallback по типу подтверждения.

## Signup / Recovery / Invite / Email change

- Signup (`/api/auth/signup`) создаёт взрослый auth-user и отправляет на check-email или login (в зависимости от `ENABLE_EMAIL_AUTOCONFIRM`).
- Recovery (`/api/auth/recovery`) отправляет письмо восстановления с callback на `/auth/confirm`.
- Invite (`/api/admin/invite`) отправляется через Supabase admin invite API, callback тот же `/auth/confirm`.
- Email change (`/api/settings/profile/email`) подтверждается текущим паролем и ведёт через `/auth/confirm`.

## Onboarding и dashboard routing

- Взрослый без профиля попадает на `/onboarding`.
- После выбора роли создаётся соответствующий профиль и фиксируется `last_active_profile`.
- Если профили уже есть — вход сразу в `/dashboard`, активный кабинет берётся из `user_preference.last_active_profile`.

## PIN слой (без продуктовых изменений)

- PIN хранится только в `user_security.pin_hash`.
- Изменение PIN: `/api/settings/security/pin`.
- При уже настроенном PIN действие подтверждается текущим паролем или старым PIN.
- Телефонный auth/SMS сейчас не внедрён и не является частью текущего потока.
