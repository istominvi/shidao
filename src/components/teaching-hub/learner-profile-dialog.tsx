"use client";

import { LoaderCircle, Save, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export function LearnerProfileDialog({
  profile,
  groups,
  busy,
  error,
  onClose,
  onSave,
  onDelete,
}: {
  profile: LearnerProfile | null;
  groups: LearnerGroup[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (displayName: string, learnerGroupIds: string[]) => Promise<void>;
  onDelete: (() => Promise<void>) | null;
}) {
  const initialGroupIds = useMemo(
    () =>
      profile
        ? groups
            .filter((group) =>
              group.members.some((member) => member.id === profile.id),
            )
            .map((group) => group.id)
        : [],
    [groups, profile],
  );
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [selectedGroupIds, setSelectedGroupIds] = useState(initialGroupIds);
  const [groupQuery, setGroupQuery] = useState("");
  const normalizedGroupQuery = groupQuery.trim().toLocaleLowerCase("ru-RU");
  const visibleGroups = groups.filter((group) =>
    group.name.toLocaleLowerCase("ru-RU").includes(normalizedGroupQuery),
  );
  const dirty =
    displayName.trim() !== (profile?.displayName ?? "") ||
    !sameIds(selectedGroupIds, initialGroupIds);

  const requestClose = useCallback(() => {
    if (busy) return;
    if (
      dirty &&
      !window.confirm(
        "Закрыть без сохранения? Изменения ученика будут потеряны.",
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
      title={profile ? "Редактировать ученика" : "Новый ученик"}
      description={
        profile
          ? "Измените имя или группы ученика. Учебная история останется связана с этим профилем."
          : "Создайте ученика и при необходимости сразу добавьте его в несколько групп."
      }
      onClose={requestClose}
      panelClassName="max-w-2xl"
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          const name = displayName.trim();
          if (name) void onSave(name, selectedGroupIds);
        }}
      >
        <label>
          <span className="field-label">Имя ученика</span>
          <input
            autoFocus
            required
            minLength={1}
            maxLength={160}
            className="field-input"
            placeholder="Например, Анна Петрова"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>

        <fieldset className="student-directory-picker">
          <legend>Группы</legend>
          {groups.length > 0 ? (
            <>
              <label className="student-directory-picker-search">
                <span className="sr-only">Найти группу</span>
                <input
                  value={groupQuery}
                  onChange={(event) => setGroupQuery(event.target.value)}
                  placeholder="Найти группу"
                />
              </label>
              <div className="student-directory-picker-options">
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
                    <span>{group.name}</span>
                  </label>
                ))}
                {visibleGroups.length === 0 ? (
                  <p className="student-directory-picker-empty">
                    Группы не найдены.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="student-directory-picker-empty">
              Групп пока нет. Ученика можно добавить в группу позже.
            </p>
          )}
        </fieldset>

        {error ? (
          <p className="app-alert app-alert-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="dialog-shell-actions student-directory-dialog-actions">
          {profile && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="product-btn-danger student-directory-delete-action"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Удалить ученика «${profile.displayName}»? Ученик исчезнет из списка, групп и будущей аудитории курсов. Учебная история и уже назначенные уроки сохранятся.`,
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
          <Button type="submit" disabled={busy || !displayName.trim()}>
            {busy ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : profile ? (
              <Save className="h-4 w-4" aria-hidden="true" />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            )}
            {profile ? "Сохранить" : "Создать ученика"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
