import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendOrigin(): string {
  return (
    process.env.INTERNAL_API_ORIGIN ||
    process.env.INTERNAL_API_BASE_URL?.replace(/\/api\/v1\/?$/, "") ||
    "http://127.0.0.1:8080"
  );
}

async function proxyToBackend(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await context.params;
  const subPath = path.join("/");
  const search = req.nextUrl.search || "";
  const targetUrl = `${backendOrigin()}/api/v1/${subPath}${search}`;

  const headers = new Headers();
  for (const key of [
    "content-type",
    "cookie",
    "authorization",
    "x-tenant-slug",
    "x-tenant-host",
    "x-forwarded-for",
    "x-forwarded-proto",
  ]) {
    const val = req.headers.get(key);
    if (val) headers.set(key, val);
  }
  if (!headers.has("x-tenant-host") && req.headers.get("host")) {
    headers.set("x-tenant-host", req.headers.get("host")!);
  }

  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });

    const respHeaders = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) respHeaders.set("content-type", ct);
    const cd = upstream.headers.get("content-disposition");
    if (cd) respHeaders.set("content-disposition", cd);

    const setCookies =
      typeof upstream.headers.getSetCookie === "function"
        ? upstream.headers.getSetCookie()
        : [];
    for (const sc of setCookies) {
      respHeaders.append("set-cookie", sc);
    }

    const respBody = await upstream.arrayBuffer();
    return new NextResponse(respBody, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Layanan backend SIDECI sedang tidak dapat dijangkau." },
      { status: 502 }
    );
  }
}

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PUT = proxyToBackend;
export const PATCH = proxyToBackend;
export const DELETE = proxyToBackend;
