import { NextResponse } from "next/server";
import {
  communicationApiError,
  communicationQuery,
  getCommunicationContext,
  readCommunicationJson,
} from "@/modules/communication/server-context";

export async function GET(request: Request) {
  try {
    const { actor, service } = await getCommunicationContext();
    const result = await service.listAssistantConversations(
      actor,
      communicationQuery(request),
    );
    return NextResponse.json({ conversations: result.items });
  } catch (error) {
    return communicationApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, service } = await getCommunicationContext();
    const conversation = await service.createAssistantConversation(
      actor,
      await readCommunicationJson(request),
    );
    return NextResponse.json({ conversation });
  } catch (error) {
    return communicationApiError(error);
  }
}
