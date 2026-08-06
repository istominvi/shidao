"use client";

import Link from "next/link";
import { LoaderCircle, Save, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  loadLearnerProfiles,
  replaceCourseAudience,
} from "@/components/lesson-runs/lesson-run-client";
import type { LessonRunMutationRunner } from "@/components/lesson-runs/lesson-run-dialog";
import { Button, productButtonClassName } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type { LearnerProfile } from "@/modules/lesson-runs/domain";

export function CourseAudienceDialog({
  courseId,
  courseTitle,
  audience,
  disabled,
  mutationError,
  runMutation,
  onClose,
}: {
  courseId: string;
  courseTitle: string;
  audience: LearnerProfile[];
  disabled: boolean;
  mutationError?: string | null;
  runMutation: LessonRunMutationRunner;
  onClose: () => void;
}) {
  const [profiles, setProfiles] = useState<LearnerProfile[] | null>(null);
  const [selectedIds, setSelectedIds] = useState(() =>
    audience.map((profile) => profile.id),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationFailed, setMutationFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void loadLearnerProfiles()
      .then((items) => {
        if (active) setProfiles(items);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setLoadError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить учебные профили.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || disabled) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onClose]);

  async function save() {
    setMutationFailed(false);
    const saved = await runMutation("Сохраняем аудиторию курса…", () =>
      replaceCourseAudience(courseId, selectedIds),
    );
    if (!saved) setMutationFailed(true);
    if (saved) onClose();
  }

  return (
    <DialogShell
      title="Аудитория курса"
      description={`Выберите учеников для курса «${courseTitle}». При назначении урока они будут выбраны по умолчанию.`}
      onClose={() => {
        if (!disabled) onClose();
      }}
      panelClassName="max-w-2xl"
    >
      {loadError ? (
        <p className="app-alert app-alert-error" role="alert">
          {loadError}
        </p>
      ) : null}

      {mutationFailed ? (
        <p className="app-alert app-alert-error mb-4" role="alert">
          {mutationError ??
            "Не удалось сохранить аудиторию. Попробуйте ещё раз."}
        </p>
      ) : null}

      {!loadError && !profiles ? (
        <p
          className="flex items-center gap-2 py-6 text-sm text-neutral-600"
          role="status"
        >
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Загружаем учеников…
        </p>
      ) : null}

      {profiles?.length ? (
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset className="lesson-run-audience-picker">
            <legend>
              <Users className="h-4 w-4" aria-hidden="true" />
              Ученики курса
            </legend>
            <div className="lesson-run-audience-actions">
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(profiles.map((profile) => profile.id))
                }
              >
                Выбрать всех
              </button>
              <button type="button" onClick={() => setSelectedIds([])}>
                Снять выбор
              </button>
            </div>
            <div className="lesson-run-audience-options">
              {profiles.map((profile) => (
                <label key={profile.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(profile.id)}
                    onChange={(event) =>
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...current, profile.id]
                          : current.filter((id) => id !== profile.id),
                      )
                    }
                  />
                  <span>{profile.displayName}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="dialog-shell-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={disabled}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Сохранить аудиторию
            </Button>
          </div>
        </form>
      ) : null}

      {profiles?.length === 0 ? (
        <div className="lesson-run-no-audience py-8 text-center">
          <UserPlus className="mx-auto h-7 w-7" aria-hidden="true" />
          <p>Сначала создайте хотя бы один учебный профиль.</p>
          <Link
            href="/students"
            className={productButtonClassName("secondary", "mt-4")}
          >
            Добавить ученика
          </Link>
        </div>
      ) : null}
    </DialogShell>
  );
}
