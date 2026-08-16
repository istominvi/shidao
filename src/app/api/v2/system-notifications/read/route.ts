import { NextResponse } from "next/server";
import {
  communicationApiError,
  getCommunicationContext,
  readCommunicationJson,
} from "@/modules/communication/server-context";

export async function POST(request: Request) {
  try {
    const { actor, service } = await getCommunicationContext();
    const receipt = await service.markSystemNotificationsRead(
      actor,
      await readCommunicationJson(request),
    );
    return NextResponse.json({ receipt });
  } catch (error) {
    return communicationApiError(error);
  }
}
