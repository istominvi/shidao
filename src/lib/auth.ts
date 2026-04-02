export type ProfileKind = 'parent' | 'teacher';

const STUDENT_AUTH_DOMAIN = 'students.shidao.internal';

export function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export function isEmail(value: string) {
  return /.+@.+\..+/.test(value);
}

export function toStudentInternalAuthEmail(login: string) {
  return `${normalizeIdentifier(login)}@${STUDENT_AUTH_DOMAIN}`;
}

export function toProfileLabel(profile: ProfileKind) {
  return profile === 'parent' ? 'Родитель' : 'Преподаватель';
}

export function toProfileRoute(profile: ProfileKind) {
  return profile === 'parent' ? '/dashboard/parent' : '/dashboard/teacher';
}
