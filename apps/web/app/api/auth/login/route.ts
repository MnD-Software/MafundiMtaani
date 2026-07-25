import { NextResponse } from "next/server";

const apiUrl = process.env.API_URL || "http://127.0.0.1:8010";

export async function POST(request: Request) {
  const submitted=await request.json();const expectedRole=submitted.expected_role;delete submitted.expected_role;
  const response = await fetch(`${apiUrl}/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(submitted), cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) return NextResponse.json(payload, { status: response.status });
  const allowed:Record<string,string[]|undefined>={client:["client","estate_manager"],artisan:["artisan"],operations:["admin","support"]};
  if(expectedRole&&(!allowed[expectedRole]||!allowed[expectedRole]!.includes(payload.user.role)))return NextResponse.json({detail:`Use the ${payload.user.role==="artisan"?"artisan":(["admin","support"].includes(payload.user.role)?"operations":"client")} sign-in portal for this account.`},{status:403});
  const result = NextResponse.json({ user: payload.user });
  const secure = process.env.VERCEL_ENV === "production";
  result.cookies.set("mafundi_session", payload.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 3600 });
  result.cookies.set("mafundi_role", payload.user.role, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 3600 });
  return result;
}
