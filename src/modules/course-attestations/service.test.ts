import assert from "node:assert/strict";
import test from "node:test";
import type { CourseAttestationRepository } from "./repository";
import {
  CourseAttestationApplicationError,
  createCourseAttestationService,
} from "./service";

const COURSE_ID = "00000000-0000-4000-8000-000000000001";

function repository(): CourseAttestationRepository {
  return {
    async getPublicationAttestation() {
      throw new Error("unused");
    },
    async submitPublicationAttestation() {
      throw new Error("unused");
    },
    async listAccountAttestations() {
      return [];
    },
    async getAuthoredCourseAttestation() {
      return null;
    },
    async replaceAuthoredCourseAttestation(_courseId, input) {
      return { version: 1, ...input };
    },
  };
}

test("authored attestation is fail-closed without an educator authoring boundary", async () => {
  const service = createCourseAttestationService({ repository: repository() });
  await assert.rejects(
    () => service.getAuthoredCourseAttestation(COURSE_ID),
    (error: unknown) =>
      error instanceof CourseAttestationApplicationError &&
      error.code === "educator_course_authoring_denied" &&
      error.status === 403,
  );
});

test("authorized owner can replace a validated authored attestation", async () => {
  const authorized: string[] = [];
  const service = createCourseAttestationService({
    repository: repository(),
    requireAuthoredEducatorCourse: async (courseId) => {
      authorized.push(courseId);
    },
  });
  const result = await service.replaceAuthoredCourseAttestation(COURSE_ID, {
    title: "Итоговая аттестация",
    description: "Проверка программы",
    passingScorePercent: 80,
    questions: [
      {
        id: "q_1",
        prompt: "Какой вариант верный?",
        options: [
          { id: "o_1", label: "Верный" },
          { id: "o_2", label: "Неверный" },
        ],
        correctOptionId: "o_1",
        explanation: "Пояснение",
      },
    ],
  });
  assert.deepEqual(authorized, [COURSE_ID]);
  assert.equal(result.version, 1);
});
