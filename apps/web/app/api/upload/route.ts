import { NextResponse, type NextRequest } from "next/server";
import { uploadReport } from "@/lib/api-client";
import { getSessionToken } from "@/lib/session";

export const runtime = "edge";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const petId = url.searchParams.get("pet_id");
  if (!petId) {
    return NextResponse.json({ success: false, error: "missing_pet_id" }, { status: 400 });
  }

  const fd = await req.formData();
  const file = fd.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "missing_image" }, { status: 400 });
  }

  try {
    const result = await uploadReport(token, petId, file);
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "upload_failed";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
