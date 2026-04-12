# Repository cleanup audit — 2026-04-12

## 1) Summary of major cleanup actions

- Extracted large static landing content from `landing-page.tsx` into `src/components/landing/content.ts` to separate content/config from rendering logic.
- Unified class-name helper usage via shared `cn()` utility in `src/lib/ui/cn.ts` and removed duplicated local helpers in key UI primitives.
- Standardized docs entrypoint and navigation (`README.md`, `docs/index.md`) and corrected authorization doc naming.
- Added route map and DB schema hygiene notes to reduce discoverability gaps.

## 2) Files/components/docs removed

- `docs/autorization.md` (renamed for correctness).

## 3) Files/components/docs consolidated

- `src/components/landing-page.tsx` content constants -> `src/components/landing/content.ts`.
- Repeated local class join helpers consolidated into `src/lib/ui/cn.ts`.
- README condensed into operational entrypoint; deep material delegated to docs index.

## 4) UI/UX consistency improvements made

- Shared class-name combinator (`cn`) now used in navigation primitives and reusable app components (`AppCard`, `AppPageHeader`, `SemanticChip`, `SiteHeader`).
- Landing page became easier to maintain by separating static product copy and icon cards from UI behavior.

## 5) DB/migration hygiene findings

- Migration chain preserved to avoid production risk.
- Added explicit hygiene note documenting what is intentionally kept and what should be handled in a later dedicated migration pass.
- Deferred risky cleanup items (seed separation, baseline migration) with explicit safety notes.

## 6) Remaining risks / deferred items

- `toLessonWorkspaceRoute` remains as compatibility alias; marked as deprecated, gradual replacement recommended.
- Full CSS concern-splitting from `src/app/globals.css` is still pending and should be done in a dedicated pass with visual regression checks.
- Migration seed/bootstrap extraction still requires deployment-path validation.

## 7) Verification performed

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
