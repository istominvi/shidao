import assert from "node:assert/strict";
import test from "node:test";
import { loadInboxRange } from "@/components/communication/inbox-pagination";
import type {
  InboxCursor,
  InboxItem,
  InboxPage,
} from "@/modules/communication/domain";

function directItem(id: string, lastActivityAt: string): InboxItem {
  return {
    id,
    kind: "direct",
    title: `Диалог ${id}`,
    preview: null,
    lastActivityAt,
    unreadCount: 0,
    pinned: false,
    threadId: id,
    lastMessageId: null,
    canSend: true,
    directLearnerProfileId: null,
  };
}

const systemItem: InboxItem = {
  id: "system",
  kind: "system",
  title: "ShiDao",
  preview: null,
  lastActivityAt: "2026-08-16T08:00:00.000Z",
  lastNotificationId: null,
  unreadCount: 0,
  pinned: true,
};

test("poll refreshes the complete loaded inbox range through the fresh cursor chain", async () => {
  const freshSecondPageCursor: InboxCursor = {
    activityAt: "2026-08-16T07:00:00.000Z",
    kind: "direct",
    id: "new-first",
  };
  const remainingCursor: InboxCursor = {
    activityAt: "2026-08-16T06:00:00.000Z",
    kind: "direct",
    id: "second-page",
  };
  const calls: Array<InboxCursor | null> = [];

  const pages: InboxPage[] = [
    {
      items: [systemItem, directItem("new-first", "2026-08-16T09:00:00.000Z")],
      nextCursor: freshSecondPageCursor,
      totalUnread: 7,
    },
    {
      items: [directItem("second-page", "2026-08-16T06:00:00.000Z")],
      nextCursor: remainingCursor,
      totalUnread: 7,
    },
  ];

  const result = await loadInboxRange(async (cursor) => {
    calls.push(cursor);
    const page = pages[calls.length - 1];
    assert.ok(page);
    return page;
  }, 2);

  assert.deepEqual(calls, [null, freshSecondPageCursor]);
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["system", "new-first", "second-page"],
  );
  assert.equal(result.loadedPageCount, 2);
  assert.deepEqual(result.nextCursor, remainingCursor);
  assert.equal(result.totalUnread, 7);
});
