import { NextResponse } from "next/server";
const apiUrl=process.env.API_URL||"http://127.0.0.1:8010";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;const response=await fetch(`${apiUrl}/v1/public-files/${encodeURIComponent(id)}`,{cache:"force-cache"});
  return new NextResponse(await response.arrayBuffer(),{status:response.status,headers:{"Content-Type":response.headers.get("content-type")||"application/octet-stream","Cache-Control":"public, max-age=86400"}});
}
