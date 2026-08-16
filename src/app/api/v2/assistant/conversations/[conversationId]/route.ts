import { NextResponse } from "next/server";
import {
  communicationApiError,
  getCommunicationContext,
  readCommunicationJson,
} from "@/modules/communication/server-context";

type RouteContext = { params: Promise<{ conversationId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { conversationId } = await params;
    const { actor, service } = await getCommunicationContext();
    const conversation = await service.getAssistantConversation(
      actor,
      conversationId,
    );
    return NextResponse.json({ conversation });
  } catch (error) {
    return communicationApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { conversationId } = await params;
    const { actor, service } = await getCommunicationContext();
    const conversation = await service.updateAssistantConversation(
      actor,
      conversationId,
      await readCommunicationJson(request),
    );
    return NextResponse.json({ conversation });
  } catch (error) {
    return communicationApiError(error);
  }
}
