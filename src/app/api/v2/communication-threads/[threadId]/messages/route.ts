import { NextResponse } from "next/server";
import {
  communicationApiError,
  communicationQuery,
  getCommunicationContext,
  readCommunicationJson,
} from "@/modules/communication/server-context";

type RouteContext = { params: Promise<{ threadId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { threadId } = await params;
    const { actor, service } = await getCommunicationContext();
    const messages = await service.listMessages(
      actor,
      threadId,
      communicationQuery(request),
    );
    return NextResponse.json({ messages });
  } catch (error) {
    return communicationApiError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { threadId } = await params;
    const { actor, service } = await getCommunicationContext();
    const message = await service.sendMessage(
      actor,
      threadId,
      await readCommunicationJson(request),
    );
    return NextResponse.json({ message });
  } catch (error) {
    return communicationApiError(error);
  }
}
