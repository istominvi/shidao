export type CommunicationThreadKind = "direct" | "course";

export type CommunicationThread = {
  id: string;
  kind: CommunicationThreadKind;
  title: string;
  courseId: string | null;
  directLearnerProfileId: string | null;
  preview: string | null;
  lastMessageId: number | null;
  lastActivityAt: string;
  unreadCount: number;
  canSend: boolean;
};

export type CommunicationMessage = {
  id: number;
  threadId: string;
  senderLabel: string;
  body: string;
  createdAt: string;
  isOwn: boolean;
};

export type DirectMessageTarget = {
  learnerProfileId: string;
  title: string;
  existingThreadId: string | null;
};

export type CourseMessageTarget = {
  courseId: string;
  title: string;
  existingThreadId: string | null;
};

export type MessageTargets = {
  direct: DirectMessageTarget[];
  courses: CourseMessageTarget[];
};

export type AssistantConversation = {
  id: string;
  title: string;
  contextCourseId: string | null;
  contextLessonId: string | null;
  lastTurnId: number | null;
  lastActivityAt: string;
  unreadCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssistantConversationList = {
  items: AssistantConversation[];
};

export type AssistantTurnRole = "user" | "assistant";
export type AssistantTurnDeliveryKind =
  "interactive" | "background_result" | "insight";

export type AssistantTurn = {
  id: number;
  role: AssistantTurnRole;
  deliveryKind: AssistantTurnDeliveryKind;
  body: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AssistantExchange = {
  userTurn: AssistantTurn;
  assistantTurn: AssistantTurn;
  proposedAction:
    | import("@/modules/ai/system-assistant-contracts").SystemAssistantActionProposal
    | null;
  quickReplies: import("@/modules/ai/system-assistant-contracts").SystemAssistantQuickReply[];
  sharedHistoryUsed: boolean;
  usage: import("@/modules/ai/course-builder-contracts").AiProviderUsage;
};

export type SystemNotificationSeverity =
  "info" | "success" | "warning" | "error" | "action_required";

export type SystemNotification = {
  id: number;
  eventType: string;
  severity: SystemNotificationSeverity;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  readAt: string | null;
};

type InboxItemBase = {
  id: string;
  title: string;
  preview: string | null;
  lastActivityAt: string;
  unreadCount: number;
  pinned: boolean;
};

export type DirectInboxItem = InboxItemBase & {
  kind: "direct";
  threadId: string;
  lastMessageId: number | null;
  canSend: boolean;
  directLearnerProfileId: string | null;
};

export type CourseInboxItem = InboxItemBase & {
  kind: "course";
  threadId: string;
  lastMessageId: number | null;
  canSend: boolean;
  courseId: string;
};

export type AssistantInboxItem = InboxItemBase & {
  kind: "assistant";
  conversationId: string;
  contextCourseId: string | null;
  contextLessonId: string | null;
};

export type SystemInboxItem = InboxItemBase & {
  kind: "system";
  id: "system";
  pinned: true;
  lastNotificationId: number | null;
};

export type InboxItem =
  DirectInboxItem | CourseInboxItem | AssistantInboxItem | SystemInboxItem;

export type InboxCursor = {
  activityAt: string;
  kind: Exclude<InboxItem["kind"], "system">;
  id: string;
};

export type CursorPage<T, TCursor = number> = {
  items: T[];
  nextCursor: TCursor | null;
};

export type InboxPage = CursorPage<InboxItem, InboxCursor> & {
  totalUnread: number;
};

export type ReadReceipt = {
  markedThroughId: number | null;
  unreadCount: number;
};

export type CommunicationActor = {
  authUserId: string;
  accountId: string;
};
