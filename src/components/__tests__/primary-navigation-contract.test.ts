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
      { id: "courses", label: "Курсы", href: ROUTES.courses },
      { id: "schedule", label: "Расписание", href: ROUTES.schedule },
      { id: "students", label: "Ученики", href: ROUTES.students },
      {
        id: "learning-profile",
        label: "Мой учебный профиль",
        href: ROUTES.learningProfile,
      },
      { id: "observing", label: "Наблюдение", href: ROUTES.observing },
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
});
