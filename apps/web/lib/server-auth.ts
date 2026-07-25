import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const apiUrl=process.env.API_URL||"http://127.0.0.1:8010";
export type SessionUser={id:string;name:string;email:string;role:string};

export async function requireSession(roles:string[],loginPath:string):Promise<SessionUser>{
  const token=(await cookies()).get("mafundi_session")?.value;
  if(!token)redirect(loginPath);
  const response=await fetch(`${apiUrl}/v1/auth/me`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  if(!response.ok)redirect(loginPath);
  const user=await response.json() as SessionUser;
  if(!roles.includes(user.role)){
    redirect(user.role==="admin"||user.role==="support"?"/admin":user.role==="artisan"?"/dashboard":"/dashboard");
  }
  return user;
}
