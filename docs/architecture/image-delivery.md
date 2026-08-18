# Image delivery boundary

**Статус:** current production privacy/storage boundaries; responsive Store и
Account avatar delivery — current source / next production
**Актуально на:** 18 августа 2026 года

## Назначение

ShiDao не использует один универсальный image pipeline для public assets и
private Account/Course data. Выбор renderer/cache определяется источником и
authorization boundary, а не расширением файла. Public source-controlled media
можно безопасно оптимизировать общим Next.js runtime; private media остаётся за
тем authenticated route, который повторно проверяет capability.

Этот срез использует уже установленные Next.js `next/image` и Sharp `0.34.5`.
Новая package dependency, внешний CDN/image service, database schema, Storage
bucket или migration не добавляются.

## Current source / next production matrix

| Surface                       | Master / source                                                               | Delivery                                                                                                | Cache и quality                                                                                                | Privacy status                                                             |
| ----------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Store card/detail             | 19 public WebP `1254 × 1254`, quality `90`, в `public/store/products/<slug>/` | built-in `next/image` runtime optimizer + Sharp; card/modal/thumbnail передают точный `sizes`           | card `75`, modal `85`, thumbnail `75`; minimum cache TTL `7d`                                                  | public source-controlled demo media; не Product Storage                    |
| Account preset                | 20 public WebP `512 × 512` в `public/avatars/presets/`                        | built-in `next/image` runtime optimizer + Sharp с surface-specific `sizes`                              | quality `75`; shared public minimum cache TTL `7d`                                                             | public immutable preset set                                                |
| Account custom                | private normalized `512 × 512` WebP в server-only `profile-avatars`           | authenticated same-origin GET через custom `next/image` loader; direct route, не default `/_next/image` | allowlisted width `32…512`; private immutable cache только для exact revision + HMAC key, `Vary: Cookie`, ETag | owner Account проверяется на каждом request; object path/token не выдаётся |
| Course/Lesson Component image | private StoredFile и краткоживущий signed URL                                 | current renderer сохраняет `unoptimized`; общий Next optimizer намеренно не используется                | существующая signed-expiry semantics, без общего image cache                                                   | отдельный authenticated derivative slice — next/later                      |
| Communication                 | initials и локальные Lucide/system icons                                      | raster message/avatar pipeline отсутствует                                                              | неприменимо                                                                                                    | attachments — later; remote/model-authored images не активируются          |
| Unsaved custom-avatar preview | browser `blob:` URL                                                           | direct `unoptimized` preview                                                                            | не кэшируется общим optimizer                                                                                  | локальные неподтверждённые bytes, не Account state                         |

## Public responsive images

`next.config.ts` ограничивает разрешённые local source paths через
`images.localPatterns`, разрешает только нужные quality `75/85`, задаёт наборы
device/image widths и minimum cache TTL `604800` секунд. Store и preset avatar
renderers обязаны передавать `sizes`, соответствующий реальной ширине surface;
иначе browser выберет избыточный variant даже при корректном `srcset`.

Каталоги этих public raster sources явно исключены из middleware matcher. Это
нужно штатному внутреннему fetch `/_next/image`, у которого нет синтетического
`Host`; сами каталоги уже являются публичными static assets. Private avatar
API из matcher и `images.localPatterns` не исключается и остаётся за
host/auth guard.

Source WebP остаётся master для повторной responsive encoding. WebP master сам
по себе не означает, что browser должен скачать исходные `1254` или `512`
пикселей. В то же время runtime optimizer не заменяет source hygiene: masters
остаются квадратными, имеют проверенный MIME/metadata и не должны быть больше
максимального полезного разрешения.

Public allowlist не расширяется до произвольного remote host. Private signed
URLs, Storage paths, `blob:`, `data:`, SVG, animated GIF и QR/preview surfaces
не переводятся в общий optimizer только ради единого renderer contract.

## Private custom Account avatars

Default `/_next/image` не является authenticated Account proxy и не должен
получать private avatar source. `AvatarImage` сохраняет `next/image` layout/
`srcset`, но custom loader строит прямой same-origin URL:

```text
/api/settings/profile/avatar?revision=<exact>&cache=<opaque>&width=<allowed>
```

Порядок read boundary:

1. route проверяет app session/rate limit и получает canonical Account;
2. Account должен по-прежнему иметь custom avatar и тот же exact revision;
3. `width` должен входить в фиксированный allowlist;
4. supplied `cache` должен совпасть с server-derived domain-separated HMAC от
   Auth user identity + revision;
5. только после этого route читает private Storage master и при необходимости
   создаёт Sharp variant.

Opaque delivery key передаётся в SessionView только для текущего custom avatar.
Он не содержит и не заменяет Auth/Account ID, Storage path, signed token или
secret. Одинаковый `revision=1` у двух Accounts не создаёт общий cache address.
Logout, другая Account session, смена revision или mismatch key fail closed.

Cacheable exact URL отвечает с
`Cache-Control: private, max-age=31536000, immutable`, `Vary: Cookie` и ETag,
связанным с delivery key + width. `If-None-Match` может вернуть `304` только
после повторной Account authorization. Совместимый request без key остаётся
authenticated, но получает `private, no-store`; произвольный query не создаёт
безграничный cache-bust/resize surface.

Initials являются взаимоисключающим loading/error fallback, а не постоянным
чёрным слоем под raster. Во время загрузки image остаётся прозрачным и виден
fallback; после успешного `load` fallback удаляется из render tree, поэтому не
просачивается через antialiased rounded corners. При ошибке initials остаются
видимыми. `prefers-reduced-motion` отключает только fade, а не fallback.

## Private Course/Lesson media

Course materials и Component `image` ссылаются на owner-scoped private
StoredFile и открываются через ограниченный signed access. Current
`SignedImage` намеренно сохраняет `unoptimized`: общий Next cache может жить
дольше signed URL, revoke или изменения Course access, а optimizer request не
является canonical Course/Lesson authorization check.

`images.remotePatterns` не должен широко разрешать Supabase Storage. Future
responsive delivery для этих изображений требует отдельного
security-reviewed authenticated derivative pipeline или upload-time variants:
owner/course authorization до чтения bytes, bounded dimensions, account/course
cache isolation, revoke semantics и тесты denial. До этого signed direct
delivery безопаснее, даже если она не создаёт responsive derivative.

Этот boundary не меняет authored hierarchy `Course → Lesson → ordered
Components`, StoredFile schema, Student Screen projection или Course materials
semantics.

## Communication boundary

Current Communication Center использует initials для людей, локальные Lucide
icons и отдельные system/assistant glyphs; пользовательских raster avatars и
message images там нет. Human/system body остаётся plain text или безопасным
CommonMark subset, в котором remote/model-authored images не активируются.

Message attachments остаются later в canonical Communication contract. Этот
image-delivery slice не добавляет attachment field, API, Storage object,
signed URL или schema/migration и не должен описываться как attachment
pipeline.

## Implementation and acceptance map

- public optimizer configuration: `next.config.ts`;
- Store masters/renderers: `public/store/products/`,
  `src/components/store/store-product-carousel.tsx`;
- preset/custom avatar projection: `src/lib/account-avatar.ts`,
  `src/components/account/avatar-image.tsx`,
  `src/components/account/avatar-settings-form.tsx`;
- authenticated avatar key/variant/route:
  `src/lib/server/profile-avatar-delivery.ts`,
  `src/lib/server/profile-avatar-image.ts`,
  `src/lib/server/session-view.ts`,
  `src/app/api/settings/profile/avatar/route.ts`;
- private Course/Lesson renderer:
  `src/components/course-builder/component-renderers.tsx`;
- central regression contract: `src/lib/__tests__/image-delivery-contract.test.ts`.

Acceptance сохраняет следующие отрицательные инварианты:

- public Store/preset surfaces получают `/_next/image` + responsive width, но
  private custom/Course/Lesson sources не проходят через default optimizer;
- Store masters остаются `19 × 1254 × 1254`, preset masters —
  `20 × 512 × 512`;
- custom-avatar width/revision/key проверяются до Storage/resize, два Accounts
  с одинаковой revision не разделяют cache address, logout/cross-Account
  отклоняются;
- SessionView/URL не раскрывают identity, Storage path или signed token;
- успешно загруженный Account avatar и initials fallback не рисуются друг под
  другом;
- Course/Lesson signed URL expiry/revoke boundary не ослабляется;
- Communication не получает raster/message attachment behavior скрытым
  follow-up.

## Next / later

**Next** для image delivery — production rollout/postflight текущего public и
custom-avatar source contract. Отдельное решение для private Course/Lesson
derivatives начинается только после security design и не обязано совпадать с
custom-avatar endpoint.

**Later** — managed Product media вместе с реальными Product/Inventory/Admin
contracts и Communication attachments вместе с их собственными authorization,
moderation, retention и Storage contracts. Ни одно из них не добавляется
текущей оптимизацией source-controlled Store/preset assets.
