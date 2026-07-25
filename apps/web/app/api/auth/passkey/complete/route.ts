import { NextResponse } from "next/server";
const apiUrl = process.env.API_URL || "http://127.0.0.1:8010";
export async function POST(request: Request) {
  const response = await fetch(`${apiUrl}/v1/auth/passkeys/login/complete`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": request.headers.get("user-agent") || "" }, body: await request.text(), cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) return NextResponse.json(payload, { status: response.status });
  const result = NextResponse.json({ user: payload.user });
  const secure = process.env.VERCEL_ENV === "production"; const month = 60 * 60 * 24 * 30;
  result.cookies.set("mafundi_session", payload.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: month });
  result.cookies.set("mafundi_role", payload.user.role, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: month });
  return result;
}
