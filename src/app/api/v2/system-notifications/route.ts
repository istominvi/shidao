import { NextResponse } from "next/server";
import {
  communicationApiError,
  communicationQuery,
  getCommunicationContext,
} from "@/modules/communication/server-context";

export async function GET(request: Request) {
  try {
    const { actor, service } = await getCommunicationContext();
    const notifications = await service.listSystemNotifications(
      actor,
      communicationQuery(request),
    );
    return NextResponse.json({ notifications });
  } catch (error) {
    return communicationApiError(error);
  }
}
