# AI provider integration

**Статус:** canonical contract для текущего production AI-среза

**Актуально на:** 6 августа 2026 года

**Deployment state:** AI application slice развёрнут на `v2.shidao.ru` в release
`3a94878`; server runtime получает `ROUTERAI_API_KEY` из production secret
environment. Переход default model на `google/gemini-2.5-flash-lite` ещё требует
отдельного authenticated provider postflight после нового deployment

**Schema state:** AI-срез не добавляет таблицы, RPC или migrations

## Граница текущего среза

Текущий production slice подключает RouterAI к существующему Course Builder и
даёт преподавателю три отдельные возможности:

1. получить программу нового Course и явно применить её после preview;
2. получить план новой или существующей Lesson и явно применить его после
   preview;
3. обсудить Course или выбранную Lesson с read-only ассистентом.

Это authoring assistance, а не AI-преподаватель и не автономный агент. Ассистент
не проводит занятия, не управляет Student Screen, не вызывает tools и не меняет
Course из чата.

## Архитектурный поток

```text
authenticated browser
→ Node.js /api/v2/courses/[courseId]/ai-* route
→ per-request actor from getCourseBuilderContext()
→ AiCourseBuilderService
→ server-only RouterAI adapter
→ provider-compatible structured output
→ transport conversion + canonical Zod/registry validation
→ preview returned to browser
→ explicit teacher Apply
→ existing CourseBuilderApplicationService commands
→ existing repository + user JWT / ownership / RLS
```

Production web не запускает локальный `stdio` MCP и не передаёт ему статический
actor. MCP остаётся development adapter над тем же application service; AI-срез
переиспользует domain/service contracts напрямую.

## Provider contract

`src/modules/ai/routerai.ts` реализует server-only OpenAI-compatible вызов
`POST /chat/completions`:

- default base URL — `https://routerai.ru/api/v1`;
- default model — `google/gemini-2.5-flash-lite`;
- обязательный secret — `ROUTERAI_API_KEY`;
- `ROUTERAI_MODEL`, `ROUTERAI_BASE_URL` и `ROUTERAI_TIMEOUT_MS` позволяют
  изменить модель, endpoint и timeout без изменения domain model;
- production base URL обязан использовать HTTPS;
- запросы ограничены по числу сообщений, общему размеру и output tokens;
- timeout и disconnect/caller abort прекращают provider request;
- structured planning использует JSON Schema, затем результат повторно
  валидируется Zod contracts;
- усечённый `finish_reason=length`, пустой content и невалидный provider output
  не применяются как частичный план.

API key существует только в server environment. Browser, provider context,
ответ API и application logs не должны содержать secret, JWT или service-role
credentials. На текущем demo-контуре secret уже настроен как runtime-only
переменная и не фиксируется в repository. Значение, однажды опубликованное в
чате, логе или issue, необходимо ротировать до публичного production launch.

### Provider transport schema и canonical validation

JSON Schema, отправляемая конкретному provider, является transport adapter, а
не новым источником истины для Component domain. Lesson transport использует
плоский список `blocks`, где у каждого блока обязательны одинаковые поля
`kind`, `title`, `body`, `choices` и `matches`; неиспользуемые поля остаются
пустыми. Provider-facing schema не содержит сложной discriminated union и
удаляет несовместимые transport keywords длины/размера, но runtime Zod limits
остаются обязательными.

После ответа AI-layer преобразует transport blocks в канонический
`AiLessonComponentPlan`, проверяет discriminated Zod contracts по `typeKey`, а
перед первой записью строит обычный `lessonAddComponentInputSchema` с registry
payload schema и default placement. UUID для poll options и matching pairs
создаёт server conversion layer, а не provider.

Таким образом, provider-flat schema не ослабляет application boundary:
неизвестный type, несовместимый payload или лишние поля отклоняются до Apply.
UI, application service и development MCP продолжают использовать canonical
registry contracts; provider transport не копируется в MCP и не становится
вторым Component registry.

## Course generation: preview → apply

`POST /api/v2/courses/[courseId]/ai-plan` сначала проверяет authenticated actor
и доступ к Course, а затем просит модель вернуть ровно `targetLessonCount`
элементов `title + summary`. Provider call не записывает Course.

В текущем New Course flow базовые поля Course и attachments сохраняются до
вызова модели. AI planning разрешён только пока у Course нет Lessons. UI
показывает программу, модель и фактический usage; только отдельное подтверждение
вызывает `POST .../ai-apply`.

Apply повторно валидирует план и текущее состояние Course, создаёт обычные
Lesson через `CourseBuilderApplicationService.addLesson` и допускает безопасный
retry уже совпадающего префикса. При конфликте после preview операция
останавливается как stale plan; при ошибке поддерживаемый path компенсирует
созданные в этом apply Lessons.

Preview несёт SHA-256 fingerprint переданного модели Course context. Apply
сравнивает его с текущими полями Course/attachment metadata, поэтому ручное
изменение контекста после preview требует новой генерации.

Course generation в этом срезе создаёт программу из Lesson titles/comments. Он
не генерирует все Components каждого урока одним скрытым действием.

## Lesson generation: preview → apply

`POST .../ai-lesson-plan` строит preview для новой Lesson или дополнения
существующей. Допустимы 3–20 Components из ограниченного registry-подмножества:

```text
heading
rich_text
callout
divider
single_choice_poll
matching_game
```

`quote`, `image`, `slideshow` и `file` намеренно не выдаются модели в этом
срезе. План использует каноническую иерархию `Course → Lesson → ordered
Components`; Step, root Step и Methodology не создаются.

До первой записи `POST .../ai-lesson-apply`:

- сравнивает исходный ordered list Lesson IDs;
- для существующей Lesson сравнивает исходный list Component IDs;
- сравнивает fingerprint bounded Course/Lesson/component context, поэтому
  правка title/comment/payload при прежних IDs также делает preview stale;
- валидирует каждый payload теми же registry contracts и default placement,
  которые использует ручной редактор.

Apply создаёт обычную Lesson либо обновляет её teacher comment и добавляет
Components в конец существующего плана. Существующие Components не заменяются.
Все новые Components остаются `staff_only`; назначение на Student Screen Slide
— отдельное явное действие преподавателя. Ошибка поддерживаемого apply path
запускает компенсационное удаление созданных сущностей и восстановление
предыдущего comment, когда это возможно.

## Assistant boundary

`POST .../assistant` выполняет только provider completion после owner-scoped
`getCourse`. У AI-service для этого flow нет вызова mutation command, tool
execution или MCP transport. System contract прямо запрещает утверждать, что
ассистент уже изменил Course.

История текущего диалога хранится только в React state открытого dialog:

- сообщения не записываются в PostgreSQL, Storage или browser persistence;
- закрытие dialog или reload начинает новый диалог;
- server принимает не более 16 сообщений и 24 000 символов истории;
- ответ содержит usage только последнего provider request.

Следовательно, это **read-only ephemeral assistant**, а не persisted Course chat,
change history или автономный editor.

## Контекст и attachments

Модель получает ограниченный teacher context: основные поля Course, course
outline, а для выбранной Lesson — comment и до 20 ordered Components. Из
component payload удаляются технические IDs, signed URLs, checksum и Storage
bucket/path; длинные строки и массивы сокращаются.

Для course-wide attachments передаются только filename, MIME type и текущий
status с явным предупреждением, что содержимое не извлекалось. AI-срез не
скачивает файл по signed URL и не выполняет parsing, OCR, embeddings или RAG.
Успешно прикреплённый файл нельзя описывать как прочитанный, изученный или
использованный моделью.

## Usage, rate limits и аудит

Provider metadata (`requestId`, фактическая model/provider и token usage)
возвращается для preview/chat UI и записывается как ограниченное server log
event без prompt, component payload или secret.

Planning/chat routes имеют authenticated-actor process-local rate limit и
ограничение одновременных provider requests. Apply дополнительно имеет
process-local mutex на actor + Course, чтобы двойной submit в одном container
не интерливил записи. Это защита одного application process, а не
распределённая квота или DB transaction; несколько replicas всё ещё требуют
отдельного distributed limiter/idempotency boundary.

В текущем срезе **нет persistent quota/ledger, billing units, balance или
subscription enforcement**. Нулевой или отсутствующий usage в provider response
нормализуется для UI, но не превращается в подтверждённое списание. Платные
лимиты нельзя включать до отдельной persisted accounting model.

## Schema и persistence

AI-срез переиспользует существующие:

```text
course
lesson
lesson_component
lesson_student_slide
stored_file
course_attachment
```

Новых таблиц, columns, RPC, Storage buckets или migrations нет. Persisted
результат AI после Apply не отличается по domain contract от результата ручного
редактора. Provider request/response, assistant history и quota state в БД не
сохраняются.

## Не входит в текущий срез

- подтверждённый provider postflight нового default
  `google/gemini-2.5-flash-lite` до следующего deployment;
- UI выбора модели пользователем;
- persistent assistant history, Course chat и notifications;
- write-capable assistant, tool calling и AI change sets/undo;
- attachment parsing/OCR/RAG и citation provenance;
- Homework generation;
- learner-facing AI teacher, live lesson и Student Screen control;
- persistent distributed quota, cost ledger, billing и subscriptions;
- внешний remote MCP/API.

## Карта реализации

| Область                       | Каноническое место                                             |
| ----------------------------- | -------------------------------------------------------------- |
| Provider adapter              | `src/modules/ai/routerai.ts`                                   |
| Provider lesson transport     | `src/modules/ai/lesson-provider-contracts.ts`                  |
| AI request/response contracts | `src/modules/ai/course-builder-contracts.ts`                   |
| Bounded model context         | `src/modules/ai/course-context.ts`                             |
| Planning/apply/chat service   | `src/modules/ai/course-builder-service.ts`                     |
| Rate/error boundary           | `src/modules/ai/server-context.ts`                             |
| API routes                    | `src/app/api/v2/courses/[courseId]/ai-*/`, `assistant/`        |
| Browser client                | `src/components/course-builder/course-builder-client.ts`       |
| Course preview UI             | `src/components/course-builder/ai-course-plan-dialog.tsx`      |
| Lesson preview UI             | `src/components/course-builder/ai-lesson-plan-dialog.tsx`      |
| Assistant UI                  | `src/components/course-builder/ai-course-assistant-dialog.tsx` |

## Release acceptance

Release `3a94878` зафиксировал production routes/UI, server-only RouterAI
boundary и наличие runtime secret без раскрытия его значения. Это делает
preview/apply/assistant текущими production-поверхностями, но не является
утверждением об успешном postflight нового default provider model.

Для закрытия перехода на `google/gemini-2.5-flash-lite` после deployment нужны:

1. подтвердить configured model/base URL/timeout без вывода API key;
2. выполнить authenticated postflight Course preview/apply, Lesson
   preview/apply и read-only assistant на `v2.shidao.ru`;
3. проверить ручной fallback при configuration/provider errors;
4. подтвердить, что assistant chat не пишет данные, generated Components
   остаются private, а attachment contents не уходят модели;
5. зафиксировать точный deployed SHA, фактическую provider model и результат
   smoke в `docs/project-state.md`.
