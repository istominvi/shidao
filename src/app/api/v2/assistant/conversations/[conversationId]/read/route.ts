import { NextResponse } from "next/server";
import {
  communicationApiError,
  getCommunicationContext,
  readCommunicationJson,
} from "@/modules/communication/server-context";

type RouteContext = { params: Promise<{ conversationId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { conversationId } = await params;
    const { actor, service } = await getCommunicationContext();
    const receipt = await service.markAssistantConversationRead(
      actor,
      conversationId,
      await readCommunicationJson(request),
    );
    return NextResponse.json({ receipt });
  } catch (error) {
    return communicationApiError(error);
  }
}
