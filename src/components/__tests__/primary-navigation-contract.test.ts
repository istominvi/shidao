import assert from "node:assert/strict";
import test from "node:test";
import { ROUTES } from "../../lib/auth";
import {
  PRIMARY_NAV_CONFIG,
  type PrimaryNavConfig,
} from "../../lib/navigation/primary-nav";

function navSnapshot(id: PrimaryNavConfig["id"]) {
  return PRIMARY_NAV_CONFIG[id].items.map(({ id: itemId, label, href }) => ({
    id: itemId,
    label,
    href,
  }));
}

test("teacher navigation follows the demo order", () => {
  assert.deepEqual(navSnapshot("teacher"), [
    { id: "schedule", label: "Расписание", href: ROUTES.schedule },
    { id: "students", label: "Ученики", href: ROUTES.students },
    { id: "courses", label: "Курсы", href: ROUTES.courses },
  ]);
  assert.ok(PRIMARY_NAV_CONFIG.teacher.items.every((item) => item.icon));
});

test("parent and student navigation do not expose teacher-only surfaces", () => {
  const coursesOnly = [{ id: "courses", label: "Курсы", href: ROUTES.courses }];

  assert.deepEqual(navSnapshot("parent"), coursesOnly);
  assert.deepEqual(navSnapshot("student"), coursesOnly);
});

test("teacher navigation activates only the matching route tree", () => {
  const [schedule, students, courses] = PRIMARY_NAV_CONFIG.teacher.items;
  assert.ok(schedule && students && courses);

  assert.equal(schedule.isActive(ROUTES.schedule), true);
  assert.equal(schedule.isActive(`${ROUTES.schedule}/day`), true);
  assert.equal(schedule.isActive("/schedule-old"), false);
  assert.equal(schedule.isActive(ROUTES.students), false);

  assert.equal(students.isActive(ROUTES.students), true);
  assert.equal(students.isActive(`${ROUTES.students}/student-1`), true);
  assert.equal(students.isActive("/studentship"), false);
  assert.equal(students.isActive(ROUTES.courses), false);

  assert.equal(courses.isActive(ROUTES.courses), true);
  assert.equal(courses.isActive(`${ROUTES.courses}/course-1`), true);
  assert.equal(courses.isActive("/courses-old"), false);
  assert.equal(courses.isActive(null), false);
});
