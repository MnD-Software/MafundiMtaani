import { NextResponse } from "next/server";
const apiUrl = process.env.API_URL || "http://127.0.0.1:8010";
export async function GET(request: Request) {
  const source = new URL(request.url);
  const response = await fetch(`${apiUrl}/v1/location/reverse?${source.searchParams}`, { cache:"no-store" });
  return NextResponse.json(await response.json(), { status:response.status });
}
