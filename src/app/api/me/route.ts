import { NextRequest, NextResponse } from "next/server";

import { currentUserFromHeadersWithFallback } from "@/lib/current-user";

export async function GET(request: NextRequest) {
  const user = currentUserFromHeadersWithFallback(request.headers);
  const fallback = user?.source === "local-fallback";
  return NextResponse.json(
    {
      authenticated: Boolean(user && !fallback),
      fallback,
      user,
    },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  );
}
