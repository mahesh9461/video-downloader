import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = path.join("/");
  const targetUrl = `${BACKEND_URL}/api/${targetPath}`;

  try {
    const body = await request.json();

    const backendResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1",
      },
      body: JSON.stringify(body),
    });

    // For SSE streaming responses
    if (backendResponse.headers.get("content-type")?.includes("text/event-stream")) {
      const stream = backendResponse.body;
      return new NextResponse(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await backendResponse.json();

    return NextResponse.json(data, {
      status: backendResponse.status,
    });
  } catch (error) {
    console.error(`Proxy error for ${targetUrl}:`, error);
    return NextResponse.json(
      { detail: "Backend service unavailable", error_type: "network" },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = path.join("/");
  const targetUrl = `${BACKEND_URL}/api/${targetPath}`;

  try {
    const backendResponse = await fetch(targetUrl, {
      headers: {
        "X-Forwarded-For": request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1",
      },
    });

    // For file downloads
    if (backendResponse.headers.get("content-disposition")) {
      const stream = backendResponse.body;
      return new NextResponse(stream, {
        headers: {
          "Content-Type": backendResponse.headers.get("content-type") || "application/octet-stream",
          "Content-Disposition": backendResponse.headers.get("content-disposition") || "attachment",
          "Content-Length": backendResponse.headers.get("content-length") || "",
        },
      });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error) {
    console.error(`Proxy error for ${targetUrl}:`, error);
    return NextResponse.json(
      { detail: "Backend service unavailable", error_type: "network" },
      { status: 502 }
    );
  }
}

