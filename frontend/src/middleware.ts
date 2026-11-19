import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CUSTOM_DOMAIN_MAP: Record<string, string> = {
  "ringdikit.desa.id": "ringdikit",
};

const RESERVED_SEGMENTS = new Set([
  "api",
  "login",
  "panel",
  "verify",
  "privacy-policy",
  "health",
  "images",
  "_next",
]);

export function middleware(request: NextRequest) {
  const existingSlug = request.headers.get("x-tenant-slug")?.trim();
  if (existingSlug) {
    return NextResponse.next();
  }

  const rawHost = (request.headers.get("host") || "")
    .toLowerCase()
    .split(":")[0];
  let tenantSlug =
    process.env.NEXT_PUBLIC_DEFAULT_VILLAGE_SLUG?.toLowerCase() || "ringdikit";

  const firstSeg = request.nextUrl.pathname.split("/").filter(Boolean)[0];
  if (firstSeg && !RESERVED_SEGMENTS.has(firstSeg.toLowerCase())) {
    tenantSlug = firstSeg.toLowerCase();
  } else if (CUSTOM_DOMAIN_MAP[rawHost]) {
    tenantSlug = CUSTOM_DOMAIN_MAP[rawHost];
  } else if (
    rawHost &&
    rawHost !== "localhost" &&
    !/^\d+\.\d+\.\d+\.\d+$/.test(rawHost) &&
    rawHost.includes(".")
  ) {
    const sub = rawHost.split(".")[0];
    if (sub && sub !== "www" && sub !== "sideci" && sub !== "staging-sideci") {
      tenantSlug = sub;
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-slug", tenantSlug);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
