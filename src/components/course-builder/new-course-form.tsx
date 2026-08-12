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
import {
  ACCEPTED_COURSE_FILE_TYPES,
  formatCourseFileSize,
  resolveCourseFileMimeType,
  validateCourseMaterialFile,
  type CourseAssetMimeType,
} from "@/components/course-builder/course-material-file";
import {
  COURSE_WORKSPACE_TABS,
  type CourseWorkspaceSurface,
} from "@/components/course-builder/course-workspace-navigation";
import { Button, productButtonClassName } from "@/components/ui/button";
import { FieldHint, FieldLabel, FormField } from "@/components/ui/form-field";
import { Input, productControlClassName } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  WorkspaceTabs,
  workspaceTabId,
  workspaceTabPanelId,
} from "@/components/ui/workspace-tabs";
import {
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
import type { CourseLearningAudience } from "@/modules/course-builder/learning-audience";

type SubmitIntent = "create" | "assemble" | "ai";
type UploadStatus = "queued" | "hashing" | "uploading" | "ready" | "error";

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

const ACCEPTED_FILE_TYPES = ACCEPTED_COURSE_FILE_TYPES;
const NEW_COURSE_WORKSPACE_TABS_ID = "new-course-workspace";

function resolveMimeType(file: File): CourseAssetMimeType | null {
  return resolveCourseFileMimeType(file);
}

function validateSelectedCourseFile({
  file,
  localId,
}: SelectedCourseFile): ValidatedCourseFile {
  const validated = validateCourseMaterialFile(file);

  return {
    file,
    localId,
    mimeType: validated.mimeType,
    normalizedFile: validated.file,
  };
}

function formatFileSize(sizeBytes: number) {
  return formatCourseFileSize(sizeBytes);
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
    learningAudience: String(formData.get("learningAudience") ?? "children"),
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
  const [activeSurface, setActiveSurface] =
    useState<CourseWorkspaceSurface>("about");
  const [selectedFiles, setSelectedFiles] = useState<SelectedCourseFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<
    Record<string, UploadProgress>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
  const [aiPreview, setAiPreview] = useState<AiCoursePlanPreview | null>(null);
  const [learningAudience, setLearningAudience] =
    useState<CourseLearningAudience>("children");

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
      router.replace(
        intent === "create"
          ? `${toCourseRoute(courseId)}?tab=about`
          : toCourseRoute(courseId),
      );
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
      router.replace(toCourseRoute(createdCourseId));
    } catch (error) {
      setErrorMessage(formatError(error));
      setProgressMessage("");
      setAiPreview(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <WorkspaceTabs
        idBase={NEW_COURSE_WORKSPACE_TABS_ID}
        ariaLabel="Разделы нового курса"
        value={activeSurface}
        items={COURSE_WORKSPACE_TABS}
        onChange={setActiveSurface}
      />

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

      <section
        id={workspaceTabPanelId(NEW_COURSE_WORKSPACE_TABS_ID, "lessons")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(
          NEW_COURSE_WORKSPACE_TABS_ID,
          "lessons",
        )}
        hidden={activeSurface !== "lessons"}
        tabIndex={0}
      >
        <SurfaceCard
          title="Уроки появятся после сохранения"
          description="Сначала заполните сведения во вкладке «О курсе». После сохранения здесь можно будет создавать и собирать уроки."
        />
      </section>

      <form
        id={workspaceTabPanelId(NEW_COURSE_WORKSPACE_TABS_ID, "about")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(NEW_COURSE_WORKSPACE_TABS_ID, "about")}
        hidden={activeSurface !== "about"}
        tabIndex={0}
        className="space-y-5"
        onSubmit={handleSubmit}
      >
        <SurfaceCard
          title="Основа курса"
          description="Эти данные сохраняются в курсе и задают контекст для ручной, быстрой или AI-сборки."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField className="md:col-span-2">
              <p className="form-field-label">Направление обучения</p>
              <input
                type="hidden"
                name="learningAudience"
                value={learningAudience}
              />
              <SegmentedControl
                ariaLabel="Направление обучения"
                value={learningAudience}
                onChange={setLearningAudience}
                disabled={isSubmitting}
                items={[
                  { value: "children", label: "Обучение детей" },
                  { value: "educators", label: "Обучение педагогов" },
                ]}
              />
            </FormField>

            <FormField>
              <FieldLabel htmlFor="course-title">Название</FieldLabel>
              <Input
                id="course-title"
                name="title"
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
                maxLength={2000}
                className={productControlClassName(
                  "input",
                  "!h-auto min-h-24 resize-y py-3",
                )}
                placeholder="Необязательно: темп, формат заданий, методические акценты"
              />
              <FieldHint>
                Это приватный контекст преподавателя: он не показывается на
                экране ученика.
              </FieldHint>
            </FormField>
          </div>
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
              Сохранить курс
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
      </form>

      <section
        id={workspaceTabPanelId(NEW_COURSE_WORKSPACE_TABS_ID, "materials")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(
          NEW_COURSE_WORKSPACE_TABS_ID,
          "materials",
        )}
        hidden={activeSurface !== "materials"}
        tabIndex={0}
      >
        <SurfaceCard
          title="Файлы и изображения"
          description="Материалы сохраняются в закрытом файловом хранилище и связываются с курсом после сохранения."
        >
          <Alert tone="info" title="Без автоматического анализа">
            Файл будет прикреплён к курсу, но не проанализирован: OCR, parsing и
            RAG не входят в этот этап.
          </Alert>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-5 py-7 text-center transition hover:border-neutral-500 hover:bg-white">
            <Paperclip
              className="h-6 w-6 text-neutral-600"
              aria-hidden="true"
            />
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
              Материалы необязательны: курс можно сохранить без них.
            </p>
          )}
        </SurfaceCard>
      </section>

      <section
        id={workspaceTabPanelId(NEW_COURSE_WORKSPACE_TABS_ID, "history")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(
          NEW_COURSE_WORKSPACE_TABS_ID,
          "history",
        )}
        hidden={activeSurface !== "history"}
        tabIndex={0}
      >
        <SurfaceCard
          title="История появится после сохранения"
          description="Завершённые проведения уроков будут доступны здесь, когда курс будет сохранён и начнёт использоваться."
        />
      </section>

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
    </div>
  );
}
