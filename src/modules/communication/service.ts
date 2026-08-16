import {
  appendAssistantUserTurnInputSchema,
  assistantConversationListQuerySchema,
  assistantTurnPageQuerySchema,
  createAssistantConversationInputSchema,
  inboxQuerySchema,
  markAssistantConversationReadInputSchema,
  markCommunicationThreadReadInputSchema,
  markSystemNotificationsReadInputSchema,
  messagePageQuerySchema,
  messageTargetsQuerySchema,
  openCommunicationThreadInputSchema,
  parseCommunicationContract,
  sendCommunicationMessageInputSchema,
  systemNotificationPageQuerySchema,
  updateAssistantConversationInputSchema,
  CommunicationApplicationError,
  communicationUuidSchema,
  type AppendAssistantUserTurnInput,
  type AssistantConversationListQuery,
  type AssistantTurnPageQuery,
  type CreateAssistantConversationInput,
  type InboxQuery,
  type MarkAssistantConversationReadInput,
  type MarkCommunicationThreadReadInput,
  type MarkSystemNotificationsReadInput,
  type MessagePageQuery,
  type MessageTargetsQuery,
  type OpenCommunicationThreadInput,
  type SendCommunicationMessageInput,
  type SystemNotificationPageQuery,
  type UpdateAssistantConversationInput,
} from "./contracts";
import type { AssistantConversation, CommunicationActor } from "./domain";
import {
  CommunicationRepositoryError,
  type CommunicationRepository,
} from "./repository";

export type CommunicationServiceDependencies = {
  repository: CommunicationRepository;
};

export type CommunicationApplicationService = ReturnType<
  typeof createCommunicationService
>;

function unavailable(): never {
  throw new CommunicationApplicationError(
    "Сервис сообщений временно недоступен.",
    503,
    "communication_unavailable",
  );
}

function mapRepositoryError(error: CommunicationRepositoryError): never {
  if (error.status === 401) {
    throw new CommunicationApplicationError(
      "Войдите снова, чтобы открыть сообщения.",
      401,
      "communication_reauthentication_required",
    );
  }
  if (
    /(?:not_found|not_accessible|access_denied|relation_required|membership_required|unavailable)/i.test(
      error.message,
    )
  ) {
    throw new CommunicationApplicationError(
      "Диалог не найден или больше недоступен.",
      404,
      "communication_not_found",
    );
  }
  if (/(?:archived|changed|conflict|stale)/i.test(error.message)) {
    throw new CommunicationApplicationError(
      "Диалог изменился. Обновите сообщения и попробуйте снова.",
      409,
      "communication_conflict",
    );
  }
  if (
    error.status === 400 ||
    /(?:invalid|too_long|required)/i.test(error.message)
  ) {
    throw new CommunicationApplicationError(
      "Проверьте данные сообщения.",
      400,
      "communication_validation_error",
    );
  }
  unavailable();
}

export function createCommunicationService(
  dependencies: CommunicationServiceDependencies,
) {
  const repository = dependencies.repository;

  async function operation<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof CommunicationApplicationError) throw error;
      if (error instanceof CommunicationRepositoryError) {
        return mapRepositoryError(error);
      }
      return unavailable();
    }
  }

  return {
    listInbox(_actor: CommunicationActor, rawInput: InboxQuery | unknown) {
      const input = parseCommunicationContract(inboxQuerySchema, rawInput);
      return operation(() => repository.listInbox(input));
    },

    listMessageTargets(
      _actor: CommunicationActor,
      rawInput: MessageTargetsQuery | unknown,
    ) {
      const input = parseCommunicationContract(
        messageTargetsQuerySchema,
        rawInput,
      );
      return operation(() => repository.listMessageTargets(input));
    },

    openThread(
      _actor: CommunicationActor,
      rawInput: OpenCommunicationThreadInput | unknown,
    ) {
      const input = parseCommunicationContract(
        openCommunicationThreadInputSchema,
        rawInput,
      );
      return operation(() =>
        input.kind === "direct"
          ? repository.openDirectThread(input.learnerProfileId)
          : repository.openCourseThread(input.courseId),
      );
    },

    listMessages(
      _actor: CommunicationActor,
      threadIdValue: string,
      rawInput: MessagePageQuery | unknown,
    ) {
      const threadId = parseCommunicationContract(
        communicationUuidSchema,
        threadIdValue,
      );
      const input = parseCommunicationContract(
        messagePageQuerySchema,
        rawInput,
      );
      return operation(() => repository.listMessages(threadId, input));
    },

    sendMessage(
      _actor: CommunicationActor,
      threadIdValue: string,
      rawInput: SendCommunicationMessageInput | unknown,
    ) {
      const threadId = parseCommunicationContract(
        communicationUuidSchema,
        threadIdValue,
      );
      const input = parseCommunicationContract(
        sendCommunicationMessageInputSchema,
        rawInput,
      );
      return operation(() => repository.sendMessage(threadId, input));
    },

    markThreadRead(
      _actor: CommunicationActor,
      threadIdValue: string,
      rawInput: MarkCommunicationThreadReadInput | unknown,
    ) {
      const threadId = parseCommunicationContract(
        communicationUuidSchema,
        threadIdValue,
      );
      const input = parseCommunicationContract(
        markCommunicationThreadReadInputSchema,
        rawInput,
      );
      return operation(() => repository.markThreadRead(threadId, input));
    },

    listAssistantConversations(
      _actor: CommunicationActor,
      rawInput: AssistantConversationListQuery | unknown,
    ) {
      const input = parseCommunicationContract(
        assistantConversationListQuerySchema,
        rawInput,
      );
      return operation(() => repository.listAssistantConversations(input));
    },

    createAssistantConversation(
      _actor: CommunicationActor,
      rawInput: CreateAssistantConversationInput | unknown,
    ) {
      const input = parseCommunicationContract(
        createAssistantConversationInputSchema,
        rawInput,
      );
      return operation(() => repository.createAssistantConversation(input));
    },

    updateAssistantConversation(
      _actor: CommunicationActor,
      conversationIdValue: string,
      rawInput: UpdateAssistantConversationInput | unknown,
    ) {
      const conversationId = parseCommunicationContract(
        communicationUuidSchema,
        conversationIdValue,
      );
      const input = parseCommunicationContract(
        updateAssistantConversationInputSchema,
        rawInput,
      );
      return operation(() =>
        repository.updateAssistantConversation(conversationId, input),
      );
    },

    listAssistantTurns(
      _actor: CommunicationActor,
      conversationIdValue: string,
      rawInput: AssistantTurnPageQuery | unknown,
    ) {
      const conversationId = parseCommunicationContract(
        communicationUuidSchema,
        conversationIdValue,
      );
      const input = parseCommunicationContract(
        assistantTurnPageQuerySchema,
        rawInput,
      );
      return operation(() =>
        repository.listAssistantTurns(conversationId, input),
      );
    },

    appendAssistantUserTurn(
      _actor: CommunicationActor,
      conversationIdValue: string,
      rawInput: AppendAssistantUserTurnInput | unknown,
    ) {
      const conversationId = parseCommunicationContract(
        communicationUuidSchema,
        conversationIdValue,
      );
      const input = parseCommunicationContract(
        appendAssistantUserTurnInputSchema,
        rawInput,
      );
      return operation(() =>
        repository.appendAssistantUserTurn(conversationId, input),
      );
    },

    markAssistantConversationRead(
      _actor: CommunicationActor,
      conversationIdValue: string,
      rawInput: MarkAssistantConversationReadInput | unknown,
    ) {
      const conversationId = parseCommunicationContract(
        communicationUuidSchema,
        conversationIdValue,
      );
      const input = parseCommunicationContract(
        markAssistantConversationReadInputSchema,
        rawInput,
      );
      return operation(() =>
        repository.markAssistantConversationRead(conversationId, input),
      );
    },

    async getAssistantConversation(
      _actor: CommunicationActor,
      conversationIdValue: string,
    ): Promise<AssistantConversation> {
      const conversationId = parseCommunicationContract(
        communicationUuidSchema,
        conversationIdValue,
      );
      const conversation = await operation(() =>
        repository.getAssistantConversation(conversationId),
      );
      if (conversation.archivedAt) {
        throw new CommunicationApplicationError(
          "Диалог с ИИ не найден или находится в архиве.",
          404,
          "assistant_conversation_not_found",
        );
      }
      return conversation;
    },

    listSystemNotifications(
      _actor: CommunicationActor,
      rawInput: SystemNotificationPageQuery | unknown,
    ) {
      const input = parseCommunicationContract(
        systemNotificationPageQuerySchema,
        rawInput,
      );
      return operation(() => repository.listSystemNotifications(input));
    },

    markSystemNotificationsRead(
      _actor: CommunicationActor,
      rawInput: MarkSystemNotificationsReadInput | unknown,
    ) {
      const input = parseCommunicationContract(
        markSystemNotificationsReadInputSchema,
        rawInput,
      );
      return operation(() => repository.markSystemNotificationsRead(input));
    },
  };
}
