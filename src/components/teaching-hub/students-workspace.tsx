"use client";

import {
  ChevronDown,
  GraduationCap,
  Eye,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { useSystemAssistantPageContext } from "@/components/assistant/system-assistant-provider";
import { ObservingWorkspace } from "@/components/learner-identity/observing-workspace";
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
import { LearnerGroupDialog } from "@/components/teaching-hub/learner-group-dialog";
import { LearnerProfileDialog } from "@/components/teaching-hub/learner-profile-dialog";
import { AddLearnerDialog } from "@/components/learner-identity/add-learner-dialog";
import {
  actOnConnection,
  IdentityClientError,
  loadConnections,
  loadTeacherDirectory,
  permanentlyDeleteOfflineLearner,
  restoreTeacherLearner,
} from "@/components/learner-identity/identity-client";
import {
  LearnerGroupsDirectoryTable,
  LearnersDirectoryTable,
  type LearnerDirectoryEntry,
} from "@/components/teaching-hub/student-directory-table";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  WorkspaceTabs,
  workspaceTabId,
  workspaceTabPanelId,
} from "@/components/ui/workspace-tabs";
import type {
  LearnerGroup,
  LearnerProfile,
} from "@/modules/lesson-runs/domain";
import type {
  LearnerConnectionRequest,
  TeacherLearnerDirectoryItem,
} from "@/modules/learner-identity/domain";
import { ROUTES } from "@/lib/auth";

type DirectoryView = "learners" | "groups" | "observing";
type LearnerSort = "name-asc" | "name-desc" | "group-count";
type GroupSort = "name-asc" | "name-desc" | "member-count";

const STUDENTS_DIRECTORY_TABS_ID = "students-directory";

type StudentsWorkspaceProps = {
  initialView?: DirectoryView;
};

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

function toLessonRunsProfile(
  item: TeacherLearnerDirectoryItem,
): LearnerProfile {
  return {
    id: item.learnerProfileId,
    teacherAccountId: item.teacherAccountId,
    displayName: item.displayName,
    archivedAt: item.archivedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function fallbackIdentity(
  profile: LearnerProfile,
): TeacherLearnerDirectoryItem {
  return {
    learnerProfileId: profile.id,
    teacherAccountId: profile.teacherAccountId,
    displayName: profile.displayName,
    archivedAt: profile.archivedAt,
    identityState: "offline",
    pendingRequestCount: 0,
    canInvite: true,
    canPermanentlyDelete: false,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function StudentsWorkspace({
  initialView = "learners",
}: StudentsWorkspaceProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<LearnerProfile[] | null>(null);
  const [activeDirectory, setActiveDirectory] = useState<
    TeacherLearnerDirectoryItem[] | null
  >(null);
  const [archivedDirectory, setArchivedDirectory] = useState<
    TeacherLearnerDirectoryItem[] | null
  >(null);
  const [connections, setConnections] = useState<
    LearnerConnectionRequest[] | null
  >(null);
  const [groups, setGroups] = useState<LearnerGroup[] | null>(null);
  const [view, setView] = useState<DirectoryView>(initialView);
  const [learnerQuery, setLearnerQuery] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [learnerSort, setLearnerSort] = useState<LearnerSort>("name-asc");
  const [groupSort, setGroupSort] = useState<GroupSort>("name-asc");
  const [learnerEditor, setLearnerEditor] = useState<{
    profile: LearnerProfile | null;
  } | null>(null);
  const [addLearnerOpen, setAddLearnerOpen] = useState(false);
  const [initialShareCode, setInitialShareCode] = useState("");
  const [groupEditor, setGroupEditor] = useState<{
    group: LearnerGroup | null;
  } | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useSystemAssistantPageContext({
    surface: "students",
    view: `students_${view}`,
    courseId: null,
    lessonId: null,
    label:
      view === "groups"
        ? "Ученики · Группы"
        : view === "observing"
          ? "Ученики · Наблюдение"
          : "Ученики",
  });

  const reloadDirectory = useCallback(async () => {
    const [legacyProfiles, nextGroups] = await Promise.all([
      loadLearnerProfiles(),
      loadLearnerGroups(),
    ]);
    const nextActive = await loadTeacherDirectory("active").catch((caught) => {
      if (caught instanceof IdentityClientError && caught.status === 404) {
        return legacyProfiles
          .filter((profile) => !profile.archivedAt)
          .map(fallbackIdentity);
      }
      throw caught;
    });
    const [nextArchived, nextConnections] = await Promise.all([
      loadTeacherDirectory("archived").catch((caught) => {
        if (caught instanceof IdentityClientError && caught.status === 404)
          return [];
        throw caught;
      }),
      loadConnections().catch((caught) => {
        if (caught instanceof IdentityClientError && caught.status === 404)
          return [];
        throw caught;
      }),
    ]);
    setActiveDirectory(nextActive);
    setArchivedDirectory(nextArchived);
    setConnections(nextConnections);
    setProfiles(nextActive.map(toLessonRunsProfile));
    setGroups(nextGroups);
  }, []);

  useEffect(() => {
    let active = true;
    void reloadDirectory()
      .then(() => {
        if (!active) return;
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
  }, [reloadDirectory]);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const scannedCode = fragment.get("connect-code")?.trim() ?? "";
    if (!scannedCode) return;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    setView("learners");
    setInitialShareCode(scannedCode);
    setAddLearnerOpen(true);
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

  const activeQuery = view === "learners" ? learnerQuery : groupQuery;
  const normalizedQuery = activeQuery.trim().toLocaleLowerCase("ru-RU");

  const pendingConnections = useMemo(() => {
    return (connections ?? []).filter(
      (request) =>
        request.status === "pending" && request.direction === "outgoing",
    );
  }, [connections]);

  const learnerEntries = useMemo<LearnerDirectoryEntry[]>(() => {
    const entries: LearnerDirectoryEntry[] = [
      ...(activeDirectory ?? []).map((identity) => ({
        kind: "profile" as const,
        status: "active" as const,
        profile: toLessonRunsProfile(identity),
        identity,
        groups: (groups ?? []).filter((group) =>
          group.members.some(
            (member) => member.id === identity.learnerProfileId,
          ),
        ),
      })),
      ...(archivedDirectory ?? []).map((identity) => ({
        kind: "profile" as const,
        status: "archived" as const,
        profile: toLessonRunsProfile(identity),
        identity,
        groups: [],
      })),
      ...pendingConnections.map((request) => ({
        kind: "request" as const,
        status: "pending" as const,
        request,
        groups: [],
      })),
    ];
    const filtered = entries.filter((entry) => {
      const displayName =
        entry.kind === "profile"
          ? entry.profile.displayName
          : (entry.request.localDisplayName ?? "Новый ученик");
      const matchesQuery =
        !normalizedQuery ||
        displayName.toLocaleLowerCase("ru-RU").includes(normalizedQuery) ||
        (entry.kind === "request" &&
          entry.request.counterpartyLabel
            .toLocaleLowerCase("ru-RU")
            .includes(normalizedQuery)) ||
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
      const leftName =
        left.kind === "profile"
          ? left.profile.displayName
          : (left.request.localDisplayName ?? "Новый ученик");
      const rightName =
        right.kind === "profile"
          ? right.profile.displayName
          : (right.request.localDisplayName ?? "Новый ученик");
      return direction * leftName.localeCompare(rightName, "ru");
    });
  }, [
    activeDirectory,
    archivedDirectory,
    groupFilter,
    groups,
    learnerSort,
    normalizedQuery,
    pendingConnections,
  ]);

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

  const ready =
    profiles !== null &&
    groups !== null &&
    activeDirectory !== null &&
    archivedDirectory !== null &&
    connections !== null;
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
      `Переместить ученика «${profile.displayName}» в архив? Он исчезнет из ваших групп и будущей аудитории ваших курсов. Учебная история сохранится, а восстановить связь можно будет прямо из общего списка учеников.`,
    );
  }

  async function retryLoad() {
    setLoadError(null);
    try {
      await reloadDirectory();
    } catch (caught) {
      setLoadError(
        errorMessage(caught, "Не удалось загрузить учеников и группы."),
      );
    }
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
      "Ученик перемещён в архив. Учебный профиль и история сохранены.",
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

  async function restoreLearner(learner: TeacherLearnerDirectoryItem) {
    await mutate(
      "Восстанавливаем ученика…",
      "Ученик снова в активном списке. Добавьте его в нужные группы и курсы заново.",
      () => restoreTeacherLearner(learner.learnerProfileId),
      () => undefined,
    );
  }

  async function permanentlyDeleteLearner(
    learner: TeacherLearnerDirectoryItem,
  ) {
    const confirmation = window.prompt(
      `Пустой профиль «${learner.displayName}» будет удалён без возможности восстановления. Учебные профили с результатами, приглашениями, аккаунтом или другими связями удалить здесь нельзя. Для подтверждения введите имя ученика.`,
    );
    if (confirmation !== learner.displayName) return;
    await mutate(
      "Удаляем пустой профиль…",
      "Пустой профиль без аккаунта удалён.",
      () => permanentlyDeleteOfflineLearner(learner.learnerProfileId),
      () => undefined,
    );
  }

  async function cancelConnection(request: LearnerConnectionRequest) {
    if (
      !window.confirm(
        `Отменить запрос для «${request.localDisplayName ?? request.counterpartyLabel}»?`,
      )
    )
      return;
    await mutate(
      "Отменяем запрос…",
      "Запрос отменён.",
      () => actOnConnection(request.id, "cancel"),
      () => undefined,
    );
  }

  function changeView(nextView: DirectoryView) {
    setView(nextView);
    const href =
      nextView === "learners"
        ? ROUTES.students
        : `${ROUTES.students}?tab=${nextView}`;
    router.replace(href, { scroll: false });
  }

  return (
    <div className="teaching-hub-stack">
      <AppPageHeader
        title="Ученики"
        description="Ученики и группы, с которыми вы работаете, а также учебные профили, за которыми вы наблюдаете."
        actions={
          view === "learners" ? (
            <Button
              type="button"
              disabled={!ready || busy}
              onClick={() => {
                setMutationError(null);
                setInitialShareCode("");
                setAddLearnerOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Новый ученик
            </Button>
          ) : view === "groups" ? (
            <Button
              type="button"
              disabled={!ready || busy}
              onClick={() => {
                setMutationError(null);
                setGroupEditor({ group: null });
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Новая группа
            </Button>
          ) : null
        }
      />

      <WorkspaceTabs
        idBase={STUDENTS_DIRECTORY_TABS_ID}
        ariaLabel="Разделы учеников"
        value={view}
        onChange={changeView}
        items={[
          {
            value: "learners",
            label: "Ученики",
            count:
              (activeDirectory?.length ?? 0) +
              (archivedDirectory?.length ?? 0) +
              pendingConnections.length,
            icon: GraduationCap,
          },
          {
            value: "groups",
            label: "Группы",
            count: groups?.length ?? 0,
            icon: Users,
          },
          {
            value: "observing",
            label: "Наблюдение",
            icon: Eye,
          },
        ]}
      />

      <section
        className="student-directory-toolbar compact-page-toolbar"
        aria-label={
          view === "learners" ? "Управление учениками" : "Управление группами"
        }
        hidden={view === "observing"}
      >
        <label className="teaching-hub-search student-directory-search compact-toolbar-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">
            {view === "learners" ? "Найти ученика" : "Найти группу"}
          </span>
          <input
            value={activeQuery}
            disabled={!ready}
            onChange={(event) =>
              view === "learners"
                ? setLearnerQuery(event.target.value)
                : setGroupQuery(event.target.value)
            }
            placeholder={view === "learners" ? "Найти ученика" : "Найти группу"}
          />
        </label>

        <div className="student-directory-controls compact-toolbar-rail">
          {view === "learners" ? (
            <span className="product-select-wrap block min-w-0">
              <select
                className="student-directory-select appearance-none"
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
              <ChevronDown
                className="product-select-icon h-4 w-4"
                aria-hidden="true"
              />
            </span>
          ) : null}

          <span className="product-select-wrap block min-w-0">
            <select
              className="student-directory-select appearance-none"
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
            <ChevronDown
              className="product-select-icon h-4 w-4"
              aria-hidden="true"
            />
          </span>

          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="compact-toolbar-reset"
              disabled={busy}
              aria-label="Сбросить фильтры"
              title="Сбросить фильтры"
              onClick={() => {
                if (view === "learners") {
                  setLearnerQuery("");
                  setGroupFilter("all");
                } else {
                  setGroupQuery("");
                }
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </section>

      {view !== "observing" && loadError ? (
        <SurfaceCard className="flex items-center justify-between gap-4 border border-rose-200">
          <p className="text-sm font-medium text-rose-800" role="alert">
            {loadError}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void retryLoad()}
          >
            Повторить
          </Button>
        </SurfaceCard>
      ) : null}

      {view !== "observing" && !loadError && !ready ? (
        <SurfaceCard className="flex items-center gap-3 border border-neutral-200">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium text-neutral-700" role="status">
            Загружаем учеников и группы…
          </p>
        </SurfaceCard>
      ) : null}

      {view !== "observing" && busyLabel ? (
        <p className="app-alert app-alert-info" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          {busyLabel}
        </p>
      ) : null}
      {view !== "observing" &&
      !learnerEditor &&
      !groupEditor &&
      !addLearnerOpen &&
      mutationError ? (
        <p className="app-alert app-alert-error" role="alert">
          {mutationError}
        </p>
      ) : null}
      {view !== "observing" && statusMessage ? (
        <p className="app-alert app-alert-success" role="status">
          {statusMessage}
        </p>
      ) : null}

      <div
        id={workspaceTabPanelId(STUDENTS_DIRECTORY_TABS_ID, "learners")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(STUDENTS_DIRECTORY_TABS_ID, "learners")}
        hidden={view !== "learners"}
        tabIndex={0}
      >
        {ready && view === "learners" ? (
          <LearnersDirectoryTable
            entries={learnerEntries}
            hasFilters={hasFilters}
            disabled={busy}
            onOpen={(profile) => {
              setMutationError(null);
              setLearnerEditor({ profile });
            }}
            onRestore={(learner) => void restoreLearner(learner)}
            onPermanentlyDelete={(learner) =>
              void permanentlyDeleteLearner(learner)
            }
            onCancelRequest={(request) => void cancelConnection(request)}
          />
        ) : null}
      </div>

      <div
        id={workspaceTabPanelId(STUDENTS_DIRECTORY_TABS_ID, "groups")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(STUDENTS_DIRECTORY_TABS_ID, "groups")}
        hidden={view !== "groups"}
        tabIndex={0}
      >
        {ready && view === "groups" ? (
          <LearnerGroupsDirectoryTable
            groups={visibleGroups}
            hasFilters={hasFilters}
            disabled={busy}
            onOpen={(group) => {
              setMutationError(null);
              setGroupEditor({ group });
            }}
          />
        ) : null}
      </div>

      <div
        id={workspaceTabPanelId(STUDENTS_DIRECTORY_TABS_ID, "observing")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(
          STUDENTS_DIRECTORY_TABS_ID,
          "observing",
        )}
        hidden={view !== "observing"}
        tabIndex={0}
      >
        {view === "observing" ? <ObservingWorkspace embedded /> : null}
      </div>

      {learnerEditor && profiles && groups ? (
        <LearnerProfileDialog
          key={learnerEditor.profile?.id ?? "new-learner"}
          profile={learnerEditor.profile}
          identity={
            learnerEditor.profile
              ? (activeDirectory?.find(
                  (item) => item.learnerProfileId === learnerEditor.profile?.id,
                ) ?? fallbackIdentity(learnerEditor.profile))
              : null
          }
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

      {addLearnerOpen && groups ? (
        <AddLearnerDialog
          key={initialShareCode || "add-learner"}
          groups={groups}
          initialShareCode={initialShareCode}
          onClose={() => {
            setAddLearnerOpen(false);
            setInitialShareCode("");
          }}
          onCreateOffline={async (displayName, learnerGroupIds) => {
            setMutationError(null);
            await createLearnerProfile(displayName, learnerGroupIds);
            await reloadDirectory();
            setAddLearnerOpen(false);
            setInitialShareCode("");
            setStatusMessage("Профиль без аккаунта создан.");
          }}
          onPendingCreated={async () => {
            await reloadDirectory();
          }}
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
    </div>
  );
}
