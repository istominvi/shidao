import assert from "node:assert/strict";
import test from "node:test";
import { pickTeacherPersonalSchoolMembership } from "../teacher-personal-school";

test("personal school picker ignores organization memberships", () => {
  const membership = pickTeacherPersonalSchoolMembership([
    {
      id: "org-membership",
      schoolId: "school-org-1",
      role: "teacher",
      schoolKind: "organization",
      schoolName: "Org School",
    },
  ]);

  assert.equal(membership, null);
});

test("personal school picker returns personal membership without mutating organization ownership", () => {
  const membership = pickTeacherPersonalSchoolMembership([
    {
      id: "org-membership",
      schoolId: "school-org-1",
      role: "teacher",
      schoolKind: "organization",
      schoolName: "Org School",
    },
    {
      id: "personal-membership",
      schoolId: "school-personal-1",
      role: "teacher",
      schoolKind: "personal",
      schoolName: "Teacher Personal",
    },
  ]);

  assert.equal(membership?.id, "personal-membership");
  assert.equal(membership?.schoolId, "school-personal-1");
  assert.equal(membership?.role, "teacher");
});
