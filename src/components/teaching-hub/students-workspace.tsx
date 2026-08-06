"use client";

import Link from "next/link";
import {
  BookOpen,
  FolderOpen,
  GraduationCap,
  LoaderCircle,
  Plus,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import {
  createLearnerProfile,
  loadLearnerProfiles,
} from "@/components/lesson-runs/lesson-run-client";
import { LearnerHistoryDialog } from "@/components/lesson-runs/learner-history-dialog";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DialogShell } from "@/components/ui/dialog-shell";
import { SurfaceCard } from "@/components/ui/surface-card";
import { toCourseRoute } from "@/lib/auth";
import type { CourseSummary } from "@/modules/course-builder/domain";
import type { LearnerProfile } from "@/modules/lesson-runs/domain";

function lessonCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} урок`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} урока`;
  }
  return `${count} уроков`;
}

function initials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("ru-RU"))
    .join("");
}

function NewLearnerDialog({
  busy,
  error,
  onClose,
  onCreate,
}: {
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (displayName: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  return (
    <DialogShell
      title="Новый ученик"
      description="Создайте нейтральный учебный профиль. Его можно назначить одному или нескольким курсам."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const name = displayName.trim();
          if (name) void onCreate(name);
        }}
      >
        <label>
          <span className="field-label">Имя ученика</span>
          <input
            autoFocus
            required
            minLength={2}
            maxLength={160}
            className="field-input"
            placeholder="Например, Анна Петрова"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        {error ? (
          <p className="app-alert app-alert-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog-shell-actions">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button type="submit" disabled={busy || !displayName.trim()}>
            {busy ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            Создать профиль
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

export function StudentsWorkspace() {
  const [profiles, setProfiles] = useState<LearnerProfile[] | null>(null);
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [historyProfile, setHistoryProfile] = useState<LearnerProfile | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const createTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadLearnerProfiles(),
      courseBuilderRequest<{ courses: CourseSummary[] }>("/api/v2/courses", {
        cache: "no-store",
      }),
    ])
      .then(([learnerProfiles, coursePayload]) => {
        if (!active) return;
        setProfiles(learnerProfiles);
        setCourses(coursePayload.courses);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить учебные профили.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const visibleProfiles = useMemo(
    () =>
      (profiles ?? []).filter((profile) =>
        profile.displayName
          .toLocaleLowerCase("ru-RU")
          .includes(normalizedQuery),
      ),
    [normalizedQuery, profiles],
  );
  const visibleCourses = useMemo(
    () =>
      (courses ?? []).filter((course) =>
        [course.title, course.subject, course.audienceDescription].some(
          (value) =>
            String(value ?? "")
              .toLocaleLowerCase("ru-RU")
              .includes(normalizedQuery),
        ),
      ),
    [courses, normalizedQuery],
  );
  const lessonCount = (courses ?? []).reduce(
    (total, course) => total + course.lessonCount,
    0,
  );

  async function create(displayName: string) {
    if (busy) return;
    setBusy(true);
    setCreateError(null);
    try {
      const created = await createLearnerProfile(displayName);
      setProfiles((current) =>
        [...(current ?? []), created].sort((left, right) =>
          left.displayName.localeCompare(right.displayName, "ru"),
        ),
      );
      setCreateOpen(false);
      window.requestAnimationFrame(() => createTriggerRef.current?.focus());
    } catch (caught) {
      setCreateError(
        caught instanceof Error
          ? caught.message
          : "Не удалось создать учебный профиль.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="teaching-hub-stack">
      <section className="teaching-stat-grid" aria-label="Состояние аудитории">
        <SurfaceCard as="div" className="teaching-stat-card">
          <span className="teaching-stat-icon teaching-empty-icon-sky">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </span>
          <strong>{profiles?.length ?? "—"}</strong>
          <span>учебных профилей</span>
        </SurfaceCard>
        <SurfaceCard as="div" className="teaching-stat-card">
          <span className="teaching-stat-icon teaching-empty-icon-lime">
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
          <strong>{courses?.length ?? "—"}</strong>
          <span>курсов</span>
        </SurfaceCard>
        <SurfaceCard as="div" className="teaching-stat-card">
          <span className="teaching-stat-icon teaching-empty-icon-violet">
            <FolderOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <strong>{courses ? lessonCount : "—"}</strong>
          <span>уроков в курсах</span>
        </SurfaceCard>
      </section>

      <section
        className="teaching-hub-toolbar"
        aria-label="Управление учениками"
      >
        <label className="teaching-hub-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Найти ученика или курс</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти ученика или курс"
          />
        </label>
        <Button
          ref={createTriggerRef}
          type="button"
          disabled={!profiles || busy}
          onClick={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Новый ученик
        </Button>
      </section>

      {error ? (
        <SurfaceCard className="border border-rose-200">
          <p className="text-sm font-medium text-rose-800" role="alert">
            {error}
          </p>
        </SurfaceCard>
      ) : null}

      {!error && (!profiles || !courses) ? (
        <SurfaceCard className="flex items-center gap-3 border border-neutral-200">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium text-neutral-700" role="status">
            Загружаем учеников и курсы…
          </p>
        </SurfaceCard>
      ) : null}

      {profiles && profiles.length === 0 ? (
        <SurfaceCard className="teaching-students-empty" as="section">
          <div className="teaching-empty-icon teaching-empty-icon-lime">
            <Users className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="teaching-empty-eyebrow">Учебные профили</p>
            <h2>Добавьте первого ученика</h2>
            <p>
              Профиль хранит индивидуальные результаты завершённых уроков и не
              зависит от старых сущностей Student или Class.
            </p>
          </div>
        </SurfaceCard>
      ) : null}

      {profiles && profiles.length > 0 ? (
        <section
          className="teaching-hub-section"
          aria-labelledby="learners-title"
        >
          <div className="teaching-section-heading">
            <div>
              <p className="teaching-section-eyebrow">Учебные профили</p>
              <h2 id="learners-title">Ученики</h2>
            </div>
            <Chip icon={GraduationCap} tone="sky">
              {visibleProfiles.length}
            </Chip>
          </div>
          {visibleProfiles.length ? (
            <div className="teaching-learner-grid">
              {visibleProfiles.map((profile) => (
                <SurfaceCard
                  key={profile.id}
                  as="article"
                  className="teaching-learner-card"
                >
                  <span className="teaching-learner-avatar" aria-hidden="true">
                    {initials(profile.displayName)}
                  </span>
                  <div>
                    <h3>{profile.displayName}</h3>
                    <p>Индивидуальная учебная история</p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-3"
                      onClick={() => setHistoryProfile(profile)}
                    >
                      Открыть историю
                    </Button>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          ) : (
            <SurfaceCard className="teaching-filter-empty">
              <Search className="h-6 w-6" aria-hidden="true" />
              <h3>Ученики не найдены</h3>
              <p>Измените запрос.</p>
            </SurfaceCard>
          )}
        </section>
      ) : null}

      {courses ? (
        <section
          className="teaching-hub-section"
          aria-labelledby="audience-title"
        >
          <div className="teaching-section-heading">
            <div>
              <p className="teaching-section-eyebrow">Аудитория</p>
              <h2 id="audience-title">Аудитории курсов</h2>
            </div>
          </div>

          {visibleCourses.length > 0 ? (
            <div className="teaching-course-grid">
              {visibleCourses.map((course) => (
                <SurfaceCard
                  key={course.id}
                  as="article"
                  className="teaching-course-card"
                  title={course.title}
                  description={[course.subject, course.level]
                    .filter(Boolean)
                    .join(" · ")}
                  actions={<Chip tone="neutral">Настроить</Chip>}
                >
                  <p className="teaching-course-audience">
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    <span>{lessonCountLabel(course.lessonCount)}</span>
                  </p>
                  <p className="teaching-course-goal">
                    {course.audienceDescription ||
                      "Откройте курс и выберите его аудиторию."}
                  </p>
                  <Link
                    href={`${toCourseRoute(course.id)}?audience=1`}
                    className={productButtonClassName("secondary", "mt-5")}
                  >
                    Настроить аудиторию
                  </Link>
                </SurfaceCard>
              ))}
            </div>
          ) : (
            <SurfaceCard className="teaching-filter-empty">
              <Search className="h-6 w-6" aria-hidden="true" />
              <h3>{courses.length ? "Курсы не найдены" : "Пока нет курсов"}</h3>
              <p>
                {courses.length
                  ? "Измените запрос."
                  : "После создания курса здесь можно будет назначить ему учеников."}
              </p>
            </SurfaceCard>
          )}
        </section>
      ) : null}

      {createOpen ? (
        <NewLearnerDialog
          busy={busy}
          error={createError}
          onClose={() => {
            setCreateError(null);
            setCreateOpen(false);
          }}
          onCreate={create}
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
