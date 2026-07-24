import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const apiUrl = process.env.API_URL || "http://127.0.0.1:8010";

async function forward(request: Request, context: { params: Promise<{ path:string[] }> }) {
  const token = (await cookies()).get("mafundi_session")?.value;
  if (!token) return NextResponse.json({ detail:"Authentication required" }, { status:401 });
  const { path } = await context.params;
  const source = new URL(request.url);
  const target = `${apiUrl}/v1/${path.map(encodeURIComponent).join("/")}${source.search}`;
  const body = ["GET","HEAD"].includes(request.method) ? undefined : await request.text();
  const response = await fetch(target, {
    method:request.method,
    headers:{ Authorization:`Bearer ${token}`, ...(body ? {"Content-Type":request.headers.get("content-type") || "application/json"} : {}) },
    body,
    cache:"no-store",
  });
  const text = await response.text();
  return new NextResponse(text, { status:response.status, headers:{"Content-Type":response.headers.get("content-type") || "application/json"} });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
