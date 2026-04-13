# UI/UX cleanup + repo hygiene report (2026-04-13)

## 1) Deleted

- No production code paths were hard-deleted in this pass.
- Conservative policy applied: keep behavior-safe changes and avoid risky deletions in active surfaces.

## 2) Moved / archived

- Moved DB hygiene historical note to archive:
  - `docs/database/schema-hygiene-2026-04-12.md` → `docs/archive/database/schema-hygiene-2026-04-12.md`
- Added explicit archive boundary docs:
  - `docs/archive/README.md`

## 3) Large components split

- Landing page monolith split into section components:
  - `src/components/landing-page.tsx`
  - `src/components/landing/sections.tsx`
- Session menu responsibilities split:
  - `src/components/session-nav-actions.tsx`
  - `src/components/session-nav/use-session-menu-behavior.ts`
  - `src/components/session-nav/session-menu-panel.tsx`
- Parent dashboard split into focused sections:
  - `src/components/dashboard/parent-dashboard.tsx`
  - `src/components/dashboard/parent-dashboard-sections.tsx`
- Student dashboard split into focused sections:
  - `src/components/dashboard/student-dashboard.tsx`
  - `src/components/dashboard/student-dashboard-sections.tsx`

## 4) UI/UX simplifications

- Landing composition simplified for clearer hierarchy:
  - what product is,
  - why it matters,
  - methodology,
  - workflow,
  - role-based fit,
  - FAQ + CTA.
- Reduced decorative noise in hero/section composition (fewer ornamental chips and visual effects).
- Onboarding role selection made more direct with clearer action states.
- Dashboard content grouped into clearer task blocks (summary vs lessons vs homework vs communication).

## 5) DB hygiene / docs improvements

- Added canonical migration hygiene guidance:
  - `docs/database/migration-guidelines.md`
- Reinforced source-of-truth boundaries in docs:
  - `docs/index.md`
  - `README.md`
- Guidance explicitly separates:
  - schema-focused migrations,
  - required compatibility data migrations,
  - bootstrap/product content pathways.

## 6) Intentionally NOT changed for safety

- Routing/auth contracts and canonical route map were not changed.
- Profile switching behavior and session refresh pattern were preserved.
- Historical migrations under `supabase/migrations/*` were not modified.
- Current schema snapshot/docs content was not altered (no schema migration introduced).

## 7) Manual follow-up recommendations

- Run a follow-up dead-code pass with usage tooling after a release cycle to remove now-unused marketing CSS classes.
- Add a dedicated bootstrap/seed command if product-content seeding grows beyond current module-level flows.
- Consider a visual regression check for landing/dashboard surfaces to lock in calmer UI density.
