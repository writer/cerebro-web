import { NextRequest, NextResponse } from "next/server";

import { currentUserFromHeaders } from "@/lib/current-user";

export async function GET(request: NextRequest) {
  const user = currentUserFromHeaders(request.headers);
  return NextResponse.json(
    {
      authenticated: Boolean(user),
      user,
    },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  );
}
