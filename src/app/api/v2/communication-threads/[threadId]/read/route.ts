import { NextResponse } from "next/server";
import {
  communicationApiError,
  getCommunicationContext,
  readCommunicationJson,
} from "@/modules/communication/server-context";

type RouteContext = { params: Promise<{ threadId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { threadId } = await params;
    const { actor, service } = await getCommunicationContext();
    const receipt = await service.markThreadRead(
      actor,
      threadId,
      await readCommunicationJson(request),
    );
    return NextResponse.json({ receipt });
  } catch (error) {
    return communicationApiError(error);
  }
}
