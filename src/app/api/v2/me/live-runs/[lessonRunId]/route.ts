import {
  getLearnerLiveDeliveryContext,
  liveDeliveryApiError,
  liveDeliveryJson,
} from "@/modules/live-delivery/server-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ lessonRunId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { lessonRunId } = await params;
    const { actor, service } = await getLearnerLiveDeliveryContext();
    return liveDeliveryJson({
      state: await service.getLearnerState(actor, lessonRunId),
    });
  } catch (error) {
    return liveDeliveryApiError(error);
  }
}
