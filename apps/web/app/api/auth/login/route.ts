import { NextResponse } from "next/server";

const apiUrl = process.env.API_URL || "http://127.0.0.1:8010";

export async function POST(request: Request) {
  const submitted=await request.json();const expectedRole=submitted.expected_role;delete submitted.expected_role;
  const response = await fetch(`${apiUrl}/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(submitted), cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) return NextResponse.json(payload, { status: response.status });
  const allowed:Record<string,string[]|undefined>={client:["client","estate_manager"],artisan:["artisan"],operations:["admin","support"]};
  if(expectedRole&&(!allowed[expectedRole]||!allowed[expectedRole]!.includes(payload.user.role)))return NextResponse.json({detail:"This account cannot use this sign-in page."},{status:403});
  const result = NextResponse.json({ user: payload.user });
  const secure = process.env.VERCEL_ENV === "production";
  const month=60*60*24*30;
  result.cookies.set("mafundi_session", payload.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: month });
  result.cookies.set("mafundi_role", payload.user.role, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: month });
  return result;
}
