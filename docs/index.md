# Документация ShiDao

Документация разделена по статусу. **Current** описывает только работающую
систему. **Roadmap/strategy** описывает будущее и не является доказательством
наличия кода или таблицы.

## Начало каждой новой сессии

1. [Инструкции агентам](../AGENTS.md)
2. [README](../README.md)
3. [Текущее состояние и карта реализации](./project-state.md)
4. [Roadmap](./roadmap.md)

## Каноническая архитектура

Документы этого раздела могут содержать согласованные NEXT/LATER решения, но
обязаны явно отделять их от CURRENT.

- [Глобальная спецификация: CURRENT/NEXT/LATER boundaries](./v2/SHIDAO_GLOBAL_REFACTOR_SPEC.md)
- [Доменная модель](./domain-model.md)
- [Lesson workflow model](./architecture/lesson-workflow-model.md)
- [Learning Activity System: компоненты, evidence, профиль и адаптивность](./architecture/learning-activity-system.md)
- [Learner identity and access model](./architecture/learner-identity-access-model.md)
- [Communication Center](./architecture/communication-center.md)
- [AI provider integration](./architecture/ai-provider-integration.md)
- [Frontend style system](./architecture/frontend-style-system.md)
- [Image delivery boundary](./architecture/image-delivery.md)
- [Account avatar design and privacy contract](./product/account-avatars.md)
- [Auth, domains и routing](./authorization-routing.md)
- [Development Course Builder MCP](./v2/COURSE_BUILDER_MCP.md)

## Продуктовые контракты (CURRENT + NEXT)

- [Демо-магазин учебных товаров](./product/store-demo.md)
- [Курсы для педагогов и аттестация](./product/educator-courses-and-attestation.md)
- [Каталог типов компонентов Course](./product/course-component-catalog.md)

## Current: база и operations

- [Current schema guide](./database/current-schema.md)
- [Current schema SQL snapshot](../supabase/schema/current-schema.sql)
- [Правила forward migrations](./database/migration-guidelines.md)
- [Роль migration history](./database/migration-history.md)
- [Email Auth на self-hosted Supabase](./email-auth-selfhosted-supabase.md)
- [V2 deployment runbook](./operations/v2-deployment-runbook.md)
- [V1 recovery runbook](./operations/v1-recovery-runbook.md)

## Future: продуктовая стратегия

- [Продуктовая модель и стратегическое видение](./v2/SHIDAO_PRODUCT_MODEL_AND_VISION.md)
- [План реализации Learning Activity System](./plans/learning-activity-system-implementation.md)
- [Copy-paste prompt: начать LA-M1 очных наблюдений](./prompts/learning-activity-foundation.md)

Future-документы описывают согласованное направление, но не доказывают наличие
таблиц, API или UI. Точный статус каждого среза проверяется по project-state и
current schema.

## Historical delivery records

- [Copy-paste prompt: завершить learner identity и observer ecosystem](./v2/LEARNER_IDENTITY_COMPLETION_PROMPT.md)
- [Первый Teacher Course Builder milestone](./v2/TEACHER_COURSE_BUILDER_DEMO_MILESTONE.md)

Эти файлы сохраняют завершённые execution/acceptance handoffs. Они не являются
current-state source of truth и не должны использоваться как план новых работ.

## Архивная граница

- `archive/content/world-around-me-2026-08-04/` — tracked source archive для
  будущего importer; не runtime dependency.
- `archive/v1-2026-08-03`, `v1-snapshot-2026-08-03` и
  `.local-backups/v1-snapshot-2026-08-03` — recovery V1; не изменять и не
  восстанавливать без явной команды.

Локальный ignored-каталог `docs/design-system/` является deprecated V1 visual
reference с удалёнными Methodology/Schedule surfaces и не входит в
каноническую документацию. Его tokens можно использовать только после сверки с
active code; routes/domain из него переносить нельзя.

Локальный ignored-каталог `enviromnent/` содержит deprecated V1 operational
material и historical plaintext credentials. Он не является источником
подключения или schema; содержимое не выводить и не использовать, credentials
ротировать только отдельной approved ops-задачей.
