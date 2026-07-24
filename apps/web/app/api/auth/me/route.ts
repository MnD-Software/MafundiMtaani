import { cookies } from "next/headers";
import { NextResponse } from "next/server";
const apiUrl = process.env.API_URL || "http://127.0.0.1:8010";
export async function GET() {
  const token = (await cookies()).get("mafundi_session")?.value;
  if (!token) return NextResponse.json({ user: null }, { status: 200 });
  const response = await fetch(`${apiUrl}/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({ user: await response.json() });
}
