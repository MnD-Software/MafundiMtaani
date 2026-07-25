import { NextResponse } from "next/server";
const apiUrl=process.env.API_URL||"http://127.0.0.1:8010";
export async function GET(){const response=await fetch(`${apiUrl}/v1/campaigns/active`,{cache:"no-store"});return NextResponse.json(await response.json(),{status:response.status})}
