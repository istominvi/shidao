# Авторизация и маршрутизация (актуально на 19 апреля 2026)

## Канонический routing-контракт

- Единая публичная точка входа: `/login`.
- Единый callback подтверждений: `/auth/confirm`.
- Единый приватный вход: `/dashboard`.
- Выбор роли для взрослого без профиля: `/onboarding`.

## Login flow

`POST /api/auth/login`:

- `identifier` = email взрослого **или** логин ученика;
- `secret` = пароль **или** PIN (fallback только для ученика).

Порядок:
1. Нормализация `identifier`.
2. Email → взрослый password login.
3. Не email → поиск `student.login`, затем auth через `student.internal_auth_email`.
4. Если пароль не подошёл для ученика → проверка PIN.
5. После успеха пишется app-session и вычисляется redirect:
   - `student` actor → `/dashboard` (и при password, и при PIN);
   - взрослый с хотя бы одним профилем (`teacher` или `parent`) → `/dashboard`;
   - взрослый без профилей → `/onboarding`.

Важно:
- ученик никогда не классифицируется как «взрослый без профиля»;
- вход ученика по `student.login + password`, `student.login + PIN` и `student.internal_auth_email + password` всегда ведёт на `/dashboard`.

## Confirm flow

`/auth/confirm` принимает `token_hash`, `type`, `next`.

- `signup` / `email` → `/login?confirmed=1`
- `recovery` → `/reset-password`
- `invite` → `/onboarding`
- `email_change` → `/settings/profile?emailChanged=1`

`next` принимается только как безопасный внутренний путь (`/...`).

## Access boundaries

- Guest/degraded не получают доступ к protected-app маршрутам.
- Parent: read-only видимость детей.
- Student: только собственный контекст.
- Teacher: только собственные группы/уроки.
- `/onboarding` доступен только взрослому без профиля (или взрослому с `?mode=add-profile` при добавлении второй роли). Для ученика `/onboarding` серверно редиректится на `/dashboard`.

## Профиль и сессия

- Переключение teacher/parent: `POST /api/preferences/profile`.
- Logout: `/api/auth/logout`.
- Управление PIN: `/api/settings/security/pin`.
