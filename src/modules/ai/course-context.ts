import type {
  CourseLesson,
  CourseWorkspace,
  LessonComponent,
} from "@/modules/course-builder/domain";
import type { LearningRecord, LessonRun } from "@/modules/lesson-runs/domain";

export type CourseLearningHistory = {
  runs: LessonRun[];
  records: LearningRecord[];
};

function clip(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  if (maxLength <= 0) return "";
  if (maxLength === 1) return "…";
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/**
 * Leaves enough room for the assistant's bounded 24k-character conversation,
 * system instructions and request framing under RouterAI's 131,072-character
 * aggregate message limit.
 */
export const MAX_AI_CONTEXT_CHARACTERS = 96_000;

function maximumStringLength(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) {
    return value.reduce(
      (maximum, item) => Math.max(maximum, maximumStringLength(item)),
      0,
    );
  }
  if (value && typeof value === "object") {
    return Object.values(value).reduce<number>(
      (maximum, nested) => Math.max(maximum, maximumStringLength(nested)),
      0,
    );
  }
  return 0;
}

function clipContextStrings(value: unknown, maxStringLength: number): unknown {
  if (typeof value === "string") return clip(value, maxStringLength);
  if (Array.isArray(value)) {
    return value.map((item) => clipContextStrings(item, maxStringLength));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        clipContextStrings(nested, maxStringLength),
      ]),
    );
  }
  return value;
}

function contextCharacters(value: unknown) {
  return JSON.stringify(value).length;
}

/**
 * Applies one deterministic budget to the complete provider context. Normal
 * contexts are untouched; only an oversized context gets a shared adaptive
 * string cap, preserving the bounded Course/Lesson/history array structure.
 */
function boundedContext<T>(value: T): T {
  if (contextCharacters(value) <= MAX_AI_CONTEXT_CHARACTERS) return value;

  let lower = 0;
  let upper = maximumStringLength(value);
  let best = clipContextStrings(value, 0);

  while (lower <= upper) {
    const candidateLimit = Math.floor((lower + upper) / 2);
    const candidate = clipContextStrings(value, candidateLimit);
    if (contextCharacters(candidate) <= MAX_AI_CONTEXT_CHARACTERS) {
      best = candidate;
      lower = candidateLimit + 1;
    } else {
      upper = candidateLimit - 1;
    }
  }

  if (contextCharacters(best) > MAX_AI_CONTEXT_CHARACTERS) {
    throw new Error("AI context structure exceeds its hard character budget.");
  }
  return best as T;
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

function newestFirst(
  leftDate: string | null,
  rightDate: string | null,
  leftId: string,
  rightId: string,
) {
  return (
    new Date(rightDate ?? 0).getTime() - new Date(leftDate ?? 0).getTime() ||
    rightId.localeCompare(leftId)
  );
}

function learningHistoryContext(
  history: CourseLearningHistory = { runs: [], records: [] },
) {
  const completedRuns = history.runs
    .filter((run) => run.endedAt !== null)
    .sort((left, right) =>
      newestFirst(left.endedAt, right.endedAt, left.id, right.id),
    )
    .slice(0, 8);
  const finalizedRecords = history.records
    .filter((record) => record.occurredAt !== null)
    .sort((left, right) =>
      newestFirst(left.occurredAt, right.occurredAt, left.id, right.id),
    )
    .slice(0, 40);

  return {
    completedRunsIncluded: completedRuns.length,
    learnerResultsIncluded: finalizedRecords.length,
    recentRuns: completedRuns.map((run) => {
      const finalized = run.records.filter(
        (record) => record.occurredAt !== null,
      );
      return {
        occurredAt: run.endedAt,
        lessonTitle: clip(run.lessonTitle, 300),
        teacherReport: clip(run.teacherReport, 1_000),
        expectedLearnerCount: finalized.length,
        presentLearnerCount: finalized.filter(
          (record) => record.wasPresent === true,
        ).length,
        repeatRecommendedCount: finalized.filter(
          (record) => record.wasPresent === true && record.needsRepeat === true,
        ).length,
      };
    }),
    recentLearnerResults: finalizedRecords.map((record) => ({
      occurredAt: record.occurredAt,
      learner: clip(record.learnerDisplayName, 160),
      courseTitle: clip(record.courseTitleAtTime ?? "", 300),
      lessonTitle: clip(record.lessonTitleAtTime ?? "", 300),
      subject: clip(record.subjectAtTime ?? "", 200),
      wasPresent: record.wasPresent,
      needsRepeat: record.wasPresent === true ? record.needsRepeat : null,
      teacherComment: clip(record.teacherComment, 800),
    })),
    interpretationBoundary:
      "Отсутствие ученика не является результатом обучения. Не делайте вывод о понимании материала по записи с wasPresent=false; опирайтесь на комментарий преподавателя и needsRepeat только для присутствовавших учеников.",
  };
}

export function buildCoursePlanningContext(course: CourseWorkspace) {
  return boundedContext({
    course: courseBasics(course),
    existingLessons: course.lessons.map((lesson) => ({
      position: lesson.position,
      title: lesson.title,
      teacherComment: clip(lesson.summary, 300),
    })),
    attachmentMetadata: attachmentMetadata(course),
  });
}

export function buildLessonPlanningContext(
  course: CourseWorkspace,
  lesson: CourseLesson | null,
  proposedTitle: string,
  learningHistory: CourseLearningHistory = { runs: [], records: [] },
) {
  return boundedContext({
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
    learningHistory: learningHistoryContext(learningHistory),
    attachmentMetadata: attachmentMetadata(course),
  });
}

export function buildAssistantContext(
  course: CourseWorkspace,
  selectedLesson: CourseLesson | null,
  learningHistory: CourseLearningHistory = { runs: [], records: [] },
) {
  return boundedContext({
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
    learningHistory: learningHistoryContext(learningHistory),
    attachmentMetadata: attachmentMetadata(course),
    boundary:
      "Ассистент видит только метаданные вложений, но не содержимое файлов. Он не должен утверждать, что прочитал или проанализировал их.",
  });
}
