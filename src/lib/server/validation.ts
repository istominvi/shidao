import { normalizeIdentifier, type ProfileKind } from "../auth";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

export type Parser<T> = (payload: unknown) => ValidationResult<T>;

function asRecord(payload: unknown) {
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null;
}

function ensureString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function validateEmail(value: string, message = "Укажите корректный email.") {
  const normalized = value.trim().toLowerCase();
  if (!/.+@.+\..+/.test(normalized)) {
    return { success: false as const, message };
  }
  return { success: true as const, value: normalized };
}

export function validatePin(value: string) {
  const pin = value.trim();
  if (!/^\d{4,8}$/.test(pin)) {
    return { success: false as const, message: "PIN должен состоять из 4-8 цифр." };
  }
  return { success: true as const, value: pin };
}

function parseProfile(value: unknown): ProfileKind | null {
  return value === "parent" || value === "teacher" ? value : null;
}

export const loginPayloadSchema: Parser<{ identifier: string; secret: string }> = (
  payload,
) => {
  const record = asRecord(payload);
  if (!record) {
    return { success: false, message: "Неверные данные для входа." };
  }

  const identifier = normalizeIdentifier(ensureString(record.identifier));
  const secret = ensureString(record.secret).trim();
  if (!identifier || !secret) {
    return { success: false, message: "Неверные данные для входа." };
  }

  return { success: true, data: { identifier, secret } };
};

export const invitePayloadSchema: Parser<{ email: string }> = (payload) => {
  const record = asRecord(payload);
  if (!record) return { success: false, message: "Укажите корректный email." };

  const email = validateEmail(ensureString(record.email));
  if (!email.success) return { success: false, message: email.message };
  return { success: true, data: { email: email.value } };
};

export const profileSwitchPayloadSchema: Parser<{ profile: ProfileKind }> = (
  payload,
) => {
  const record = asRecord(payload);
  if (!record) return { success: false, message: "Некорректный профиль." };

  const profile = parseProfile(record.profile);
  if (!profile) return { success: false, message: "Некорректный профиль." };
  return { success: true, data: { profile } };
};

export const onboardingPayloadSchema = profileSwitchPayloadSchema;

export const securityPinPayloadSchema: Parser<{ newPin: string; currentSecret: string }> = (
  payload,
) => {
  const record = asRecord(payload);
  if (!record) return { success: false, message: "PIN должен состоять из 4-8 цифр." };

  const newPin = validatePin(ensureString(record.newPin));
  if (!newPin.success) return { success: false, message: newPin.message };

  return {
    success: true,
    data: {
      newPin: newPin.value,
      currentSecret: ensureString(record.currentSecret).trim(),
    },
  };
};

export const changeEmailPayloadSchema: Parser<{
  newEmail: string;
  currentPassword: string;
}> = (payload) => {
  const record = asRecord(payload);
  if (!record) return { success: false, message: "Проверьте корректность данных." };

  const email = validateEmail(
    ensureString(record.newEmail),
    "Укажите корректный новый email.",
  );
  if (!email.success) return { success: false, message: email.message };

  const currentPassword = ensureString(record.currentPassword);
  if (!currentPassword) {
    return {
      success: false,
      message: "Введите текущий пароль для подтверждения действия.",
    };
  }

  return {
    success: true,
    data: { newEmail: email.value, currentPassword },
  };
};
