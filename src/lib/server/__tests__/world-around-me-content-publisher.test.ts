import assert from "node:assert/strict";
import test from "node:test";
import {
  publishWorldAroundMeLessonOneContent,
  resolveWorldAroundMeLessonOneId,
} from "../world-around-me-content-publisher";

test("resolver prefers exact lesson id", async () => {
  const calls: string[] = [];
  const request = async <T>(path: string): Promise<T> => {
    calls.push(path);
    if (path.includes("id=eq.b62b2f3d-c16f-6f3a-4a90-c124439690cf")) {
      return [{ id: "b62b2f3d-c16f-6f3a-4a90-c124439690cf" }] as T;
    }
    throw new Error("should not query fallback paths");
  };

  const resolved = await resolveWorldAroundMeLessonOneId({
    request,
    methodologyId: "m1",
    moduleIndex: 1,
    lessonIndex: 1,
    unitIndex: 1,
    titleHint: "Животные на ферме",
  });

  assert.equal(resolved.resolution, "exact_id");
  assert.equal(resolved.lessonId, "b62b2f3d-c16f-6f3a-4a90-c124439690cf");
  assert.equal(calls.length, 1);
});

test("resolver falls back to position when exact id is missing", async () => {
  const request = async <T>(path: string): Promise<T> => {
    if (path.includes("id=eq.b62b2f3d-c16f-6f3a-4a90-c124439690cf")) {
      return [] as T;
    }
    if (path.includes("module_index=eq.1") && path.includes("lesson_index=eq.1")) {
      return [{ id: "lesson-by-position" }] as T;
    }
    throw new Error(`unexpected path: ${path}`);
  };

  const resolved = await resolveWorldAroundMeLessonOneId({
    request,
    methodologyId: "m1",
    moduleIndex: 1,
    lessonIndex: 1,
    unitIndex: 1,
    titleHint: "Животные на ферме",
  });

  assert.equal(resolved.resolution, "position");
  assert.equal(resolved.lessonId, "lesson-by-position");
});

test("resolver falls back to title when exact id and position are missing", async () => {
  const request = async <T>(path: string): Promise<T> => {
    if (path.includes("id=eq.b62b2f3d-c16f-6f3a-4a90-c124439690cf")) {
      return [] as T;
    }
    if (path.includes("module_index=eq.1") && path.includes("lesson_index=eq.1")) {
      return [] as T;
    }
    if (path.includes("title=ilike")) {
      return [{ id: "lesson-by-title" }] as T;
    }
    throw new Error(`unexpected path: ${path}`);
  };

  const resolved = await resolveWorldAroundMeLessonOneId({
    request,
    methodologyId: "m1",
    moduleIndex: 1,
    lessonIndex: 1,
    unitIndex: 1,
    titleHint: "Животные на ферме",
  });

  assert.equal(resolved.resolution, "title");
  assert.equal(resolved.lessonId, "lesson-by-title");
});

test("publisher upserts homework and student content for resolved lesson id", async () => {
  const posts: Array<{ path: string; payload: unknown }> = [];

  const request = async <T>(
    path: string,
    method: "GET" | "POST" | "PATCH" = "GET",
    options?: { payload?: unknown },
  ): Promise<T> => {
    if (method === "GET" && path.includes("/rest/v1/methodology?")) {
      return [{ id: "methodology-1" }] as T;
    }
    if (method === "GET" && path.includes("id=eq.b62b2f3d-c16f-6f3a-4a90-c124439690cf")) {
      return [{ id: "b62b2f3d-c16f-6f3a-4a90-c124439690cf" }] as T;
    }
    if (method === "POST") {
      posts.push({ path, payload: options?.payload });
      return [] as T;
    }
    return [] as T;
  };

  const result = await publishWorldAroundMeLessonOneContent({ request });

  assert.equal(result.methodologyId, "methodology-1");
  assert.equal(result.methodologyLessonId, "b62b2f3d-c16f-6f3a-4a90-c124439690cf");
  assert.equal(posts.some((item) => item.path.includes("methodology_lesson_homework")), true);
  assert.equal(posts.some((item) => item.path.includes("methodology_lesson_student_content")), true);
});
