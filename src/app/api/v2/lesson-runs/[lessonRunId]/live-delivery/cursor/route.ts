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
      cursor: await service.setTeacherCursor(
        lessonRunId,
        await readLiveDeliveryJson(request),
      ),
    });
  } catch (error) {
    return liveDeliveryApiError(error);
  }
}
