import { NextResponse, type NextRequest } from "next/server";
import { patchReport, deleteReport, type PatchReportInput } from "@/lib/api-client";
import { getSessionToken } from "@/lib/session";

export const runtime = "edge";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as PatchReportInput;

  try {
    const data = await patchReport(token, id, body);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "patch_failed" },
      { status: 502 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;

  try {
    await deleteReport(token, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "delete_failed" },
      { status: 502 },
    );
  }
}
