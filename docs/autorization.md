# Авторизация и профили (апрель 2026)

## Принципы
- Источник истины для аутентификации — только `auth.users`.
- Профили разделены явно: `parent`, `teacher`, `student`.
- Один `auth.users.id` может иметь и `parent`, и `teacher` профиль.
- Роль-переключатель в домене не используется.

## Единый вход
Маршрут: `/login`.

Поля:
1. Email взрослого **или** логин ученика.
2. Пароль.

Если введён не-email, приложение ищет `student.login` и берёт внутренний email из `student.internal_auth_email` (технический слой совместимости), затем выполняет sign-in через Supabase Auth.

## Маршрутизация после входа
1. Есть `student` по `student.user_id = auth.uid()` → `/dashboard/student`.
2. Есть и `teacher`, и `parent` → `/dashboard/select-profile`.
3. Только `teacher` → `/dashboard/teacher`.
4. Только `parent` → `/dashboard/parent`.
5. Нет профилей → `/onboarding`.

## Онбординг
- `parent`: создаётся только строка в `parent`.
- `teacher`: создаются `teacher`, `school`, `school_teacher(role='owner')`, первый `class`, `class_teacher`.
