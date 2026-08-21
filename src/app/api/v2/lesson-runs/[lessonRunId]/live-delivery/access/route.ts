import {
  getTeacherLiveDeliveryContext,
  liveDeliveryApiError,
  liveDeliveryJson,
  readLiveDeliveryJson,
} from "@/modules/live-delivery/server-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ lessonRunId: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { lessonRunId } = await params;
    const { service } = await getTeacherLiveDeliveryContext();
    return liveDeliveryJson({
      delivery: await service.setTeacherAccess(
        lessonRunId,
        await readLiveDeliveryJson(request),
      ),
    });
  } catch (error) {
    return liveDeliveryApiError(error);
  }
}
