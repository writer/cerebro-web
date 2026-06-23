import { NextRequest, NextResponse } from "next/server";

const MAX_API_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

export function proxy(request: NextRequest) {
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  if (isApiRoute && request.method !== "GET" && request.method !== "HEAD") {
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const bytes = Number.parseInt(contentLength, 10);
      if (Number.isFinite(bytes) && bytes > MAX_API_BODY_BYTES) {
        return NextResponse.json(
          { error: "Request body too large" },
          { status: 413 },
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
