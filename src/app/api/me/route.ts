import { NextRequest, NextResponse } from "next/server";

import { currentUserAuditFields, currentUserFromHeadersWithFallback } from "@/lib/identity";

export async function GET(request: NextRequest) {
  const user = currentUserFromHeadersWithFallback(request.headers);
  const fallback = user?.source === "local-fallback";
  if (user?.conflicts?.length || user?.warnings?.length || user?.confidence === "unverified") {
    console.warn("current-user identity attention", currentUserAuditFields(user));
  }
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
