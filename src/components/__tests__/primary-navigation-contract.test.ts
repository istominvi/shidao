import assert from "node:assert/strict";
import test from "node:test";
import { ROUTES } from "../../lib/auth";
import { PRIMARY_NAV_CONFIG } from "../../lib/navigation/primary-nav";

test("every Account gets the same capability-neutral primary navigation", () => {
  assert.deepEqual(
    PRIMARY_NAV_CONFIG.account.items.map(({ id, label, href }) => ({
      id,
      label,
      href,
    })),
    [
      { id: "schedule", label: "Расписание", href: ROUTES.schedule },
      { id: "students", label: "Ученики", href: ROUTES.students },
      { id: "courses", label: "Курсы", href: ROUTES.courses },
    ],
  );
  assert.ok(PRIMARY_NAV_CONFIG.account.items.every((item) => item.icon));
});

test("Account navigation activates only the matching route tree", () => {
  for (const item of PRIMARY_NAV_CONFIG.account.items) {
    assert.equal(item.isActive(item.href), true);
    assert.equal(item.isActive(`${item.href}/detail`), true);
    assert.equal(item.isActive(`${item.href}-old`), false);
    assert.equal(item.isActive(null), false);
  }

  const students = PRIMARY_NAV_CONFIG.account.items.find(
    (item) => item.id === "students",
  );
  assert.equal(students?.isActive(ROUTES.observing), true);
  assert.equal(students?.isActive(`${ROUTES.observing}/profile`), true);
});
