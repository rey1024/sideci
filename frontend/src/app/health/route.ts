import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const origin =
    process.env.INTERNAL_API_ORIGIN ||
    process.env.INTERNAL_API_BASE_URL?.replace(/\/api\/v1\/?$/, "") ||
    "http://127.0.0.1:8080";
  try {
    const res = await fetch(`${origin}/health`, { cache: "no-store" });
    const backend = await res.json();
    return NextResponse.json(
      { status: res.ok ? "ok" : "degraded", frontend: "ok", backend },
      { status: res.ok ? 200 : 503 }
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", frontend: "ok", backend: "unreachable" },
      { status: 503 }
    );
  }
}
