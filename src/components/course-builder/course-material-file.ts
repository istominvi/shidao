import {
  COURSE_ASSET_MAX_BYTES,
  COURSE_ASSET_MIME_TYPES,
} from "@/modules/course-builder/contracts";

export type CourseAssetMimeType = (typeof COURSE_ASSET_MIME_TYPES)[number];

export const ACCEPTED_COURSE_FILE_TYPES = COURSE_ASSET_MIME_TYPES.join(",");

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

export function resolveCourseFileMimeType(
  file: File,
): CourseAssetMimeType | null {
  if (COURSE_ASSET_MIME_TYPES.includes(file.type as CourseAssetMimeType)) {
    return file.type as CourseAssetMimeType;
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? null;
}

export function validateCourseMaterialFile(file: File) {
  const mimeType = resolveCourseFileMimeType(file);
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
    mimeType,
    file:
      file.type === mimeType
        ? file
        : new File([file], file.name, {
            type: mimeType,
            lastModified: file.lastModified,
          }),
  };
}

export function formatCourseFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} Б`;
  if (sizeBytes < 1024 * 1024) {
    return `${Math.ceil(sizeBytes / 1024)} КБ`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export async function calculateCourseFileSha256(file: File) {
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
