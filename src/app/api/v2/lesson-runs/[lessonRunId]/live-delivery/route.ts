import {
  getTeacherLiveDeliveryContext,
  liveDeliveryApiError,
  liveDeliveryJson,
} from "@/modules/live-delivery/server-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ lessonRunId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { lessonRunId } = await params;
    const { service } = await getTeacherLiveDeliveryContext();
    return liveDeliveryJson({
      delivery: await service.getTeacherDelivery(lessonRunId),
    });
  } catch (error) {
    return liveDeliveryApiError(error);
  }
}
