import { cookies } from "next/headers";
import { MobileNavClient } from "./mobile-nav-client";

export async function MobileNav(){
  const role=(await cookies()).get("mafundi_role")?.value || null;
  return <MobileNavClient role={role}/>;
}
