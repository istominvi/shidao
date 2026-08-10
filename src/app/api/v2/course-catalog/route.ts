import { NextResponse } from "next/server";
import {
  coursePublicationApiError,
  getCoursePublicationContext,
  readCatalogQuery,
} from "@/modules/course-publications/server-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { actor, publicationService } = await getCoursePublicationContext();
    return NextResponse.json(
      await publicationService.listCatalog(actor, readCatalogQuery(request)),
    );
  } catch (error) {
    return coursePublicationApiError(error);
  }
}
