import {NextResponse} from "next/server";
import {randomBytes} from "crypto";

export async function GET(request:Request){
  const clientId=process.env.GOOGLE_CLIENT_ID;
  if(!clientId)return NextResponse.redirect(new URL("/login?error=google_not_configured",request.url));
  const state=randomBytes(24).toString("hex");
  const redirectUri=process.env.GOOGLE_REDIRECT_URI||`${new URL(request.url).origin}/api/auth/google/callback`;
  const target=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  target.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:"code",scope:"openid email profile",state,prompt:"select_account"}).toString();
  const response=NextResponse.redirect(target);
  response.cookies.set("mafundi_google_state",state,{httpOnly:true,secure:process.env.VERCEL_ENV==="production",sameSite:"lax",path:"/",maxAge:600});
  return response;
}
