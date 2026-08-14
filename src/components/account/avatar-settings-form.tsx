"use client";

import Image from "next/image";
import { Check, ImagePlus, Upload } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { AvatarImage } from "@/components/account/avatar-image";
import { StatusMessage } from "@/components/product-shell";
import { useSessionView } from "@/components/use-session-view";
import { Button, productButtonClassName } from "@/components/ui/button";
import {
  ACCOUNT_AVATAR_MAX_UPLOAD_BYTES,
  ACCOUNT_AVATAR_PRESETS,
  DEFAULT_AVATAR_PRESET_KEY,
  type AccountAvatarView,
  type AvatarPresetKey,
} from "@/lib/account-avatar";
import { classNames } from "@/lib/ui/classnames";

const ALLOWED_AVATAR_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const AVATAR_COLOR_LABELS = {
  blue: "голубой фон",
  green: "лаймовый фон",
  purple: "сиреневый фон",
  pink: "розовый фон",
} as const;

type AvatarActionPayload = {
  error?: string;
};

type AvatarSavingState = "preset" | "custom" | null;

async function throwAvatarActionError(
  response: Response,
  fallback: string,
): Promise<never> {
  const payload = (await response
    .json()
    .catch(() => null)) as AvatarActionPayload | null;
  throw new Error(payload?.error ?? fallback);
}

function selectedPresetFromAvatar(
  avatar: AccountAvatarView,
): AvatarPresetKey | null {
  if (avatar.kind !== "preset") return null;
  return avatar.presetKey ?? DEFAULT_AVATAR_PRESET_KEY;
}

export function AvatarSettingsForm() {
  const descriptionId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, refetchSession } = useSessionView();
  const avatar = state.kind === "account" ? state.avatar : null;
  const avatarKind = avatar?.kind;
  const avatarPresetKey = avatar?.presetKey;
  const avatarRevision = avatar?.revision;
  const [selectedPreset, setSelectedPreset] = useState<AvatarPresetKey | null>(
    avatar ? selectedPresetFromAvatar(avatar) : DEFAULT_AVATAR_PRESET_KEY,
  );
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [customPreviewUrl, setCustomPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState<AvatarSavingState>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarKind || avatarRevision === undefined) return;
    setSelectedPreset(
      avatarKind === "preset"
        ? (avatarPresetKey ?? DEFAULT_AVATAR_PRESET_KEY)
        : null,
    );
    setCustomFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [avatarKind, avatarPresetKey, avatarRevision]);

  useEffect(() => {
    if (!customFile) {
      setCustomPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(customFile);
    setCustomPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [customFile]);

  const selectedPresetDetails = useMemo(
    () =>
      selectedPreset
        ? (ACCOUNT_AVATAR_PRESETS.find(
            (preset) => preset.key === selectedPreset,
          ) ?? null)
        : null,
    [selectedPreset],
  );

  if (!avatar || state.kind !== "account") return null;
  const currentAvatar = avatar;

  const previewAvatar: AccountAvatarView = selectedPreset
    ? {
        kind: "preset",
        presetKey: selectedPreset,
        revision: currentAvatar.revision,
      }
    : currentAvatar;
  const presetUnchanged =
    currentAvatar.kind === "preset" &&
    selectedPreset === (currentAvatar.presetKey ?? DEFAULT_AVATAR_PRESET_KEY) &&
    customFile === null;

  function resetMessages() {
    setError(null);
    setSuccess(null);
  }

  function selectPreset(presetKey: AvatarPresetKey) {
    resetMessages();
    setSelectedPreset(presetKey);
    setCustomFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function chooseCustomFile(event: ChangeEvent<HTMLInputElement>) {
    resetMessages();
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (!ALLOWED_AVATAR_FILE_TYPES.has(file.type)) {
      setError("Выберите изображение JPEG, PNG или WebP.");
      event.target.value = "";
      return;
    }
    if (file.size === 0) {
      setError("Файл пустой. Выберите другое изображение.");
      event.target.value = "";
      return;
    }
    if (file.size > ACCOUNT_AVATAR_MAX_UPLOAD_BYTES) {
      setError("Изображение должно весить не больше 5 МБ.");
      event.target.value = "";
      return;
    }

    setSelectedPreset(null);
    setCustomFile(file);
  }

  async function savePreset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPreset || saving) return;
    resetMessages();

    try {
      setSaving("preset");
      const response = await fetch("/api/settings/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetKey: selectedPreset,
          expectedRevision: currentAvatar.revision,
        }),
      });
      if (!response.ok) {
        if (response.status === 409) await refetchSession();
        await throwAvatarActionError(
          response,
          "Не удалось сохранить выбранный аватар.",
        );
      }

      await refetchSession();
      setSuccess("Аватар сохранён.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить выбранный аватар.",
      );
    } finally {
      setSaving(null);
    }
  }

  async function uploadCustomAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customFile || saving) {
      if (!customFile) setError("Сначала выберите изображение.");
      return;
    }
    resetMessages();

    try {
      setSaving("custom");
      const formData = new FormData();
      formData.set("file", customFile);
      formData.set("expectedRevision", String(currentAvatar.revision));
      const response = await fetch("/api/settings/profile/avatar", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        if (response.status === 409) await refetchSession();
        await throwAvatarActionError(
          response,
          "Не удалось загрузить изображение.",
        );
      }

      await refetchSession();
      setSuccess("Ваше изображение сохранено как аватар.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось загрузить изображение.",
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-black/5 bg-white/70 p-3">
        {customPreviewUrl ? (
          <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
            <Image
              src={customPreviewUrl}
              alt="Предпросмотр нового аватара"
              fill
              sizes="80px"
              unoptimized
              className="object-cover"
            />
          </span>
        ) : (
          <AvatarImage
            avatar={previewAvatar}
            initials={state.initials}
            alt="Предпросмотр аватара"
            size={80}
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950">
            {customFile
              ? "Новое изображение"
              : (selectedPresetDetails?.label ?? "Ваше изображение")}
          </p>
          <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-neutral-600">
            Аватар обязателен и будет виден в верхнем меню. Выберите готовый
            вариант или загрузите своё изображение.
          </p>
        </div>
      </div>

      <form onSubmit={savePreset} className="space-y-4">
        <fieldset disabled={saving !== null} aria-describedby={descriptionId}>
          <legend className="text-sm font-semibold text-neutral-950">
            Готовые аватары
          </legend>
          <p
            id={descriptionId}
            className="mt-1 text-sm leading-relaxed text-neutral-600"
          >
            Можно выбрать только один вариант. Снять выбор без замены нельзя.
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-10">
            {ACCOUNT_AVATAR_PRESETS.map((preset) => {
              const selected = selectedPreset === preset.key;
              const label = `${preset.label}, ${AVATAR_COLOR_LABELS[preset.dominantColor]}`;
              return (
                <div key={preset.key} className="relative aspect-square">
                  <input
                    id={`avatar-preset-${preset.key}`}
                    className="peer sr-only"
                    type="radio"
                    name="avatar-preset"
                    value={preset.key}
                    checked={selected}
                    onChange={() => selectPreset(preset.key)}
                    aria-label={label}
                  />
                  <label
                    htmlFor={`avatar-preset-${preset.key}`}
                    title={label}
                    className={classNames(
                      "relative block h-full cursor-pointer overflow-hidden rounded-xl border-2 bg-white p-0.5 transition",
                      "hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-sm",
                      "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-neutral-950 peer-focus-visible:ring-offset-2",
                      selected
                        ? "border-neutral-950 shadow-sm"
                        : "border-transparent",
                    )}
                  >
                    <Image
                      src={preset.src}
                      alt=""
                      width={96}
                      height={96}
                      sizes="(max-width: 640px) 22vw, (max-width: 768px) 18vw, 80px"
                      className="h-full w-full rounded-[0.55rem] object-cover"
                    />
                    {selected ? (
                      <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-md bg-neutral-950 text-white shadow-sm">
                        <Check size={13} strokeWidth={3} aria-hidden="true" />
                        <span className="sr-only">Выбрано</span>
                      </span>
                    ) : null}
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>

        <Button
          type="submit"
          disabled={!selectedPreset || presetUnchanged || saving !== null}
          aria-busy={saving === "preset"}
        >
          {saving === "preset" ? "Сохраняем…" : "Сохранить выбранный"}
        </Button>
      </form>

      <div className="border-t border-black/5" aria-hidden="true" />

      <form onSubmit={uploadCustomAvatar} className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-950">
            Своё изображение или фото
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            JPEG, PNG или WebP, до 5 МБ. Изображение будет кадрировано до
            квадрата.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label
            className={productButtonClassName(
              "secondary",
              "focus-within:ring-2 focus-within:ring-neutral-950 focus-within:ring-offset-2",
            )}
          >
            <ImagePlus size={16} aria-hidden="true" />
            <span>{customFile ? "Выбрать другое" : "Выбрать изображение"}</span>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={chooseCustomFile}
              disabled={saving !== null}
            />
          </label>
          {customFile ? (
            <span className="max-w-full truncate text-sm text-neutral-600">
              {customFile.name}
            </span>
          ) : null}
        </div>

        <Button
          type="submit"
          disabled={!customFile || saving !== null}
          aria-busy={saving === "custom"}
        >
          <Upload size={16} aria-hidden="true" />
          {saving === "custom" ? "Загружаем…" : "Загрузить и сохранить"}
        </Button>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {error ? <StatusMessage kind="error">{error}</StatusMessage> : null}
        {success ? (
          <StatusMessage kind="success">{success}</StatusMessage>
        ) : null}
      </div>
    </div>
  );
}
