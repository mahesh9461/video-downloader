import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  const baseUrl = request.nextUrl.origin;
  const targetPath = state && state.startsWith("/") ? state : "/autopilot";

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}${targetPath}?youtube_auth=error&error_detail=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}${targetPath}?youtube_auth=error&error_detail=No+code+received`
    );
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/youtube/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.detail || "Failed to exchange token with Google";
      return NextResponse.redirect(
        `${baseUrl}${targetPath}?youtube_auth=error&error_detail=${encodeURIComponent(msg)}`
      );
    }

    return NextResponse.redirect(`${baseUrl}${targetPath}?youtube_auth=success`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Exchange error";
    return NextResponse.redirect(
      `${baseUrl}${targetPath}?youtube_auth=error&error_detail=${encodeURIComponent(errorMsg)}`
    );
  }
}
