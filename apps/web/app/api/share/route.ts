import { NextResponse, type NextRequest } from "next/server";
import { createShare } from "@/lib/api-client";
import { getSessionToken } from "@/lib/session";

export const runtime = "edge";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, error: "unauthenticated" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    pet_id?: string;
    scope?: "all" | "latest" | "recent_3";
  };
  if (!body.pet_id) {
    return NextResponse.json({ success: false, error: "missing_pet_id" }, { status: 400 });
  }
  try {
    const data = await createShare(token, body.pet_id, body.scope ?? "all");
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "share_failed" },
      { status: 502 },
    );
  }
}
