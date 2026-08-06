"use client";

import Link from "next/link";
import { LoaderCircle, Save, Search, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  loadLearnerGroups,
  loadLearnerProfiles,
  replaceCourseAudience,
} from "@/components/lesson-runs/lesson-run-client";
import type { LessonRunMutationRunner } from "@/components/lesson-runs/lesson-run-dialog";
import { Button, productButtonClassName } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type {
  CourseAudience,
  LearnerGroup,
  LearnerProfile,
} from "@/modules/lesson-runs/domain";

function learnerCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ученик`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} ученика`;
  }
  return `${count} учеников`;
}

function groupCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} группа`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} группы`;
  }
  return `${count} групп`;
}

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
  audience: CourseAudience;
  disabled: boolean;
  mutationError?: string | null;
  runMutation: LessonRunMutationRunner;
  onClose: () => void;
}) {
  const [profiles, setProfiles] = useState<LearnerProfile[] | null>(null);
  const [groups, setGroups] = useState<LearnerGroup[] | null>(null);
  const [selectedDirectIds, setSelectedDirectIds] = useState(() =>
    audience.directLearners.map((profile) => profile.id),
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState(() =>
    audience.groups.map((group) => group.id),
  );
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationFailed, setMutationFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([loadLearnerProfiles(), loadLearnerGroups()])
      .then(([learnerProfiles, learnerGroups]) => {
        if (!active) return;
        setProfiles(learnerProfiles.filter((profile) => !profile.archivedAt));
        setGroups(learnerGroups);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setLoadError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить учеников и группы.",
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

  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const visibleGroups = useMemo(
    () =>
      (groups ?? []).filter(
        (group) =>
          group.name.toLocaleLowerCase("ru-RU").includes(normalizedQuery) ||
          group.members.some((member) =>
            member.displayName
              .toLocaleLowerCase("ru-RU")
              .includes(normalizedQuery),
          ),
      ),
    [groups, normalizedQuery],
  );
  const visibleProfiles = useMemo(
    () =>
      (profiles ?? []).filter((profile) => {
        const memberGroupNames = (groups ?? [])
          .filter((group) =>
            group.members.some((member) => member.id === profile.id),
          )
          .map((group) => group.name);
        return (
          profile.displayName
            .toLocaleLowerCase("ru-RU")
            .includes(normalizedQuery) ||
          memberGroupNames.some((name) =>
            name.toLocaleLowerCase("ru-RU").includes(normalizedQuery),
          )
        );
      }),
    [groups, normalizedQuery, profiles],
  );
  const selectedGroups = (groups ?? []).filter((group) =>
    selectedGroupIds.includes(group.id),
  );
  const effectiveIds = new Set(selectedDirectIds);
  for (const group of selectedGroups) {
    for (const member of group.members) effectiveIds.add(member.id);
  }
  const effectiveCount = effectiveIds.size;
  const ready = profiles !== null && groups !== null;

  function selectedGroupNamesFor(profileId: string) {
    return selectedGroups
      .filter((group) =>
        group.members.some((member) => member.id === profileId),
      )
      .map((group) => group.name);
  }

  async function save() {
    setMutationFailed(false);
    const saved = await runMutation("Сохраняем аудиторию курса…", () =>
      replaceCourseAudience(courseId, {
        directLearnerProfileIds: selectedDirectIds,
        learnerGroupIds: selectedGroupIds,
      }),
    );
    if (!saved) setMutationFailed(true);
    if (saved) onClose();
  }

  return (
    <DialogShell
      title="Аудитория курса"
      description={`Добавьте группы и отдельных учеников в курс «${courseTitle}». Один ученик учитывается один раз, даже если выбран несколькими способами.`}
      onClose={() => {
        if (!disabled) onClose();
      }}
      panelClassName="max-w-3xl"
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

      {!loadError && !ready ? (
        <p
          className="flex items-center gap-2 py-6 text-sm text-neutral-600"
          role="status"
        >
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Загружаем учеников и группы…
        </p>
      ) : null}

      {ready ? (
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="teaching-hub-search course-audience-search">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Найти ученика или группу</span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти ученика или группу"
            />
          </label>

          <fieldset className="lesson-run-audience-picker course-audience-picker">
            <legend>
              <Users className="h-4 w-4" aria-hidden="true" />
              Группы
            </legend>
            {(groups ?? []).length > 0 ? (
              <>
                <div className="lesson-run-audience-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedGroupIds(
                        (groups ?? []).map((group) => group.id),
                      )
                    }
                  >
                    Выбрать все группы
                  </button>
                  <button type="button" onClick={() => setSelectedGroupIds([])}>
                    Снять группы
                  </button>
                </div>
                <div className="lesson-run-audience-options course-audience-options">
                  {visibleGroups.map((group) => (
                    <label key={group.id}>
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.includes(group.id)}
                        onChange={(event) =>
                          setSelectedGroupIds((current) =>
                            event.target.checked
                              ? [...current, group.id]
                              : current.filter((id) => id !== group.id),
                          )
                        }
                      />
                      <span className="course-audience-option-copy">
                        <strong>{group.name}</strong>
                        <small>{learnerCountLabel(group.members.length)}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <p className="student-directory-picker-empty">
                Групп пока нет. Их можно создать в разделе{" "}
                <Link href="/students">«Ученики»</Link>.
              </p>
            )}
          </fieldset>

          <fieldset className="lesson-run-audience-picker course-audience-picker">
            <legend>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Отдельные ученики
            </legend>
            {(profiles ?? []).length > 0 ? (
              <>
                <div className="lesson-run-audience-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDirectIds(
                        (profiles ?? []).map((profile) => profile.id),
                      )
                    }
                  >
                    Выбрать всех отдельно
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDirectIds([])}
                  >
                    Снять отдельных
                  </button>
                </div>
                <div className="lesson-run-audience-options course-audience-options">
                  {visibleProfiles.map((profile) => {
                    const inheritedThrough = selectedGroupNamesFor(profile.id);
                    return (
                      <label key={profile.id}>
                        <input
                          type="checkbox"
                          checked={selectedDirectIds.includes(profile.id)}
                          onChange={(event) =>
                            setSelectedDirectIds((current) =>
                              event.target.checked
                                ? [...current, profile.id]
                                : current.filter((id) => id !== profile.id),
                            )
                          }
                        />
                        <span className="course-audience-option-copy">
                          <strong>{profile.displayName}</strong>
                          {inheritedThrough.length > 0 ? (
                            <small>
                              Уже входит через: {inheritedThrough.join(", ")}
                            </small>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="lesson-run-no-audience">
                <p>Учеников пока нет.</p>
                <Link href="/students">Добавить ученика</Link>
              </div>
            )}
          </fieldset>

          {normalizedQuery &&
          visibleGroups.length === 0 &&
          visibleProfiles.length === 0 ? (
            <p className="student-directory-picker-empty">
              По вашему запросу ничего не найдено.
            </p>
          ) : null}

          <div className="course-audience-summary" aria-live="polite">
            <strong>
              Выбрано: {groupCountLabel(selectedGroupIds.length)},{" "}
              {learnerCountLabel(selectedDirectIds.length)} отдельно ·{" "}
              {learnerCountLabel(effectiveCount)} в курсе
            </strong>
            <p>
              Изменения состава прикреплённой группы повлияют на будущую
              аудиторию курса. Уже назначенные уроки не изменятся. ИИ будет
              учитывать уникальные профили и их учебную историю при подготовке
              следующих уроков.
            </p>
          </div>

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

      {ready && profiles?.length === 0 && groups?.length === 0 ? (
        <div className="lesson-run-no-audience py-3 text-center">
          <Link
            href="/students"
            className={productButtonClassName("secondary", "mt-2")}
          >
            Добавить ученика или группу
          </Link>
        </div>
      ) : null}
    </DialogShell>
  );
}
