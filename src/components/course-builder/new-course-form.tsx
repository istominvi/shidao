"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  FileImage,
  FileText,
  Paperclip,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { ROUTES, toCourseRoute } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";
import { AiCoursePlanDialog } from "@/components/course-builder/ai-course-plan-dialog";
import { Button, productButtonClassName } from "@/components/ui/button";
import { FieldHint, FieldLabel, FormField } from "@/components/ui/form-field";
import { Input, productControlClassName } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  COURSE_ASSET_MAX_BYTES,
  COURSE_ASSET_MIME_TYPES,
  courseDraftInputSchema,
  prepareCourseAttachmentInputSchema,
  type CourseDraftInput,
} from "@/modules/course-builder/contracts";
import {
  assembleCourseDraft,
  applyAiCoursePlan,
  completeCourseAttachment,
  createCourseDraft,
  generateAiCoursePlan,
  prepareCourseAttachment,
  updateCourseDraft,
  uploadPreparedCourseAttachment,
} from "./course-builder-client";
import type { AiCoursePlanPreview } from "@/modules/ai/course-builder-contracts";

type SubmitIntent = "create" | "assemble" | "ai";
type UploadStatus = "queued" | "hashing" | "uploading" | "ready" | "error";
type CourseAssetMimeType = (typeof COURSE_ASSET_MIME_TYPES)[number];

type SelectedCourseFile = {
  localId: string;
  file: File;
};

type ValidatedCourseFile = SelectedCourseFile & {
  mimeType: CourseAssetMimeType;
  normalizedFile: File;
};

type UploadProgress = {
  status: UploadStatus;
  message: string;
};

const ACCEPTED_FILE_TYPES = COURSE_ASSET_MIME_TYPES.join(",");

const MIME_BY_EXTENSION: Record<string, CourseAssetMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
};

function resolveMimeType(file: File): CourseAssetMimeType | null {
  if (COURSE_ASSET_MIME_TYPES.includes(file.type as CourseAssetMimeType)) {
    return file.type as CourseAssetMimeType;
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? null;
}

function normalizedUploadFile(file: File, mimeType: CourseAssetMimeType) {
  if (file.type === mimeType) return file;
  return new File([file], file.name, {
    type: mimeType,
    lastModified: file.lastModified,
  });
}

function validateSelectedCourseFile({
  file,
  localId,
}: SelectedCourseFile): ValidatedCourseFile {
  const mimeType = resolveMimeType(file);
  if (!mimeType) {
    throw new Error(`Формат файла «${file.name}» не поддерживается.`);
  }
  if (file.size < 1) {
    throw new Error(`Файл «${file.name}» пуст.`);
  }
  if (file.size > COURSE_ASSET_MAX_BYTES) {
    throw new Error(`Файл «${file.name}» больше 10 МБ.`);
  }

  return {
    file,
    localId,
    mimeType,
    normalizedFile: normalizedUploadFile(file, mimeType),
  };
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} Б`;
  if (sizeBytes < 1024 * 1024) return `${Math.ceil(sizeBytes / 1024)} КБ`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Не удалось создать курс. Попробуйте ещё раз.";
}

export async function calculateFileSha256(file: File) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Этот браузер не поддерживает безопасную проверку файла.");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function readDraftInput(form: HTMLFormElement): CourseDraftInput {
  const formData = new FormData(form);
  const result = courseDraftInputSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    goal: String(formData.get("goal") ?? ""),
    level: String(formData.get("level") ?? ""),
    audienceDescription: String(formData.get("audienceDescription") ?? ""),
    targetLessonCount: Number(formData.get("targetLessonCount")),
    teacherPreferences: String(formData.get("teacherPreferences") ?? ""),
  });
  if (!result.success) {
    throw new Error("Проверьте обязательные поля и количество уроков.");
  }
  return result.data;
}

function uploadStatusLabel(progress: UploadProgress | undefined) {
  switch (progress?.status) {
    case "hashing":
      return "Проверяем файл…";
    case "uploading":
      return "Прикрепляем…";
    case "ready":
      return "Прикреплён, не проанализирован";
    case "error":
      return progress.message;
    default:
      return "Готов к загрузке";
  }
}

export function NewCourseForm() {
  const router = useRouter();
  const nextFileId = useRef(1);
  const [selectedFiles, setSelectedFiles] = useState<SelectedCourseFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<
    Record<string, UploadProgress>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
  const [aiPreview, setAiPreview] = useState<AiCoursePlanPreview | null>(null);

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const additions = Array.from(files, (file) => ({
      localId: `selected-file-${nextFileId.current++}`,
      file,
    }));
    setSelectedFiles((current) => [...current, ...additions]);
  }

  function removeFile(localId: string) {
    setSelectedFiles((current) =>
      current.filter((item) => item.localId !== localId),
    );
    setUploadProgress((current) => {
      const next = { ...current };
      delete next[localId];
      return next;
    });
  }

  function updateUploadProgress(localId: string, progress: UploadProgress) {
    setUploadProgress((current) => ({ ...current, [localId]: progress }));
  }

  async function uploadFile(
    courseId: string,
    selectedFile: ValidatedCourseFile,
  ) {
    const { localId, mimeType, normalizedFile } = selectedFile;
    updateUploadProgress(localId, {
      status: "hashing",
      message: "Вычисляем контрольную сумму.",
    });
    const checksumSha256 = await calculateFileSha256(normalizedFile);
    const attachmentInput = prepareCourseAttachmentInputSchema.parse({
      originalFilename: normalizedFile.name,
      mimeType,
      sizeBytes: normalizedFile.size,
      checksumSha256,
    });

    updateUploadProgress(localId, {
      status: "uploading",
      message: "Загружаем в приватное хранилище.",
    });
    const prepared = await prepareCourseAttachment(courseId, attachmentInput);
    await uploadPreparedCourseAttachment(prepared, normalizedFile);
    await completeCourseAttachment(courseId, prepared.asset.id);
    updateUploadProgress(localId, {
      status: "ready",
      message: "Файл прикреплён, но его содержимое не анализировалось.",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const intent: SubmitIntent =
      submitter?.value === "assemble"
        ? "assemble"
        : submitter?.value === "ai"
          ? "ai"
          : "create";
    let activeFileId: string | null = null;

    setIsSubmitting(true);
    setErrorMessage("");
    setProgressMessage("Сохраняем курс…");

    try {
      const draftInput = readDraftInput(event.currentTarget);
      const validatedFiles = selectedFiles.map(validateSelectedCourseFile);
      let courseId = createdCourseId;

      if (!courseId) {
        const course = await createCourseDraft(draftInput);
        courseId = course.id;
        setCreatedCourseId(courseId);
      } else {
        setProgressMessage("Обновляем сохранённый курс…");
        await updateCourseDraft(courseId, draftInput);
      }

      for (const selectedFile of validatedFiles) {
        if (uploadProgress[selectedFile.localId]?.status === "ready") {
          continue;
        }
        activeFileId = selectedFile.localId;
        setProgressMessage(`Прикрепляем ${selectedFile.file.name}…`);
        await uploadFile(courseId, selectedFile);
      }
      activeFileId = null;

      if (intent === "assemble") {
        setProgressMessage("Собираем первый урок и компоненты…");
        await assembleCourseDraft(courseId);
      }

      if (intent === "ai") {
        setProgressMessage("ИИ составляет программу курса…");
        setAiPreview(await generateAiCoursePlan(courseId));
        setProgressMessage("");
        return;
      }

      setProgressMessage("Курс сохранён. Открываем редактор…");
      router.push(toCourseRoute(courseId));
      router.refresh();
    } catch (error) {
      if (activeFileId) {
        updateUploadProgress(activeFileId, {
          status: "error",
          message: "Не удалось прикрепить",
        });
      }
      setErrorMessage(formatError(error));
      setProgressMessage("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function applyGeneratedCoursePlan() {
    if (!createdCourseId || !aiPreview || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage("");
    setProgressMessage("Сохраняем программу курса…");
    try {
      await applyAiCoursePlan(createdCourseId, aiPreview);
      router.push(toCourseRoute(createdCourseId));
      router.refresh();
    } catch (error) {
      setErrorMessage(formatError(error));
      setProgressMessage("");
      setAiPreview(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {errorMessage ? (
        <Alert tone="error" title="Не удалось завершить создание курса">
          <p>{errorMessage}</p>
          {createdCourseId ? (
            <p className="mt-2">
              Сам курс уже сохранён. Вторая копия не будет создана.{" "}
              <Link
                className="font-semibold underline underline-offset-2"
                href={toCourseRoute(createdCourseId)}
              >
                Открыть сохранённый курс
              </Link>
            </p>
          ) : null}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Основа курса"
        description="Эти данные сохраняются в курсе и задают контекст для ручной, быстрой или AI-сборки."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField>
            <FieldLabel htmlFor="course-title">Название</FieldLabel>
            <Input
              id="course-title"
              name="title"
              required
              minLength={2}
              maxLength={160}
              autoComplete="off"
              placeholder="Например, Китайский для путешествий"
            />
          </FormField>

          <FormField>
            <FieldLabel htmlFor="course-subject">Предмет или тема</FieldLabel>
            <Input
              id="course-subject"
              name="subject"
              required
              minLength={2}
              maxLength={160}
              autoComplete="off"
              placeholder="Китайский язык"
            />
          </FormField>

          <FormField className="md:col-span-2">
            <FieldLabel htmlFor="course-goal">Цель курса</FieldLabel>
            <textarea
              id="course-goal"
              name="goal"
              required
              minLength={2}
              maxLength={1200}
              className={productControlClassName(
                "input",
                "!h-auto min-h-24 resize-y py-3",
              )}
              placeholder="Какой результат должен получить ученик?"
            />
          </FormField>

          <FormField>
            <FieldLabel htmlFor="course-level">
              Уровень или исходная подготовка
            </FieldLabel>
            <Input
              id="course-level"
              name="level"
              required
              maxLength={240}
              autoComplete="off"
              placeholder="Начальный, с нуля"
            />
          </FormField>

          <FormField>
            <FieldLabel htmlFor="course-lesson-count">
              Планируемое количество уроков
            </FieldLabel>
            <Input
              id="course-lesson-count"
              name="targetLessonCount"
              type="number"
              required
              min={1}
              max={60}
              step={1}
              defaultValue={8}
              inputMode="numeric"
            />
          </FormField>

          <FormField className="md:col-span-2">
            <FieldLabel htmlFor="course-audience">
              Целевая аудитория или описание учащегося
            </FieldLabel>
            <textarea
              id="course-audience"
              name="audienceDescription"
              maxLength={1200}
              className={productControlClassName(
                "input",
                "!h-auto min-h-20 resize-y py-3",
              )}
              placeholder="Необязательно: возраст, интересы, особенности обучения"
            />
          </FormField>

          <FormField className="md:col-span-2">
            <FieldLabel htmlFor="course-preferences">
              Дополнительные пожелания преподавателя
            </FieldLabel>
            <textarea
              id="course-preferences"
              name="teacherPreferences"
              maxLength={2000}
              className={productControlClassName(
                "input",
                "!h-auto min-h-24 resize-y py-3",
              )}
              placeholder="Необязательно: темп, формат заданий, методические акценты"
            />
            <FieldHint>
              Это приватный контекст преподавателя: он не показывается на экране
              ученика.
            </FieldHint>
          </FormField>
        </div>
      </SurfaceCard>

      <SurfaceCard
        title="Файлы и изображения"
        description="Материалы сохраняются в закрытом файловом хранилище и связываются с курсом."
      >
        <Alert tone="info" title="Без автоматического анализа">
          Файл будет прикреплён к курсу, но не проанализирован: OCR, parsing и
          RAG не входят в этот этап.
        </Alert>

        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-5 py-7 text-center transition hover:border-neutral-500 hover:bg-white">
          <Paperclip className="h-6 w-6 text-neutral-600" aria-hidden="true" />
          <span className="mt-2 text-sm font-semibold text-neutral-900">
            Выбрать файлы или изображения
          </span>
          <span className="mt-1 text-xs leading-relaxed text-neutral-500">
            JPG, PNG, WebP, GIF, PDF, DOCX, PPTX, TXT или Markdown — до 10 МБ
            каждый
          </span>
          <input
            className="sr-only"
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            disabled={isSubmitting}
            onChange={(event) => {
              addFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </label>

        {selectedFiles.length > 0 ? (
          <ul className="mt-4 space-y-2" aria-label="Выбранные материалы">
            {selectedFiles.map(({ localId, file }) => {
              const progress = uploadProgress[localId];
              const isImage = resolveMimeType(file)?.startsWith("image/");
              const FileIcon = isImage ? FileImage : FileText;
              return (
                <li
                  key={localId}
                  className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
                    <FileIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {file.name}
                    </p>
                    <p
                      className={`mt-0.5 text-xs ${
                        progress?.status === "error"
                          ? "text-rose-700"
                          : progress?.status === "ready"
                            ? "text-emerald-700"
                            : "text-neutral-500"
                      }`}
                    >
                      {formatFileSize(file.size)} ·{" "}
                      {uploadStatusLabel(progress)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Убрать файл ${file.name}`}
                    disabled={isSubmitting || progress?.status === "ready"}
                    onClick={() => removeFile(localId)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">
            Вложения необязательны: пустой черновик можно создать без них.
          </p>
        )}
      </SurfaceCard>

      <div className="flex flex-col-reverse gap-3 rounded-2xl border border-neutral-200 bg-white/85 p-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={ROUTES.courses}
          className={productButtonClassName("ghost", "w-full sm:w-auto")}
        >
          Отмена
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            name="intent"
            value="create"
            variant="secondary"
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Создать курс
          </Button>
          <Button
            type="submit"
            name="intent"
            value="assemble"
            disabled={isSubmitting}
            className="w-full gap-2 sm:w-auto"
          >
            <WandSparkles className="h-4 w-4" aria-hidden="true" />
            Собрать черновик без ИИ
          </Button>
          <Button
            type="submit"
            name="intent"
            value="ai"
            disabled={isSubmitting}
            className="w-full gap-2 sm:w-auto"
          >
            <WandSparkles className="h-4 w-4" aria-hidden="true" />
            Создать с ИИ
          </Button>
        </div>
      </div>

      {progressMessage ? (
        <p
          className="text-center text-sm font-medium text-neutral-700"
          role="status"
          aria-live="polite"
        >
          {progressMessage}
        </p>
      ) : null}

      {aiPreview ? (
        <AiCoursePlanDialog
          preview={aiPreview}
          applying={isSubmitting}
          onClose={() => setAiPreview(null)}
          onApply={() => void applyGeneratedCoursePlan()}
        />
      ) : null}
    </form>
  );
}
