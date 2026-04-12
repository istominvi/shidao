# Route map (canonical)

## Public

- `/` — marketing landing

## Auth

- `/login`
- `/join`
- `/join/check-email`
- `/forgot-password`
- `/reset-password`
- `/auth/confirm`

## Protected app

- `/onboarding`
- `/dashboard`
- `/groups`
- `/groups/new`
- `/groups/[groupId]`
- `/groups/[groupId]/students/[studentId]/communication`
- `/students/new`
- `/lessons`
- `/lessons/demo`
- `/lessons/[scheduledLessonId]`
- `/methodologies`
- `/methodologies/[methodologySlug]`
- `/methodologies/[methodologySlug]/lessons/[lessonId]`
- `/settings/profile`
- `/settings/security`
- `/settings/team`

## API routes

- Auth: `/api/auth/*`
- Onboarding: `/api/onboarding`
- Teacher domain: `/api/teacher/*`
- Student domain: `/api/student/*`
- Settings: `/api/settings/*`, `/api/preferences/*`
- Admin invite: `/api/admin/invite`
