'use client';

export type AdultRole = 'parent' | 'teacher';

export type AuthResolution =
  | { kind: 'student'; authEmail: string }
  | { kind: 'adult'; email: string };

export function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export function isEmail(value: string) {
  return /.+@.+\..+/.test(value);
}

export function toRoleLabel(role: AdultRole) {
  return role === 'parent' ? 'Родитель' : 'Преподаватель';
}

export function toRoleRoute(role: AdultRole) {
  return role === 'parent' ? '/dashboard/parent' : '/dashboard/teacher';
}
