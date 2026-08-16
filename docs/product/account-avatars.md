# Account avatars

Status: **current production** for the ShiDao V2 Account avatar state and
profile surface; responsive preset/private delivery and header-trigger
simplification are **current source / next production**.

Current functional application source:
`1d4e5deff83cbdc1b479b16e4220cf799327009f`; initial unified Profile/avatar
rollout: `4462da2248dd97bf6ab5c0a35f9a781844473874`.

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
crop and the shared `12 px` product radius. In current source, public presets
use the built-in `next/image` + Sharp responsive optimizer at quality `75` with
surface-specific `sizes`; the source path is restricted by
`images.localPatterns` and the shared public-image cache floor is seven days.
The `512 × 512` WebP remains the source-controlled master, not the response
size for every viewport. This uses the existing Sharp dependency and adds no
external image service. The cross-surface delivery policy is canonical in
[`docs/architecture/image-delivery.md`](../architecture/image-delivery.md).

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
new object is retained rather than risking a dangling pointer. Browser
SessionView contains avatar kind, preset key and revision. For a custom avatar,
current source additionally exposes only an opaque delivery key derived
server-side for the authenticated Account and exact revision; it never exposes
a Storage path, signed token, Auth/Account identifier or signing secret.

### Current source / next production private delivery

Custom avatars intentionally do not use the default `/_next/image` optimizer:
that request path is not the owner authorization boundary and must not be
allowed to cache private bytes across Accounts. `AvatarImage` uses a custom
loader that calls the same-origin authenticated avatar GET route directly and
requests only an allowlisted square width from `32` through `512`.

The route authenticates first, rereads canonical Account/avatar state and then
requires an exact revision. Its optional cache address is a domain-separated
opaque HMAC delivery key derived from Auth user identity plus revision with the
server session secret. A supplied malformed/mismatched key fails closed; width
values outside the fixed allowlist are rejected. The valid cacheable response
uses `Cache-Control: private, max-age=31536000, immutable`, `Vary: Cookie` and
an ETag bound to delivery key + width. Conditional `304` is returned only after
Account authorization. A legacy request without the opaque key remains
authenticated but receives `private, no-store`.

This key is a cache-isolation address, not a bearer capability: logout,
cross-Account access and revision changes still fail the ordinary authorization
checks. Accounts may share the same revision number, so revision alone is
never treated as a globally unique cache key. The route downloads the private
`512 × 512` normalized master only after those checks and uses the existing
Sharp runtime to produce smaller WebP variants; it does not make the Storage
object or a signed URL public.

## Rendering and accessibility

- Current production header avatar: `40 × 40`, `12 px` radius,
  `object-fit: cover`, decorative alternative text because the trigger already
  has an accessible Account name.
- Current source / next production protected mobile header replaces that
  visible avatar with a `20 px` burger inside the same `40 × 40` accessible
  trigger. This burger opens the only navigation dropdown: its header shows
  Account name and a privacy-safe email when available, and its items are only
  `Расписание / Ученики / Курсы / Магазин / Профиль`.
- Current source / next production protected desktop and authenticated landing
  keep the selected avatar visible, but it is a direct accessible link to
  `/profile`. The former Account/avatar dropdown, its profile-tab shortcuts
  and sign-out item are removed; those destinations/actions remain available
  inside the addressable `/profile` section. Avatar selection/storage remains
  Account state and is not changed by this navigation presentation rule.
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
- Account initials are present immediately underneath the image while it loads;
  the image fades in after `load`. If loading fails, initials remain visible
  without changing or clearing the saved avatar. Reduced-motion disables the
  fade transition.

## Implementation map

- manifest, stable keys and browser projection helpers:
  `src/lib/account-avatar.ts`;
- shared renderer and compact settings flow:
  `src/components/account/avatar-image.tsx` and
  `src/components/account/avatar-settings-form.tsx`;
- Account settings/profile integration:
  `src/components/account/account-settings-panel.tsx`,
  `src/app/(app)/profile/page.tsx` and `src/lib/navigation/profile-nav.ts`;
- responsive protected/landing direct profile link and protected-mobile
  navigation menu composition:
  `src/components/session-nav-actions.tsx`;
- same-origin API, authenticated delivery and normalization/storage/
  reconciliation boundary:
  `src/app/api/settings/profile/avatar/route.ts`,
  `src/lib/server/profile-avatar-delivery.ts`,
  `src/lib/server/profile-avatar-image.ts`,
  `src/lib/server/profile-avatar-storage.ts` and
  `src/lib/server/profile-avatar-reconciliation.ts`;
- immutable preset assets: `public/avatars/presets/`;
- physical Account/Storage contract:
  `supabase/migrations/20260814050347_account_profile_avatars.sql`.

## Current production acceptance

Exact release `4462da2248dd97bf6ab5c0a35f9a781844473874` is deployed. Production
postflight confirmed all twenty `/avatars/presets/sd-avatar-v1-XX.webp` files
return direct `200 image/webp` responses with no redirects; the deployed
profile chunk contains the canonical `/profile`, `Выбрать аватар` and
`Загрузить фото` flows. The protected profile URLs continue to send a guest to
`/login`.

The strict production-build browser suite verifies that settings render no
preset grid before the modal opens; opening it renders all twenty direct WebP,
four columns at a `375 px` viewport and a scrollable dialog. It also verifies
keyboard/radio selection, explicit save, cancel/backdrop/Escape focus return,
and the custom-file preview/choose-another/cancel/save flow. These checks do not
claim a separate authenticated production mutation smoke; Account writes remain
covered by the API, optimistic-revision and server-image contract suites.

The direct desktop/landing `/profile` link, mobile-only navigation dropdown and
responsive image delivery are current source / next production. Their source
acceptance requires public presets to resolve through `/_next/image` at a
viewport-appropriate width, while custom avatars resolve directly through the
authenticated same-origin route with an allowlisted width. It also covers
visible initials during loading/error, exact revision/key checks, private cache
headers/ETag, two Accounts with the same numeric revision, logout/cross-Account
denial and the absence of Storage path, identity or signed token in SessionView
and image URL. The blob URL used only for the unsaved upload preview remains
`unoptimized` and never enters the shared cache.

These current-source changes still require desktop/mobile authenticated browser
acceptance and rollout postflight before becoming production evidence. The
direct `200 image/webp` and no-`/_next/image` statements above remain accurate
historical evidence for exact deployed release
`4462da2248dd97bf6ab5c0a35f9a781844473874`; they are not the target delivery
contract of the next release.
