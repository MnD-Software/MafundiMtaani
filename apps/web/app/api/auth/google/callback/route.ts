import {cookies} from "next/headers";
import {NextResponse} from "next/server";

const apiUrl=process.env.API_URL||"http://127.0.0.1:8010";
export async function GET(request:Request){
  const url=new URL(request.url);const code=url.searchParams.get("code");const state=url.searchParams.get("state");
  const expected=(await cookies()).get("mafundi_google_state")?.value;
  if(!code||!state||state!==expected)return NextResponse.redirect(new URL("/login?error=google_state",request.url));
  const redirectUri=process.env.GOOGLE_REDIRECT_URI||`${url.origin}/api/auth/google/callback`;
  const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID||"",client_secret:process.env.GOOGLE_CLIENT_SECRET||"",redirect_uri:redirectUri,grant_type:"authorization_code"})});
  if(!tokenResponse.ok)return NextResponse.redirect(new URL("/login?error=google_exchange",request.url));
  const tokens=await tokenResponse.json();
  const authResponse=await fetch(`${apiUrl}/v1/auth/google`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id_token:tokens.id_token})});
  if(!authResponse.ok)return NextResponse.redirect(new URL("/login?error=google_account",request.url));
  const payload=await authResponse.json();const response=NextResponse.redirect(new URL("/client/dashboard",request.url));const month=60*60*24*30;const secure=process.env.VERCEL_ENV==="production";
  response.cookies.set("mafundi_session",payload.access_token,{httpOnly:true,secure,sameSite:"lax",path:"/",maxAge:month});
  response.cookies.set("mafundi_role",payload.user.role,{httpOnly:true,secure,sameSite:"lax",path:"/",maxAge:month});
  response.cookies.delete("mafundi_google_state");return response;
}
