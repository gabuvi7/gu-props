import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // Future auth route protection belongs here, not middleware.ts.
  // Tenant resolution by host/subdomain will also start here before hitting App Router pages.
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/dashboard/:path*", "/owners/:path*", "/renters/:path*", "/properties/:path*", "/contracts/:path*", "/payments/:path*"]
};
