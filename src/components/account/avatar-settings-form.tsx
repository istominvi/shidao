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
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
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
type AvatarDialog = "preset" | "custom" | null;

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
  const presetDescriptionId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, refetchSession } = useSessionView();
  const avatar = state.kind === "account" ? state.avatar : null;
  const avatarKind = avatar?.kind;
  const avatarPresetKey = avatar?.presetKey;
  const avatarRevision = avatar?.revision;
  const [dialog, setDialog] = useState<AvatarDialog>(null);
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

  useEffect(() => {
    if (!dialog) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || saving) return;
      event.preventDefault();
      setDialog(null);
      setCustomFile(null);
      setSelectedPreset(
        avatarKind === "preset"
          ? (avatarPresetKey ?? DEFAULT_AVATAR_PRESET_KEY)
          : null,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [avatarKind, avatarPresetKey, dialog, saving]);

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
  const currentPreset = selectedPresetFromAvatar(currentAvatar);
  const previewAvatar: AccountAvatarView = selectedPreset
    ? {
        kind: "preset",
        presetKey: selectedPreset,
        revision: currentAvatar.revision,
      }
    : currentAvatar;
  const presetUnchanged =
    currentAvatar.kind === "preset" && selectedPreset === currentPreset;

  function resetMessages() {
    setError(null);
    setSuccess(null);
  }

  function closeDialog() {
    if (saving) return;
    setDialog(null);
    setCustomFile(null);
    setSelectedPreset(currentPreset);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openPresetDialog() {
    resetMessages();
    setCustomFile(null);
    setSelectedPreset(currentPreset);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setDialog("preset");
  }

  function openFilePicker() {
    resetMessages();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function selectPreset(presetKey: AvatarPresetKey) {
    setError(null);
    setSelectedPreset(presetKey);
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
    setDialog("custom");
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
        if (response.status === 409) {
          await refetchSession();
          setDialog(null);
        }
        await throwAvatarActionError(
          response,
          "Не удалось сохранить выбранный аватар.",
        );
      }

      await refetchSession();
      setDialog(null);
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
    if (!customFile || saving) return;
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
        if (response.status === 409) {
          await refetchSession();
          setDialog(null);
          setCustomFile(null);
        }
        await throwAvatarActionError(
          response,
          "Не удалось загрузить изображение.",
        );
      }

      await refetchSession();
      setDialog(null);
      setCustomFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess("Фото сохранено как аватар.");
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
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <AvatarImage
          avatar={currentAvatar}
          initials={state.initials}
          alt="Текущий аватар"
          size={80}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={openFilePicker}>
            <Upload size={16} aria-hidden="true" />
            Загрузить фото
          </Button>
          <Button type="button" onClick={openPresetDialog}>
            <ImagePlus size={16} aria-hidden="true" />
            Выбрать аватар
          </Button>
        </div>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={chooseCustomFile}
          disabled={saving !== null}
          tabIndex={-1}
          aria-label="Выбрать фото на компьютере"
        />
      </div>

      {!dialog && (error || success) ? (
        <div className="mt-4" aria-live="polite" aria-atomic="true">
          {error ? <StatusMessage kind="error">{error}</StatusMessage> : null}
          {success ? (
            <StatusMessage kind="success">{success}</StatusMessage>
          ) : null}
        </div>
      ) : null}

      {dialog === "preset" ? (
        <DialogShell
          title="Выберите аватар"
          description="Выберите один из 20 фирменных вариантов и сохраните изменения."
          onClose={closeDialog}
          closeLabel="Закрыть выбор аватара"
          panelClassName="max-w-2xl"
        >
          <form onSubmit={savePreset}>
            <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-white p-3">
              <AvatarImage
                avatar={previewAvatar}
                initials={state.initials}
                alt="Предпросмотр выбранного аватара"
                size={72}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950">
                  {selectedPresetDetails?.label ?? "Текущий аватар"}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  Так аватар будет выглядеть в профиле.
                </p>
              </div>
            </div>

            <fieldset
              disabled={saving !== null}
              aria-describedby={presetDescriptionId}
              className="mt-4"
            >
              <legend className="sr-only">Фирменные аватары</legend>
              <p id={presetDescriptionId} className="sr-only">
                Можно выбрать только один вариант. Профиль нельзя оставить без
                аватара.
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
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
                          width={112}
                          height={112}
                          unoptimized
                          sizes="(max-width: 640px) 22vw, 104px"
                          className="h-full w-full rounded-[0.55rem] object-cover"
                        />
                        {selected ? (
                          <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-md bg-neutral-950 text-white shadow-sm">
                            <Check
                              size={13}
                              strokeWidth={3}
                              aria-hidden="true"
                            />
                            <span className="sr-only">Выбрано</span>
                          </span>
                        ) : null}
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            {error ? (
              <div className="mt-4" aria-live="polite">
                <StatusMessage kind="error">{error}</StatusMessage>
              </div>
            ) : null}

            <div className="dialog-shell-actions">
              <Button
                type="submit"
                disabled={!selectedPreset || presetUnchanged || saving !== null}
                aria-busy={saving === "preset"}
              >
                {saving === "preset" ? "Сохраняем…" : "Сохранить"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={saving !== null}
                onClick={closeDialog}
              >
                Отмена
              </Button>
            </div>
          </form>
        </DialogShell>
      ) : null}

      {dialog === "custom" && customFile && customPreviewUrl ? (
        <DialogShell
          title="Новое фото"
          description="Проверьте изображение перед сохранением. Оно будет кадрировано до квадрата."
          onClose={closeDialog}
          closeLabel="Закрыть загрузку фото"
          panelClassName="max-w-lg"
        >
          <form onSubmit={uploadCustomAvatar}>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-black/5 bg-white p-4 text-center">
              <span className="relative h-36 w-36 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                <Image
                  src={customPreviewUrl}
                  alt="Предпросмотр нового фото"
                  fill
                  sizes="144px"
                  unoptimized
                  className="object-cover"
                />
              </span>
              <p className="max-w-full truncate text-sm font-medium text-neutral-700">
                {customFile.name}
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={saving !== null}
                onClick={openFilePicker}
              >
                Выбрать другое фото
              </Button>
            </div>

            {error ? (
              <div className="mt-4" aria-live="polite">
                <StatusMessage kind="error">{error}</StatusMessage>
              </div>
            ) : null}

            <div className="dialog-shell-actions">
              <Button
                type="submit"
                disabled={saving !== null}
                aria-busy={saving === "custom"}
              >
                {saving === "custom" ? "Сохраняем…" : "Сохранить"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={saving !== null}
                onClick={closeDialog}
              >
                Отмена
              </Button>
            </div>
          </form>
        </DialogShell>
      ) : null}
    </>
  );
}
