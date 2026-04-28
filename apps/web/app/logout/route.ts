import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export const runtime = "edge";

async function logout(req: NextRequest): Promise<NextResponse> {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/", req.url));
}

export const POST = logout;
export const GET = logout;
