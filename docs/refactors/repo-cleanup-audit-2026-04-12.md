# Repo cleanup audit — 2026-04-12

## 1) Summary of major cleanup actions

- Вынесены utility/classname helper'ы в единый `src/lib/ui/classnames.ts`.
- Декомпозирован landing page: контентные конфиги и section-помощники вынесены в `src/components/landing/*`.
- Глобальные стили разделены по зонам ответственности (`globals.css` + `styles/navigation.css` + `styles/marketing.css`).
- README сокращён до рабочего entrypoint и дополнен ссылкой на docs-index.
- Документация переиндексирована и переименованы плохо-обнаруживаемые файлы через compatibility-stub подход.

## 2) Files/components/docs removed

- Файлы не удалялись без необходимости; рискованные legacy-path документы оставлены как redirect-stub:
  - `docs/autorization.md`
  - `docs/tz.md`

## 3) Files/components/docs consolidated

- `src/components/landing-page.tsx` → `src/components/landing/content.ts`, `src/components/landing/reveal.tsx`, `src/components/landing/section-title.tsx`.
- Локальные `cx/joinClasses` helper'ы → `src/lib/ui/classnames.ts`.
- Документация структурирована через `docs/index.md`.

## 4) UI/UX consistency improvements made

- Нормализован общий className helper для UI-примитивов и header/nav элементов.
- Стили навигации и маркетингового слоя выделены в отдельные CSS-файлы.
- Landing page переведён на более явную композицию (контент отдельно от рендера).

## 5) DB/migration hygiene findings

- Миграционная цепочка безопасно сохранена.
- Обнаружены legacy data inserts в schema migrations (см. `docs/database/schema-hygiene-2026-04-12.md`).
- Разрушительных изменений схемы не вносилось.

## 6) Remaining risks / deferred items

- Data bootstrap всё ещё частично живёт в миграциях.
- Для полноценной дедупликации docs/architecture требуется отдельный pass с терминологическим редактированием всех архитектурных документов.
- Требуется отдельная валидация UI-снимками на живом browser runtime.

## 7) Verification performed

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
