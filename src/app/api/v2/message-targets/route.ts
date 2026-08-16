import { NextResponse } from "next/server";
import {
  communicationApiError,
  communicationQuery,
  getCommunicationContext,
} from "@/modules/communication/server-context";

export async function GET(request: Request) {
  try {
    const { actor, service } = await getCommunicationContext();
    const targets = await service.listMessageTargets(
      actor,
      communicationQuery(request),
    );
    return NextResponse.json({ targets });
  } catch (error) {
    return communicationApiError(error);
  }
}
