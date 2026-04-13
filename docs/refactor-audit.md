# Cleanup refactor audit (2026-04-13)

## 1) Canonical routes and screens

### Public
- `/` — маркетинговый лендинг.
- `/login`, `/join`, `/join/check-email`, `/forgot-password`, `/reset-password`.
- `/auth/confirm` — callback подтверждения/восстановления.

### App entry and protected
- `/onboarding` — выбор/добавление взрослой роли.
- `/dashboard` — role-aware входной экран (teacher / parent / student).
- `/groups`, `/groups/new`, `/groups/[groupId]`, `/groups/[groupId]/students/[studentId]/communication`.
- `/lessons`, `/lessons/[scheduledLessonId]`, `/lessons/demo`.
- `/methodologies`, `/methodologies/[methodologySlug]`, `/methodologies/[methodologySlug]/lessons/[lessonId]`.
- `/settings/profile`, `/settings/security`, `/settings/team`.

## 2) Files likely safe to delete

- `docs/autorization.md` — typo-alias, дублировал canonical auth doc.
- `docs/tz.md` — alias на domain-model без самостоятельной ценности.
- `docs/refactors/repo-cleanup-audit-2026-04-12.md` — устаревший отчёт, частично противоречил текущей структуре.

## 3) Files to split/refactor

- `src/components/session-nav-actions.tsx` — упрощение действий меню и обработки ошибок.
- `src/components/dashboard/parent-dashboard.tsx` — разбиение монолитной карточки на читаемые секции.
- `src/components/dashboard/student-dashboard.tsx` — разделение уроков/дз/коммуникации и унификация состояния.
- `src/app/(app)/onboarding/page.tsx` — вынос стабильной структуры контента и упрощение визуального шума.

## 4) Documentation status

### Canonical
- `README.md`
- `docs/authorization-routing.md`
- `docs/domain-model.md`
- `docs/index.md`
- `docs/database/current-schema.md`
- `supabase/schema/current-schema.sql`
- `docs/refactor-audit.md`

### Historical (kept intentionally)
- `docs/architecture/*` — решения по runtime-модели/IA.
- `docs/database/migration-history.md` + `supabase/migrations/*`.

## 5) DB/schema notes (canonical vs historical)

- Canonical current DB truth: `supabase/schema/current-schema.sql` + `docs/database/current-schema.md`.
- Migration files рассматриваются как журнал эволюции; удаление/перезапись history не выполнялась.
- На текущем проходе schema cleanup migration **не добавлялась**: в app-коде не найден безопасный кандидат на удаление текущей используемой сущности.

## 6) Risks / invariants not to break

- Логин взрослых и учеников (включая PIN fallback), confirm-flow и recovery.
- Redirect-логика: onboarding vs dashboard.
- Переключение профилей teacher/parent через session menu.
- Role boundaries: parent read-only, student own-scope, teacher own groups.
- Канонический runtime маршрут урока: `/lessons/[scheduledLessonId]`.
