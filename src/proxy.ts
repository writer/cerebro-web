import { NextRequest, NextResponse } from "next/server";

const MAX_API_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_GRC_UPLOAD_BODY_BYTES = 32 * 1024 * 1024; // 32 MB

const GRC_UPLOAD_PATHS = new Set([
  "/api/cerebro/grc/policy-lifecycle/uploads",
  "/api/cerebro/grc/vendors/uploads",
]);

export function proxy(request: NextRequest) {
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  if (isApiRoute && request.method !== "GET" && request.method !== "HEAD") {
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const bytes = Number.parseInt(contentLength, 10);
      const maxBytes = maxBodyBytesForRequest(request);
      if (Number.isFinite(bytes) && bytes > maxBytes) {
        return NextResponse.json(
          { error: bodyTooLargeMessage(maxBytes) },
          { status: 413 },
        );
      }
    }
  }

  return NextResponse.next();
}

function maxBodyBytesForRequest(request: NextRequest) {
  if (
    request.method === "POST" &&
    GRC_UPLOAD_PATHS.has(request.nextUrl.pathname) &&
    (request.headers.get("content-type") ?? "").toLowerCase().includes("multipart/form-data")
  ) {
    return MAX_GRC_UPLOAD_BODY_BYTES;
  }
  return MAX_API_BODY_BYTES;
}

function bodyTooLargeMessage(maxBytes: number) {
  if (maxBytes === MAX_GRC_UPLOAD_BODY_BYTES) {
    return "Upload is larger than 32 MB.";
  }
  return "Request body is larger than 2 MB.";
}

export const config = {
  matcher: ["/api/:path*"],
};
