import {
  courseBuilderApiError,
  getCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";
import {
  catalogQuerySchema,
  CoursePublicationValidationError,
  parsePublicationContract,
} from "./contracts";

export const getCoursePublicationContext = getCourseBuilderContext;
export const coursePublicationApiError = courseBuilderApiError;
export const readPublicationJson = readJson;

export async function readOptionalPublicationJson(request: Request) {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CoursePublicationValidationError("Ожидался JSON body.");
  }
}

export function readCatalogQuery(request: Request) {
  const params = new URL(request.url).searchParams;
  return parsePublicationContract(catalogQuerySchema, {
    q: params.get("q") ?? undefined,
    subject: params.get("subject") ?? undefined,
    level: params.get("level") ?? undefined,
    cursor: params.get("cursor"),
    limit: params.get("limit") ?? undefined,
  });
}
