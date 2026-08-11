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
  "id" | "title" | "lessonCount" | "publication"
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

export function CoursePublicationBadges({
  publication,
}: {
  publication: OwnedCoursePublication | null | undefined;
}) {
  if (!isPublished(publication)) return null;

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

  const items: ActionMenuItem[] = [
    {
      id: "duplicate",
      label: busyAction === "duplicate" ? "Дублируем…" : "Дублировать",
      icon: BookCopy,
      disabled: Boolean(busyAction),
      onSelect: () => void duplicateCourse(),
    },
  ];

  if (!published) {
    items.push({
      id: "publish",
      label: "Опубликовать",
      icon: Send,
      separatorBefore: true,
      disabled: Boolean(busyAction) || course.lessonCount === 0,
      hint:
        course.lessonCount === 0
          ? "Сначала добавьте хотя бы один урок"
          : undefined,
      onSelect: () => openDialog("publish"),
    });
  } else {
    if (course.publication?.hasUnpublishedChanges) {
      items.push({
        id: "update-publication",
        label: "Обновить публикацию",
        icon: RefreshCw,
        separatorBefore: true,
        disabled: Boolean(busyAction),
        onSelect: () => openDialog("update"),
      });
    }
    items.push({
      id: "open-publication",
      label: "Открыть в каталоге",
      icon: ExternalLink,
      href: `/courses?tab=catalog&course=${encodeURIComponent(course.publication!.id)}`,
      separatorBefore: !course.publication?.hasUnpublishedChanges,
    });
    items.push({
      id: "unpublish",
      label: "Снять с публикации",
      icon: Undo2,
      destructive: true,
      disabled: Boolean(busyAction),
      onSelect: () => openDialog("unpublish"),
    });
  }

  if (variant === "table") {
    items.push({
      id: "delete",
      label: "Удалить",
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      disabled: Boolean(busyAction) || published,
      hint: published ? "Сначала снимите курс с публикации" : undefined,
      onSelect: () => openDialog("delete"),
    });
  }

  const dialogCopy = dialogMode ? PUBLICATION_DIALOG_COPY[dialogMode] : null;
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
              Я подтверждаю, что имею права на материалы и разрешаю
              пользователям ShiDao копировать, изменять и использовать их в
              своих курсах.
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
