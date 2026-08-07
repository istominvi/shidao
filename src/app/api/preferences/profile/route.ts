import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "Переключение ролей больше не используется." },
    { status: 410 },
  );
}
