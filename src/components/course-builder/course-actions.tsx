"use client";

import {
  BookCopy,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DialogShell } from "@/components/ui/dialog-shell";
import { toCourseRoute } from "@/lib/auth";
import type { CourseSummary } from "@/modules/course-builder/domain";
import type { OwnedCoursePublication } from "@/modules/course-publications/domain";

type CourseActionTarget = Pick<
  CourseSummary,
  "id" | "title" | "lessonCount" | "learningAudience" | "publication"
>;

type CourseActionDialogMode = "publish" | "update" | "unpublish" | "delete";

type CourseActionsProps = {
  course: CourseActionTarget;
  onChanged?: () => void | Promise<unknown>;
  variant?: "default" | "table";
};

type PublicationDialogCopy = {
  title: string;
  body: string;
  confirmLabel: string;
  busyLabel: string;
};

const PUBLICATION_DIALOG_COPY: Record<
  CourseActionDialogMode,
  PublicationDialogCopy
> = {
  publish: {
    title: "Опубликовать курс в каталоге?",
    body: "В каталоге появится публичная копия курса с уроками и прикреплёнными материалами. Группы, ученики, расписание, история занятий и личные пожелания не публикуются.",
    confirmLabel: "Опубликовать",
    busyLabel: "Публикуем…",
  },
  update: {
    title: "Обновить публикацию?",
    body: "Публичная копия будет обновлена: в неё войдут уроки и прикреплённые материалы. Группы, ученики, расписание, история занятий и личные пожелания не публикуются. Уже добавленные другими пользователями копии не изменятся.",
    confirmLabel: "Обновить",
    busyLabel: "Обновляем…",
  },
  unpublish: {
    title: "Снять курс с публикации?",
    body: "Курс исчезнет из каталога. Ваш рабочий курс и копии, которые другие пользователи уже добавили себе, останутся без изменений.",
    confirmLabel: "Снять с публикации",
    busyLabel: "Снимаем…",
  },
  delete: {
    title: "Удалить курс из списка?",
    body: "Курс исчезнет из ваших активных курсов. Его уроки, материалы, расписание и история занятий не удаляются безвозвратно.",
    confirmLabel: "Удалить",
    busyLabel: "Удаляем…",
  },
};

function isPublished(publication: OwnedCoursePublication | null | undefined) {
  return publication?.status === "published";
}

function isCatalogVisible(
  publication: OwnedCoursePublication | null | undefined,
  educatorCourse: boolean,
) {
  return (
    isPublished(publication) &&
    (!educatorCourse || Boolean(publication?.approvedRevisionId))
  );
}

export function CoursePublicationBadges({
  publication,
  learningAudience = "children",
}: {
  publication: OwnedCoursePublication | null | undefined;
  learningAudience?: CourseSummary["learningAudience"];
}) {
  const educatorCourse = learningAudience === "educators";
  if (educatorCourse) {
    if (!publication) return null;
    return (
      <>
        {isCatalogVisible(publication, true) ? (
          <Chip tone="emerald">В каталоге</Chip>
        ) : null}
        {publication.reviewStatus === "pending" ? (
          <Chip tone="amber">На проверке</Chip>
        ) : null}
        {publication.reviewStatus === "approved" ? (
          <Chip tone="emerald">Проверка пройдена</Chip>
        ) : null}
        {publication.reviewStatus === "rejected" ? (
          <Chip tone="rose">Нужны исправления</Chip>
        ) : null}
        {publication.hasUnpublishedChanges ? (
          <Chip tone="amber">Есть изменения</Chip>
        ) : null}
      </>
    );
  }

  if (!publication || !isPublished(publication)) return null;

  return (
    <>
      <Chip tone="emerald">В каталоге</Chip>
      {publication?.hasUnpublishedChanges ? (
        <Chip tone="amber">Есть изменения</Chip>
      ) : null}
    </>
  );
}

export function CourseActions({
  course,
  onChanged,
  variant = "default",
}: CourseActionsProps) {
  const router = useRouter();
  const [dialogMode, setDialogMode] = useState<CourseActionDialogMode | null>(
    null,
  );
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const published = isPublished(course.publication);
  const educatorCourse = course.learningAudience === "educators";
  const catalogVisible = isCatalogVisible(course.publication, educatorCourse);
  const reviewStatus = educatorCourse
    ? (course.publication?.reviewStatus ?? null)
    : null;
  const pendingReview = reviewStatus === "pending";
  const rejectedReview = reviewStatus === "rejected";
  const rejectedInitialPublication =
    educatorCourse &&
    rejectedReview &&
    published &&
    !course.publication?.approvedRevisionId;
  const publicationLocked = published || pendingReview;

  function openDialog(mode: CourseActionDialogMode) {
    setActionError(null);
    setRightsConfirmed(false);
    setDialogMode(mode);
  }

  const closeDialog = useCallback(() => {
    if (busyAction) return;
    setDialogMode(null);
    setRightsConfirmed(false);
    setActionError(null);
  }, [busyAction]);

  useEffect(() => {
    if (!dialogMode) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || busyAction) return;
      event.preventDefault();
      closeDialog();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [busyAction, closeDialog, dialogMode]);

  async function duplicateCourse() {
    if (busyAction) return;
    setBusyAction("duplicate");
    setActionError(null);
    try {
      const payload = await courseBuilderRequest<{ courseId: string }>(
        `/api/v2/courses/${encodeURIComponent(course.id)}/duplicate`,
        { method: "POST" },
      );
      router.push(toCourseRoute(payload.courseId));
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Не удалось дублировать курс.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmDialogAction() {
    if (!dialogMode || busyAction) return;
    if (
      (dialogMode === "publish" || dialogMode === "update") &&
      !rightsConfirmed
    ) {
      return;
    }

    setBusyAction(dialogMode);
    setActionError(null);
    try {
      if (dialogMode === "delete") {
        await courseBuilderRequest(
          `/api/v2/courses/${encodeURIComponent(course.id)}`,
          { method: "DELETE" },
        );
        setDialogMode(null);
        await onChanged?.();
        return;
      }
      const method =
        dialogMode === "publish"
          ? "POST"
          : dialogMode === "update"
            ? "PUT"
            : "DELETE";
      await courseBuilderRequest(
        `/api/v2/courses/${encodeURIComponent(course.id)}/publication`,
        {
          method,
          body:
            dialogMode === "unpublish"
              ? undefined
              : JSON.stringify({ rightsConfirmed: true }),
        },
      );
      setDialogMode(null);
      setRightsConfirmed(false);
      await onChanged?.();
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : dialogMode === "delete"
            ? "Не удалось удалить курс из списка."
            : "Не удалось изменить публикацию.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  const items: ActionMenuItem[] = educatorCourse
    ? []
    : [
        {
          id: "duplicate",
          label: busyAction === "duplicate" ? "Дублируем…" : "Дублировать",
          icon: BookCopy,
          disabled: Boolean(busyAction),
          onSelect: () => void duplicateCourse(),
        },
      ];

  if (educatorCourse && pendingReview) {
    if (catalogVisible) {
      items.push({
        id: "open-publication",
        label: "Открыть одобренную редакцию",
        icon: ExternalLink,
        href: `/courses/catalog/${encodeURIComponent(course.publication!.id)}?audience=educators`,
      });
    }
    items.push({
      id: "unpublish",
      label: "Отозвать с проверки",
      icon: Undo2,
      destructive: true,
      disabled: Boolean(busyAction),
      onSelect: () => openDialog("unpublish"),
    });
  } else if (!published && !rejectedReview) {
    items.push({
      id: "publish",
      label: educatorCourse ? "Отправить на проверку" : "Опубликовать",
      icon: Send,
      disabled: Boolean(busyAction) || course.lessonCount === 0,
      hint:
        course.lessonCount === 0
          ? "Сначала добавьте хотя бы один урок"
          : undefined,
      onSelect: () => openDialog("publish"),
    });
  } else {
    if (course.publication?.hasUnpublishedChanges || rejectedReview) {
      items.push({
        id: "update-publication",
        label: educatorCourse
          ? "Отправить новую редакцию"
          : "Обновить публикацию",
        icon: RefreshCw,
        disabled: Boolean(busyAction),
        onSelect: () => openDialog("update"),
      });
    }
    if (catalogVisible) {
      items.push({
        id: "open-publication",
        label: "Открыть в каталоге",
        icon: ExternalLink,
        href: `/courses/catalog/${encodeURIComponent(course.publication!.id)}?audience=${course.learningAudience}`,
      });
    }
    if (!educatorCourse || published) {
      items.push({
        id: "unpublish",
        label: rejectedInitialPublication
          ? "Снять отклонённую публикацию"
          : "Снять с публикации",
        icon: Undo2,
        destructive: true,
        disabled: Boolean(busyAction),
        onSelect: () => openDialog("unpublish"),
      });
    }
  }

  if (variant === "table") {
    items.push({
      id: "delete",
      label: "Удалить",
      icon: Trash2,
      destructive: true,
      disabled: Boolean(busyAction) || publicationLocked,
      hint: pendingReview
        ? "Сначала отзовите курс с проверки"
        : rejectedInitialPublication
          ? "Сначала снимите отклонённую публикацию"
          : publicationLocked
            ? "Сначала снимите курс с публикации"
            : undefined,
      onSelect: () => openDialog("delete"),
    });
  }

  const dialogCopy = dialogMode
    ? educatorCourse && dialogMode === "publish"
      ? {
          title: "Отправить курс на проверку?",
          body: "Неизменяемая редакция курса и аттестации уйдёт администратору ShiDao. До одобрения курс не появится в каталоге; слушатели смогут учиться сами, без копирования курса и проведения занятий по нему.",
          confirmLabel: "Отправить на проверку",
          busyLabel: "Отправляем…",
        }
      : educatorCourse && dialogMode === "update"
        ? {
            title: "Отправить новую редакцию?",
            body: "Новая неизменяемая редакция уроков, материалов и аттестации пройдёт повторную проверку. Если прежняя редакция уже одобрена, она останется доступна в каталоге до одобрения новой.",
            confirmLabel: "Отправить новую редакцию",
            busyLabel: "Отправляем…",
          }
        : educatorCourse && dialogMode === "unpublish"
          ? {
              title: pendingReview
                ? "Отозвать курс с проверки?"
                : rejectedInitialPublication
                  ? "Снять отклонённую публикацию?"
                  : "Снять фирменный курс с публикации?",
              body: pendingReview
                ? catalogVisible
                  ? "Текущая редакция больше не будет ожидать проверки. Ранее одобренная редакция останется в каталоге, а авторский курс — в вашем рабочем пространстве."
                  : "Текущая редакция больше не будет ожидать проверки. Авторский курс останется в вашем рабочем пространстве."
                : rejectedInitialPublication
                  ? "Отклонённая редакция перестанет считаться опубликованной. После этого рабочий курс можно удалить или отправить на проверку новой редакцией."
                  : "Курс перестанет быть доступен слушателям в каталоге. Авторский курс и результаты уже завершённых аттестаций сохранятся.",
              confirmLabel: pendingReview ? "Отозвать" : "Снять публикацию",
              busyLabel: pendingReview ? "Отзываем…" : "Снимаем…",
            }
          : PUBLICATION_DIALOG_COPY[dialogMode]
    : null;
  const requiresRights = dialogMode === "publish" || dialogMode === "update";
  const dialog =
    dialogMode && dialogCopy ? (
      <DialogShell
        title={dialogCopy.title}
        description={dialogCopy.body}
        onClose={closeDialog}
        closeLabel="Закрыть подтверждение"
        panelClassName="max-w-xl"
      >
        {requiresRights ? (
          <label className="course-publication-consent">
            <input
              autoFocus
              type="checkbox"
              checked={rightsConfirmed}
              disabled={Boolean(busyAction)}
              onChange={(event) => setRightsConfirmed(event.target.checked)}
            />
            <span>
              {educatorCourse
                ? "Я подтверждаю права на материалы и разрешаю ShiDao проверить и опубликовать этот фирменный курс."
                : "Я подтверждаю, что имею права на материалы и разрешаю пользователям ShiDao копировать, изменять и использовать их в своих курсах."}
            </span>
          </label>
        ) : null}

        {actionError ? (
          <p className="app-alert app-alert-error mt-4" role="alert">
            {actionError}
          </p>
        ) : null}

        <div className="dialog-shell-actions">
          <Button
            variant="ghost"
            disabled={Boolean(busyAction)}
            onClick={closeDialog}
          >
            Отмена
          </Button>
          <Button
            disabled={
              Boolean(busyAction) || (requiresRights && !rightsConfirmed)
            }
            onClick={() => void confirmDialogAction()}
          >
            {busyAction ? dialogCopy.busyLabel : dialogCopy.confirmLabel}
          </Button>
        </div>
      </DialogShell>
    ) : null;

  return (
    <>
      <div className="course-actions-wrap">
        <ActionMenu
          label={`Действия с курсом «${course.title}»`}
          items={items}
          disabled={Boolean(busyAction)}
          className={
            variant === "table" ? "course-index-table-action-menu" : undefined
          }
          triggerIcon={variant === "table" ? MoreVertical : undefined}
          triggerVariant={variant === "table" ? "ghost" : "secondary"}
          portal={variant === "table"}
        />
        {actionError && !dialogMode ? (
          <p className="course-action-inline-error" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>

      {variant === "table" && dialog && typeof document !== "undefined"
        ? createPortal(dialog, document.body)
        : dialog}
    </>
  );
}
