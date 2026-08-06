"use client";

import {
  GraduationCap,
  LoaderCircle,
  Plus,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createLearnerGroup,
  createLearnerProfile,
  deleteLearnerGroup,
  deleteLearnerProfile,
  loadLearnerGroups,
  loadLearnerProfiles,
  updateLearnerGroup,
  updateLearnerProfile,
} from "@/components/lesson-runs/lesson-run-client";
import { LearnerHistoryDialog } from "@/components/lesson-runs/learner-history-dialog";
import { LearnerGroupDialog } from "@/components/teaching-hub/learner-group-dialog";
import { LearnerProfileDialog } from "@/components/teaching-hub/learner-profile-dialog";
import {
  LearnerGroupsDirectoryTable,
  LearnersDirectoryTable,
  type LearnerDirectoryEntry,
} from "@/components/teaching-hub/student-directory-table";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SurfaceCard } from "@/components/ui/surface-card";
import type {
  LearnerGroup,
  LearnerProfile,
} from "@/modules/lesson-runs/domain";

type DirectoryView = "learners" | "groups";
type LearnerSort = "name-asc" | "name-desc" | "group-count";
type GroupSort = "name-asc" | "name-desc" | "member-count";

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

export function StudentsWorkspace() {
  const [profiles, setProfiles] = useState<LearnerProfile[] | null>(null);
  const [groups, setGroups] = useState<LearnerGroup[] | null>(null);
  const [view, setView] = useState<DirectoryView>("learners");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [learnerSort, setLearnerSort] = useState<LearnerSort>("name-asc");
  const [groupSort, setGroupSort] = useState<GroupSort>("name-asc");
  const [learnerEditor, setLearnerEditor] = useState<{
    profile: LearnerProfile | null;
  } | null>(null);
  const [groupEditor, setGroupEditor] = useState<{
    group: LearnerGroup | null;
  } | null>(null);
  const [historyProfile, setHistoryProfile] = useState<LearnerProfile | null>(
    null,
  );
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const reloadDirectory = useCallback(async () => {
    const [nextProfiles, nextGroups] = await Promise.all([
      loadLearnerProfiles(),
      loadLearnerGroups(),
    ]);
    setProfiles(nextProfiles.filter((profile) => !profile.archivedAt));
    setGroups(nextGroups);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([loadLearnerProfiles(), loadLearnerGroups()])
      .then(([nextProfiles, nextGroups]) => {
        if (!active) return;
        setProfiles(nextProfiles.filter((profile) => !profile.archivedAt));
        setGroups(nextGroups);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setLoadError(
          errorMessage(caught, "Не удалось загрузить учеников и группы."),
        );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      groups &&
      groupFilter !== "all" &&
      groupFilter !== "ungrouped" &&
      !groups.some((group) => group.id === groupFilter)
    ) {
      setGroupFilter("all");
    }
  }, [groupFilter, groups]);

  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const learnerEntries = useMemo<LearnerDirectoryEntry[]>(() => {
    const entries = (profiles ?? []).map((profile) => ({
      profile,
      groups: (groups ?? []).filter((group) =>
        group.members.some((member) => member.id === profile.id),
      ),
    }));
    const filtered = entries.filter((entry) => {
      const matchesQuery =
        !normalizedQuery ||
        entry.profile.displayName
          .toLocaleLowerCase("ru-RU")
          .includes(normalizedQuery) ||
        entry.groups.some((group) =>
          group.name.toLocaleLowerCase("ru-RU").includes(normalizedQuery),
        );
      const matchesGroup =
        groupFilter === "all" ||
        (groupFilter === "ungrouped"
          ? entry.groups.length === 0
          : entry.groups.some((group) => group.id === groupFilter));
      return matchesQuery && matchesGroup;
    });
    return filtered.sort((left, right) => {
      if (learnerSort === "group-count") {
        const countDifference = right.groups.length - left.groups.length;
        if (countDifference !== 0) return countDifference;
      }
      const direction = learnerSort === "name-desc" ? -1 : 1;
      return (
        direction *
        left.profile.displayName.localeCompare(right.profile.displayName, "ru")
      );
    });
  }, [groupFilter, groups, learnerSort, normalizedQuery, profiles]);

  const visibleGroups = useMemo(() => {
    const filtered = (groups ?? []).filter(
      (group) =>
        !normalizedQuery ||
        group.name.toLocaleLowerCase("ru-RU").includes(normalizedQuery) ||
        group.members.some((member) =>
          member.displayName
            .toLocaleLowerCase("ru-RU")
            .includes(normalizedQuery),
        ),
    );
    return filtered.sort((left, right) => {
      if (groupSort === "member-count") {
        const countDifference = right.members.length - left.members.length;
        if (countDifference !== 0) return countDifference;
      }
      const direction = groupSort === "name-desc" ? -1 : 1;
      return direction * left.name.localeCompare(right.name, "ru");
    });
  }, [groupSort, groups, normalizedQuery]);

  const ready = profiles !== null && groups !== null;
  const busy = Boolean(busyLabel);
  const hasFilters =
    Boolean(normalizedQuery) || (view === "learners" && groupFilter !== "all");

  async function mutate(
    label: string,
    successMessage: string,
    action: () => Promise<unknown>,
    onSuccess: () => void,
  ) {
    if (busy) return;
    setBusyLabel(label);
    setMutationError(null);
    setStatusMessage(null);
    try {
      await action();
      await reloadDirectory();
      onSuccess();
      setStatusMessage(successMessage);
    } catch (caught) {
      setMutationError(errorMessage(caught, "Не удалось сохранить изменение."));
    } finally {
      setBusyLabel(null);
    }
  }

  function confirmLearnerDelete(profile: LearnerProfile) {
    return window.confirm(
      `Удалить ученика «${profile.displayName}»? Ученик исчезнет из списка, групп и будущей аудитории курсов. Учебная история и уже назначенные уроки сохранятся.`,
    );
  }

  function confirmGroupDelete(group: LearnerGroup) {
    return window.confirm(
      `Удалить группу «${group.name}»? Она исчезнет из курсов, но ученики и их учебная история сохранятся. Уже назначенные уроки не изменятся.`,
    );
  }

  async function removeLearner(
    profile: LearnerProfile,
    alreadyConfirmed = false,
  ) {
    if (!alreadyConfirmed && !confirmLearnerDelete(profile)) return;
    await mutate(
      "Удаляем ученика…",
      "Ученик удалён. Учебная история сохранена.",
      () => deleteLearnerProfile(profile.id),
      () => setLearnerEditor(null),
    );
  }

  async function removeGroup(group: LearnerGroup, alreadyConfirmed = false) {
    if (!alreadyConfirmed && !confirmGroupDelete(group)) return;
    await mutate(
      "Удаляем группу…",
      "Группа удалена. Ученики и их история сохранены.",
      () => deleteLearnerGroup(group.id),
      () => setGroupEditor(null),
    );
  }

  return (
    <div className="teaching-hub-stack">
      <section
        className="student-directory-toolbar"
        aria-label="Управление учениками"
      >
        <SegmentedControl
          ariaLabel="Показывать в таблице"
          value={view}
          onChange={setView}
          disabled={!ready || busy}
          items={[
            {
              value: "learners",
              label: `Ученики · ${profiles?.length ?? 0}`,
              icon: GraduationCap,
            },
            {
              value: "groups",
              label: `По группам · ${groups?.length ?? 0}`,
              icon: Users,
            },
          ]}
        />

        <label className="teaching-hub-search student-directory-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Найти ученика или группу</span>
          <input
            value={query}
            disabled={!ready}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти ученика или группу"
          />
        </label>

        <div className="student-directory-controls">
          {view === "learners" ? (
            <select
              className="student-directory-select"
              aria-label="Фильтр по группе"
              value={groupFilter}
              disabled={!ready}
              onChange={(event) => setGroupFilter(event.target.value)}
            >
              <option value="all">Все группы</option>
              <option value="ungrouped">Без группы</option>
              {(groups ?? []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          ) : null}

          <select
            className="student-directory-select"
            aria-label="Сортировка"
            value={view === "learners" ? learnerSort : groupSort}
            disabled={!ready}
            onChange={(event) => {
              if (view === "learners") {
                setLearnerSort(event.target.value as LearnerSort);
              } else {
                setGroupSort(event.target.value as GroupSort);
              }
            }}
          >
            {view === "learners" ? (
              <>
                <option value="name-asc">Имя: А—Я</option>
                <option value="name-desc">Имя: Я—А</option>
                <option value="group-count">По количеству групп</option>
              </>
            ) : (
              <>
                <option value="name-asc">Название: А—Я</option>
                <option value="name-desc">Название: Я—А</option>
                <option value="member-count">Сначала самые большие</option>
              </>
            )}
          </select>

          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setQuery("");
                setGroupFilter("all");
              }}
            >
              Сбросить фильтры
            </Button>
          ) : null}
        </div>

        <div className="student-directory-create-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={!ready || busy}
            onClick={() => {
              setMutationError(null);
              setGroupEditor({ group: null });
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Новая группа
          </Button>
          <Button
            type="button"
            disabled={!ready || busy}
            onClick={() => {
              setMutationError(null);
              setLearnerEditor({ profile: null });
            }}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Новый ученик
          </Button>
        </div>
      </section>

      {loadError ? (
        <SurfaceCard className="border border-rose-200">
          <p className="text-sm font-medium text-rose-800" role="alert">
            {loadError}
          </p>
        </SurfaceCard>
      ) : null}

      {!loadError && !ready ? (
        <SurfaceCard className="flex items-center gap-3 border border-neutral-200">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium text-neutral-700" role="status">
            Загружаем учеников и группы…
          </p>
        </SurfaceCard>
      ) : null}

      {busyLabel ? (
        <p className="app-alert app-alert-info" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          {busyLabel}
        </p>
      ) : null}
      {!learnerEditor && !groupEditor && mutationError ? (
        <p className="app-alert app-alert-error" role="alert">
          {mutationError}
        </p>
      ) : null}
      {statusMessage ? (
        <p className="app-alert app-alert-success" role="status">
          {statusMessage}
        </p>
      ) : null}

      {ready && view === "learners" ? (
        <LearnersDirectoryTable
          entries={learnerEntries}
          hasFilters={hasFilters}
          disabled={busy}
          onHistory={setHistoryProfile}
          onEdit={(profile) => {
            setMutationError(null);
            setLearnerEditor({ profile });
          }}
          onDelete={(profile) => void removeLearner(profile)}
        />
      ) : null}

      {ready && view === "groups" ? (
        <LearnerGroupsDirectoryTable
          groups={visibleGroups}
          hasFilters={hasFilters}
          disabled={busy}
          onEdit={(group) => {
            setMutationError(null);
            setGroupEditor({ group });
          }}
          onDelete={(group) => void removeGroup(group)}
        />
      ) : null}

      {learnerEditor && profiles && groups ? (
        <LearnerProfileDialog
          key={learnerEditor.profile?.id ?? "new-learner"}
          profile={learnerEditor.profile}
          groups={groups}
          busy={busy}
          error={mutationError}
          onClose={() => {
            setMutationError(null);
            setLearnerEditor(null);
          }}
          onSave={async (displayName, learnerGroupIds) => {
            const profile = learnerEditor.profile;
            await mutate(
              profile ? "Сохраняем ученика…" : "Создаём ученика…",
              profile ? "Изменения ученика сохранены." : "Ученик создан.",
              () =>
                profile
                  ? updateLearnerProfile(profile.id, {
                      displayName,
                      learnerGroupIds,
                    })
                  : createLearnerProfile(displayName, learnerGroupIds),
              () => setLearnerEditor(null),
            );
          }}
          onDelete={
            learnerEditor.profile
              ? () => removeLearner(learnerEditor.profile!, true)
              : null
          }
        />
      ) : null}

      {groupEditor && profiles && groups ? (
        <LearnerGroupDialog
          key={groupEditor.group?.id ?? "new-group"}
          group={groupEditor.group}
          profiles={profiles}
          busy={busy}
          error={mutationError}
          onClose={() => {
            setMutationError(null);
            setGroupEditor(null);
          }}
          onSave={async (name, learnerProfileIds) => {
            const group = groupEditor.group;
            await mutate(
              group ? "Сохраняем группу…" : "Создаём группу…",
              group ? "Изменения группы сохранены." : "Группа создана.",
              () =>
                group
                  ? updateLearnerGroup(group.id, { name, learnerProfileIds })
                  : createLearnerGroup({ name, learnerProfileIds }),
              () => setGroupEditor(null),
            );
          }}
          onDelete={
            groupEditor.group
              ? () => removeGroup(groupEditor.group!, true)
              : null
          }
        />
      ) : null}

      {historyProfile ? (
        <LearnerHistoryDialog
          profile={historyProfile}
          onClose={() => setHistoryProfile(null)}
        />
      ) : null}
    </div>
  );
}
