import { NextResponse } from "next/server";
import {
  communicationApiError,
  getCommunicationContext,
} from "@/modules/communication/server-context";

export async function GET() {
  try {
    const { actor, service } = await getCommunicationContext();
    const quota = await service.getAssistantMonthlyQuota(actor);
    return NextResponse.json({ quota });
  } catch (error) {
    return communicationApiError(error);
  }
}
