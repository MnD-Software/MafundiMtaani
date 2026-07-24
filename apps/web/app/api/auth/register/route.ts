import { NextResponse } from "next/server";

const apiUrl = process.env.API_URL || "http://127.0.0.1:8010";

export async function POST(request: Request) {
  const response = await fetch(`${apiUrl}/v1/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await request.json()), cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) return NextResponse.json(payload, { status: response.status });
  const result = NextResponse.json({ user: payload.user });
  const secure = process.env.VERCEL_ENV === "production";
  result.cookies.set("mafundi_session", payload.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 3600 });
  result.cookies.set("mafundi_role", payload.user.role, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 3600 });
  return result;
}
