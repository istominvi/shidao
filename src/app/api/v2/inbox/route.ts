import { NextResponse } from "next/server";
import {
  communicationApiError,
  communicationQuery,
  getCommunicationContext,
} from "@/modules/communication/server-context";

export async function GET(request: Request) {
  try {
    const { actor, service } = await getCommunicationContext();
    const inbox = await service.listInbox(actor, communicationQuery(request));
    return NextResponse.json({ inbox });
  } catch (error) {
    return communicationApiError(error);
  }
}
