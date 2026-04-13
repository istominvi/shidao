# Schema hygiene audit — 2026-04-12

## Что очищено/нормализовано

- Уточнена документация по текущим миграциям и legacy-path артефактам.
- Добавлен централизованный индекс документации и отдельная база для DB hygiene notes.

## Что сохранено намеренно

- Полная цепочка миграций сохранена без destructive-операций для production safety.
- Legacy migration шаги (rename/refactor эпохи `adult_account -> adult`, `organization -> school`) сохранены как исторически значимые и необходимые для воспроизводимости.
- Security-definer/RLS и runtime layer таблицы не изменялись без полной prod-валидации.

## Legacy / рискованные точки

- В миграциях `202604070002_homework_runtime_layer.sql` и `202604100001_methodology_lesson_student_content.sql` остаются bootstrap insert-блоки, смешанные со schema-эволюцией.
- В `202604090001_homework_typed_quiz_upgrade.sql` остаётся data-mutation для конкретного урока (`world-around-me`), что увеличивает coupling migration ↔ product content.

## Рекомендации следующего этапа

1. Ввести отдельный bootstrap/seed pipeline для non-schema данных и постепенно перестать добавлять контент в schema migrations.
2. Добавить `docs/database/migration-guidelines.md` с правилом: schema-only migrations + explicit data migrations, когда они неизбежны.
3. Перед возможным baseline-squash подготовить проверку fresh install vs upgraded install в CI.
