import { requireSession } from "@/lib/server-auth";
import {redirect} from "next/navigation";
export default async function DashboardPage({ searchParams }:{searchParams:Promise<{section?:string}>}) { const user=await requireSession(["client","estate_manager","artisan"],"/client/login");const section=(await searchParams).section;redirect(`${user.role==="artisan"?"/artisan/dashboard":"/client/dashboard"}${section?`?section=${encodeURIComponent(section)}`:""}`); }
