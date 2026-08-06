import type {
  CourseLesson,
  CourseWorkspace,
  LessonComponent,
} from "@/modules/course-builder/domain";

function clip(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

const PRIVATE_OR_TECHNICAL_KEYS = new Set([
  "id",
  "lessonId",
  "storedFileId",
  "studentSlideId",
  "signedUrl",
  "checksumSha256",
  "storageBucket",
  "storagePath",
]);

const MAX_COMPONENT_PAYLOAD_CONTEXT_CHARACTERS = 1_800;
const MAX_PAYLOAD_STRING_CHARACTERS = 800;
const MAX_PAYLOAD_ARRAY_ITEMS = 12;

type ContextBudget = { remaining: number };

function compactPayload(
  value: unknown,
  depth = 0,
  budget: ContextBudget = {
    remaining: MAX_COMPONENT_PAYLOAD_CONTEXT_CHARACTERS,
  },
): unknown {
  if (budget.remaining <= 0) return "[сокращено]";
  if (depth > 5) return "[вложенная структура сокращена]";
  if (typeof value === "string") {
    const compacted = clip(
      value,
      Math.min(MAX_PAYLOAD_STRING_CHARACTERS, budget.remaining),
    );
    budget.remaining -= compacted.length;
    return compacted;
  }
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    budget.remaining -= String(value).length;
    return value;
  }
  if (Array.isArray(value)) {
    const result: unknown[] = [];
    for (const item of value.slice(0, MAX_PAYLOAD_ARRAY_ITEMS)) {
      if (budget.remaining <= 0) break;
      result.push(compactPayload(item, depth + 1, budget));
    }
    if (result.length < value.length) result.push("[список сокращён]");
    return result;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (PRIVATE_OR_TECHNICAL_KEYS.has(key)) continue;
      if (budget.remaining <= 0) {
        result.notice = "[payload сокращён]";
        break;
      }
      budget.remaining -= key.length;
      result[key] = compactPayload(nested, depth + 1, budget);
    }
    return result;
  }
  return undefined;
}

function componentContext(component: LessonComponent) {
  return {
    position: component.position,
    typeKey: component.typeKey,
    visibility:
      component.visibility === "learner_visible"
        ? "показывается ученику"
        : "только преподавателю",
    payload: compactPayload(component.payload),
  };
}

function selectedLessonContext(lesson: CourseLesson) {
  const orderedComponents = lesson.components
    .slice()
    .sort((left, right) => left.position - right.position);
  return {
    position: lesson.position,
    title: lesson.title,
    teacherComment: clip(lesson.summary, 1_200),
    componentCount: orderedComponents.length,
    componentsIncluded: Math.min(orderedComponents.length, 20),
    componentsTruncated: orderedComponents.length > 20,
    components: orderedComponents.slice(0, 20).map(componentContext),
    studentSlideCount: lesson.studentSlides.length,
  };
}

function courseBasics(course: CourseWorkspace) {
  return {
    title: course.title,
    subject: course.subject,
    goal: clip(course.goal, 1_200),
    level: course.level,
    audienceDescription: clip(course.audienceDescription, 1_200),
    targetLessonCount: course.targetLessonCount,
    teacherPreferences: clip(course.teacherPreferences, 2_000),
  };
}

function attachmentMetadata(course: CourseWorkspace) {
  return course.attachments.slice(0, 30).map((attachment) => ({
    filename: attachment.originalFilename,
    mimeType: attachment.mimeType,
    status: attachment.status,
    notice:
      "Файл только прикреплён. Его содержимое не извлекалось и не передавалось модели.",
  }));
}

export function buildCoursePlanningContext(course: CourseWorkspace) {
  return {
    course: courseBasics(course),
    existingLessons: course.lessons.map((lesson) => ({
      position: lesson.position,
      title: lesson.title,
      teacherComment: clip(lesson.summary, 300),
    })),
    attachmentMetadata: attachmentMetadata(course),
  };
}

export function buildLessonPlanningContext(
  course: CourseWorkspace,
  lesson: CourseLesson | null,
  proposedTitle: string,
) {
  return {
    course: courseBasics(course),
    lesson: lesson
      ? selectedLessonContext(lesson)
      : {
          title: proposedTitle,
          teacherComment: "",
          components: [],
          studentSlideCount: 0,
        },
    courseOutline: course.lessons.map((item) => ({
      position: item.position,
      title: item.title,
      teacherComment: clip(item.summary, 300),
    })),
    attachmentMetadata: attachmentMetadata(course),
  };
}

export function buildAssistantContext(
  course: CourseWorkspace,
  selectedLesson: CourseLesson | null,
) {
  return {
    course: courseBasics(course),
    courseOutline: course.lessons.map((lesson) => ({
      position: lesson.position,
      title: lesson.title,
      teacherComment: clip(lesson.summary, 300),
      componentCount: lesson.components.length,
      studentSlideCount: lesson.studentSlides.length,
    })),
    selectedLesson: selectedLesson
      ? selectedLessonContext(selectedLesson)
      : null,
    attachmentMetadata: attachmentMetadata(course),
    boundary:
      "Ассистент видит только метаданные вложений, но не содержимое файлов. Он не должен утверждать, что прочитал или проанализировал их.",
  };
}
