import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = path.join("/");
  const cleanPath = targetPath.startsWith("api/") ? targetPath.slice(4) : targetPath;
  const targetUrl = `${BACKEND_URL}/api/${cleanPath}`;

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
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "Content-Encoding": "none",
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
  const cleanPath = targetPath.startsWith("api/") ? targetPath.slice(4) : targetPath;
  const targetUrl = `${BACKEND_URL}/api/${cleanPath}`;

  try {
    const forwardHeaders: Record<string, string> = {
      "X-Forwarded-For": request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1",
    };
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      forwardHeaders["Range"] = rangeHeader;
    }

    const backendResponse = await fetch(targetUrl, {
      headers: forwardHeaders,
    });

    const contentType = backendResponse.headers.get("content-type") || "";
    const contentDisposition = backendResponse.headers.get("content-disposition");

    // For file downloads & video streaming
    if (contentDisposition || contentType.startsWith("video/") || contentType.startsWith("audio/") || cleanPath.startsWith("file/")) {
      const stream = backendResponse.body;
      const respHeaders = new Headers();

      let targetContentType = contentType || "video/mp4";
      if (cleanPath.endsWith(".mp4") && !targetContentType.startsWith("video/")) {
        targetContentType = "video/mp4";
      } else if (cleanPath.endsWith(".mp3") && !targetContentType.startsWith("audio/")) {
        targetContentType = "audio/mpeg";
      }
      respHeaders.set("Content-Type", targetContentType);

      if (contentDisposition) {
        respHeaders.set("Content-Disposition", contentDisposition);
      }
      const contentLength = backendResponse.headers.get("content-length");
      if (contentLength) {
        respHeaders.set("Content-Length", contentLength);
      }
      const acceptRanges = backendResponse.headers.get("accept-ranges");
      if (acceptRanges) {
        respHeaders.set("Accept-Ranges", acceptRanges);
      }
      const contentRange = backendResponse.headers.get("content-range");
      if (contentRange) {
        respHeaders.set("Content-Range", contentRange);
      }

      return new NextResponse(stream, {
        status: backendResponse.status,
        headers: respHeaders,
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

