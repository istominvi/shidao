import assert from "node:assert/strict";
import test from "node:test";
import { buildLessonConnectionInfo } from "../lesson-connection";

test("buildLessonConnectionInfo maps online lesson with hostname label", () => {
  const connection = buildLessonConnectionInfo(
    {
      id: "sl-1",
      classId: "class-1",
      startsAt: "2026-04-10T10:00:00Z",
      runtimeStatus: "planned",
      format: "online",
      meetingLink: "https://meet.example.com/room-1",
    },
    { onlineCtaLabel: "Войти на урок" },
  );

  assert.equal(connection.kind, "online");
  assert.equal(connection.displayLabel, "meet.example.com");
  assert.equal(connection.ctaLabel, "Войти на урок");
});

test("buildLessonConnectionInfo maps offline lesson with place label", () => {
  const connection = buildLessonConnectionInfo(
    {
      id: "sl-2",
      classId: "class-1",
      startsAt: "2026-04-10T10:00:00Z",
      runtimeStatus: "planned",
      format: "offline",
      place: "Кабинет 9",
    },
    { onlineCtaLabel: "Войти на урок", offlineDisplayPrefix: "Место: " },
  );

  assert.equal(connection.kind, "offline");
  assert.equal(connection.place, "Кабинет 9");
  assert.equal(connection.displayLabel, "Место: Кабинет 9");
});
