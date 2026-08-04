# Архив `world-around-me`

Архив создан перед удалением старой модели методик и шагов из ShiDao V2.

- `methodology.md` — человекочитаемое описание методики.
- `lessons/` — пять Markdown-файлов: полный план, каждый шаг, Student Screen,
  домашнее задание и связанные материалы.
- `data/fixture-source.json` — lossless экспорт полного подготовленного набора
  из TypeScript fixture (5 уроков).
- `data/live-database.json` — lossless read-only экспорт фактических строк
  self-hosted Supabase (3 опубликованных урока).
- `assets/` — все файлы из старого public-каталога методики.
- `source-documents/` — два исходных DOCX методики и десять исходных
  PDF/PPTX урока 5 с оригинальными русскими именами.
- `ASSET_MANIFEST.json`, `SOURCE_DOCUMENTS_MANIFEST.json` и
  `SHA256SUMS.txt` — пути, размеры, связи дублей и checksums.

## Проверка полноты

- Fixture lessons: 5
- Fixture blocks: 85
- Fixture Student Screen documents: 5
- Fixture homework definitions: 5
- Fixture asset records: 67
- Live DB lessons: 3
- Live DB assets: 39
- Архивных файлов: 187
- Исходных документов: 12 (из них 10 имеют byte-identical копии в `assets/`)
- Ссылок на отсутствующие public-файлы: 0

Оригинальные ID и пути сохранены для будущего конвертера в системный Course
template. Архив не является активным fixture и не подключён к runtime-коду.
