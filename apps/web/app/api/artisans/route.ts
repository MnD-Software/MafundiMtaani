import { NextRequest, NextResponse } from "next/server";
const apiUrl = process.env.API_URL || "http://127.0.0.1:8010";
export async function GET(request: NextRequest) {
  const response = await fetch(`${apiUrl}/v1/artisans?${request.nextUrl.searchParams.toString()}`, { cache: "no-store" });
  return NextResponse.json(await response.json(), { status: response.status });
}
