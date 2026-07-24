import { cookies } from "next/headers";
import { NextResponse } from "next/server";
const apiUrl = process.env.API_URL || "http://127.0.0.1:8010";

async function authHeaders(): Promise<Record<string, string>> {
  const token = (await cookies()).get("mafundi_session")?.value;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}
export async function GET() {
  const response = await fetch(`${apiUrl}/v1/jobs`, { headers: await authHeaders(), cache: "no-store" });
  return NextResponse.json(await response.json(), { status: response.status });
}
export async function POST(request: Request) {
  const response = await fetch(`${apiUrl}/v1/jobs`, { method: "POST", headers: await authHeaders(), body: JSON.stringify(await request.json()), cache: "no-store" });
  return NextResponse.json(await response.json(), { status: response.status });
}
