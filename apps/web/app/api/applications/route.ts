import { cookies } from "next/headers";
import { NextResponse } from "next/server";
const apiUrl = process.env.API_URL || "http://127.0.0.1:8010";
export async function POST(request: Request) {
  const token = (await cookies()).get("mafundi_session")?.value;
  if (!token) return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  const response = await fetch(`${apiUrl}/v1/applications`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(await request.json()), cache: "no-store" });
  return NextResponse.json(await response.json(), { status: response.status });
}
