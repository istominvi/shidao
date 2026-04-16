import { NextResponse } from "next/server";
import { publishWorldAroundMeLessonOneContent } from "@/lib/server/world-around-me-content-publisher";

function getPublishToken() {
  const token = process.env.METHODOLOGY_CONTENT_PUBLISH_TOKEN;
  if (!token) {
    throw new Error("METHODOLOGY_CONTENT_PUBLISH_TOKEN is not configured.");
  }
  return token;
}

export async function POST(request: Request) {
  try {
    const expectedToken = getPublishToken();
    const providedToken = request.headers.get("x-publish-token") ?? "";

    if (!providedToken || providedToken !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await publishWorldAroundMeLessonOneContent();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown publication error";
    console.error("[methodology-content-publish] failed", { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
