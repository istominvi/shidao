export const COMMUNICATION_RPC = {
  listInbox: "list_my_communication_inbox",
  listMessageTargets: "list_my_message_targets",
  openDirectThread: "open_direct_communication_thread",
  openCourseThread: "open_course_communication_thread",
  listMessages: "list_my_communication_messages",
  sendMessage: "send_communication_message",
  markThreadRead: "mark_communication_thread_read",
  listAssistantConversations: "list_my_assistant_conversations",
  getAssistantConversation: "get_my_assistant_conversation",
  createAssistantConversation: "create_my_assistant_conversation",
  updateAssistantConversation: "update_my_assistant_conversation",
  listAssistantTurns: "list_my_assistant_turns",
  appendAssistantTurn: "append_my_assistant_turn",
  markAssistantConversationRead: "mark_my_assistant_conversation_read",
  listSystemNotifications: "list_my_system_notifications",
  markSystemNotificationsRead: "mark_my_system_notifications_read",
} as const;

export type CommunicationRpcName =
  (typeof COMMUNICATION_RPC)[keyof typeof COMMUNICATION_RPC];

export const COMMUNICATION_ADMIN_RPC = {
  appendAssistantTurn: "append_assistant_turn_admin",
  appendSystemNotification: "append_system_notification_admin",
} as const;
