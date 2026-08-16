import { NextRequest, NextResponse } from "next/server";
import { aiApiError } from "@/modules/ai/server-context";
import { runCommunicationAssistantChat } from "@/modules/communication/assistant-runtime";
import { runPersistedAssistantExchange } from "@/modules/communication/assistant-orchestration";
import {
  appendAssistantUserTurnInputSchema,
  parseCommunicationContract,
} from "@/modules/communication/contracts";
import {
  communicationApiError,
  communicationQuery,
  getCommunicationContext,
  isCommunicationApiError,
  readCommunicationJson,
} from "@/modules/communication/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { conversationId } = await params;
    const { actor, service } = await getCommunicationContext();
    const [conversation, turns] = await Promise.all([
      service.getAssistantConversation(actor, conversationId),
      service.listAssistantTurns(
        actor,
        conversationId,
        communicationQuery(request),
      ),
    ]);
    return NextResponse.json({ conversation, turns });
  } catch (error) {
    return communicationApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { conversationId } = await params;
    const { actor, service } = await getCommunicationContext();
    const input = parseCommunicationContract(
      appendAssistantUserTurnInputSchema,
      await readCommunicationJson(request),
    );
    const exchange = await runPersistedAssistantExchange(
      {
        actor,
        service,
        chat: (assistantRequest, signal) =>
          runCommunicationAssistantChat(
            request,
            actor,
            assistantRequest,
            signal,
          ),
        loadAdminAppender: async () => {
          const { createCommunicationAdminRepository } =
            await import("@/modules/communication/admin-repository");
          return createCommunicationAdminRepository();
        },
      },
      conversationId,
      input,
      request.signal,
    );
    return NextResponse.json({ exchange });
  } catch (error) {
    if (isCommunicationApiError(error)) return communicationApiError(error);
    return aiApiError(error);
  }
}
