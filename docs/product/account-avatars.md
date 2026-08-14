# Account avatars

Status: **current** for the ShiDao V2 Account profile surface.

## Product contract

Every Account has one active avatar. The canonical identity owner is
`public.account`, not `learner_profile`, Auth metadata, preferences or Course
files. Offline Learner Profiles do not inherit this requirement until they are
activated as an Account.

The active avatar is either:

- one immutable preset from `sd-avatar-v1-01` through
  `sd-avatar-v1-20`; or
- one private, server-normalized custom image.

The preset key is the stable database value. File paths and visual labels are
presentation details owned by the typed manifest in
`src/lib/account-avatar.ts`.

## Preset set V1

The twenty original ShiDao “learning companions” are grouped by dominant
brand accent:

| Keys    | Dominant accent    | Characters                               |
| ------- | ------------------ | ---------------------------------------- |
| `01–05` | blue `#70B7FF`     | fox, owl, cat, dog, rabbit               |
| `06–10` | lime `#C9FF4F`     | bear, panda, red panda, tiger, deer      |
| `11–15` | lavender `#C9B4FF` | capybara, penguin, otter, frog, turtle   |
| `16–20` | pink `#FFB6E8`     | axolotl, whale, octopus, raccoon, dragon |

Cream `#F5F1E8`, ink `#141414` and navy `#101E38` supply neutral surfaces and
contrast. Color is never the only selection signal: the picker also exposes a
radio state, visible border and check mark.

Production assets live at
`public/avatars/presets/sd-avatar-v1-XX.webp`. Each file is opaque sRGB WebP,
`512 × 512`, with no baked border or corner radius. UI surfaces apply their own
crop and the shared `12 px` product radius.

## Visual language and provenance

The V1 set was generated with OpenAI image generation in
`stylized-concept` mode, one square master per character. The common prompt
specified an original soft-clay/pearl-plastic 3D educational mascot, a centered
head-and-shoulders composition at roughly 76% of the frame, at least 10% safe
inset, soft studio light, broad matte background shapes and facial details that
remain legible at `40 × 40`.

Every prompt explicitly excluded text, letters, logos, watermarks, real-person
likenesses, copyrighted characters, named-artist imitation, transparent
backgrounds and baked corner radii. The first blue fox was used only as the
series style anchor for the remaining nineteen independently generated
characters. Masters were center-cropped and exported to WebP at quality `82`;
the generated masters remain outside the repository.

## Custom image boundary

Custom uploads are private Account data. The browser may submit JPEG, PNG or
WebP up to `5 MiB`, but the server treats the bytes as untrusted input. It
decodes with a bounded pixel limit, applies orientation, center-crops to
`512 × 512`, re-encodes to WebP without source metadata and rejects SVG, GIF,
invalid images and oversized normalized output.

Storage uses a private server-only bucket with no browser policies and a new
UUID object path for each version. After validating the app session, the
same-origin route performs Storage and pointer writes with the server
credential; the caller's JWT cannot bypass normalization through direct
Storage or PostgREST writes. The sequence is upload new object, atomically
switch the Account pointer with optimistic revision checking, then best-effort
delete the old object. If the RPC response is lost after a possible commit, the
route rereads canonical Account state before deleting anything; an ambiguous
new object is retained rather than risking a dangling pointer. Browser session
payloads contain only avatar kind, preset key and revision; they never expose a
Storage path, signed token or internal Account identifier.

## Rendering and accessibility

- Header avatar: `40 × 40`, `12 px` radius, `object-fit: cover`, decorative
  alternative text because the trigger already has an accessible Account name.
- Settings keeps the avatar surface compact: the current `80 × 80` image and
  only two actions, `Загрузить фото` and `Выбрать аватар`. The twenty preset
  files are not rendered until the picker dialog opens.
- `Выбрать аватар` opens a modal preview and one native radio group with twenty
  labelled choices, visible selection, keyboard focus and touch targets of at
  least `44 px`. Selection is applied only by an explicit `Сохранить`; close,
  backdrop, Escape and `Отмена` discard it and return focus to the trigger.
- `Загрузить фото` opens the operating-system file picker. A valid file then
  opens a separate square preview dialog with `Сохранить`, `Отмена` and
  `Выбрать другое фото`; choosing a file alone never mutates the Account.
- If an image cannot load, render the Account initials without changing or
  clearing the saved avatar.
