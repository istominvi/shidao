import {
  getLearnerLiveDeliveryContext,
  liveDeliveryAssetError,
  liveDeliveryAssetResponse,
} from "@/modules/live-delivery/server-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ lessonRunId: string; assetRef: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { lessonRunId, assetRef } = await params;
    const { actor, service } = await getLearnerLiveDeliveryContext();
    const revision = new URL(request.url).searchParams.get("revision");
    return liveDeliveryAssetResponse(
      await service.getLearnerAsset(
        actor,
        lessonRunId,
        assetRef,
        revision,
        request.headers.get("range"),
        request.signal,
      ),
    );
  } catch (error) {
    return liveDeliveryAssetError(error);
  }
}
