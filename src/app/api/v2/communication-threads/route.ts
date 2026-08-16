import { NextResponse } from "next/server";
import {
  communicationApiError,
  getCommunicationContext,
  readCommunicationJson,
} from "@/modules/communication/server-context";

export async function POST(request: Request) {
  try {
    const { actor, service } = await getCommunicationContext();
    const thread = await service.openThread(
      actor,
      await readCommunicationJson(request),
    );
    return NextResponse.json({ thread });
  } catch (error) {
    return communicationApiError(error);
  }
}
