'use client';

export type ProfileKind = 'parent' | 'teacher';

export function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export function isEmail(value: string) {
  return /.+@.+\..+/.test(value);
}

export function toProfileLabel(profile: ProfileKind) {
  return profile === 'parent' ? 'Родитель' : 'Преподаватель';
}

export function toProfileRoute(profile: ProfileKind) {
  return profile === 'parent' ? '/dashboard/parent' : '/dashboard/teacher';
}
