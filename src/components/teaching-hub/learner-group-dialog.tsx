"use client";

import { LoaderCircle, Save, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type {
  LearnerGroup,
  LearnerProfile,
} from "@/modules/lesson-runs/domain";

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

export function LearnerGroupDialog({
  group,
  profiles,
  busy,
  error,
  onClose,
  onSave,
  onDelete,
}: {
  group: LearnerGroup | null;
  profiles: LearnerProfile[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (name: string, learnerProfileIds: string[]) => Promise<void>;
  onDelete: (() => Promise<void>) | null;
}) {
  const initialMemberIds = group?.members.map((member) => member.id) ?? [];
  const [name, setName] = useState(group?.name ?? "");
  const [selectedProfileIds, setSelectedProfileIds] =
    useState(initialMemberIds);
  const [profileQuery, setProfileQuery] = useState("");
  const normalizedProfileQuery = profileQuery.trim().toLocaleLowerCase("ru-RU");
  const visibleProfiles = profiles.filter((profile) =>
    profile.displayName
      .toLocaleLowerCase("ru-RU")
      .includes(normalizedProfileQuery),
  );
  const dirty =
    name.trim() !== (group?.name ?? "") ||
    !sameIds(selectedProfileIds, initialMemberIds);

  const requestClose = useCallback(() => {
    if (busy) return;
    if (
      dirty &&
      !window.confirm(
        "Закрыть без сохранения? Изменения группы будут потеряны.",
      )
    ) {
      return;
    }
    onClose();
  }, [busy, dirty, onClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      requestClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, requestClose]);

  return (
    <DialogShell
      title={group ? "Редактировать группу" : "Новая группа"}
      description={
        group
          ? "Измените название или состав группы. Один ученик может состоять в нескольких группах."
          : "Группа объединяет существующих учеников и может быть прикреплена к нескольким курсам."
      }
      onClose={requestClose}
      panelClassName="max-w-2xl"
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          const nextName = name.trim();
          if (nextName) void onSave(nextName, selectedProfileIds);
        }}
      >
        <label>
          <span className="field-label">Название группы</span>
          <input
            autoFocus
            required
            minLength={1}
            maxLength={160}
            className="field-input"
            placeholder="Например, Teen Talk"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <fieldset className="student-directory-picker">
          <legend>Ученики</legend>
          {profiles.length > 0 ? (
            <>
              <div className="student-directory-picker-toolbar">
                <label className="student-directory-picker-search">
                  <span className="sr-only">Найти ученика</span>
                  <input
                    value={profileQuery}
                    onChange={(event) => setProfileQuery(event.target.value)}
                    placeholder="Найти ученика"
                  />
                </label>
                <span aria-live="polite">
                  Выбрано: {selectedProfileIds.length}
                </span>
              </div>
              <div className="student-directory-picker-options">
                {visibleProfiles.map((profile) => (
                  <label key={profile.id}>
                    <input
                      type="checkbox"
                      checked={selectedProfileIds.includes(profile.id)}
                      onChange={(event) =>
                        setSelectedProfileIds((current) =>
                          event.target.checked
                            ? [...current, profile.id]
                            : current.filter((id) => id !== profile.id),
                        )
                      }
                    />
                    <span>{profile.displayName}</span>
                  </label>
                ))}
                {visibleProfiles.length === 0 ? (
                  <p className="student-directory-picker-empty">
                    Ученики не найдены.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="student-directory-picker-empty">
              Учеников пока нет. Пустую группу можно заполнить позже.
            </p>
          )}
        </fieldset>

        {error ? (
          <p className="app-alert app-alert-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="dialog-shell-actions student-directory-dialog-actions">
          {group && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="product-btn-danger student-directory-delete-action"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Удалить группу «${group.name}»? Она исчезнет из курсов, но ученики и их учебная история сохранятся. Уже назначенные уроки не изменятся.`,
                  )
                ) {
                  void onDelete();
                }
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Удалить
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={requestClose}
          >
            Отмена
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : group ? (
              <Save className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Users className="h-4 w-4" aria-hidden="true" />
            )}
            {group ? "Сохранить" : "Создать группу"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
