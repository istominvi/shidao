import type {
  InboxCursor,
  InboxItem,
  InboxPage,
} from "@/modules/communication/domain";

export type InboxPageLoader = (
  cursor: InboxCursor | null,
) => Promise<InboxPage>;

export type LoadedInboxRange = InboxPage & {
  loadedPageCount: number;
};

function inboxItemKey(item: InboxItem) {
  return `${item.kind}:${item.id}`;
}

export async function loadInboxRange(
  loadPage: InboxPageLoader,
  requestedPageCount: number,
): Promise<LoadedInboxRange> {
  if (!Number.isSafeInteger(requestedPageCount) || requestedPageCount < 1) {
    throw new RangeError("requestedPageCount must be a positive integer");
  }

  const items: InboxItem[] = [];
  const knownItems = new Set<string>();
  let cursor: InboxCursor | null = null;
  let nextCursor: InboxCursor | null = null;
  let totalUnread = 0;
  let loadedPageCount = 0;

  for (let index = 0; index < requestedPageCount; index += 1) {
    const page = await loadPage(cursor);
    loadedPageCount += 1;
    if (index === 0) totalUnread = page.totalUnread;

    for (const item of page.items) {
      const key = inboxItemKey(item);
      if (knownItems.has(key)) continue;
      knownItems.add(key);
      items.push(item);
    }

    nextCursor = page.nextCursor;
    if (!nextCursor) break;
    cursor = nextCursor;
  }

  return { items, nextCursor, totalUnread, loadedPageCount };
}
