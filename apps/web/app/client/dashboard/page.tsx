import {DashboardClient} from "@/components/dashboard-client";
import {requireSession} from "@/lib/server-auth";
export default async function ClientDashboard({searchParams}:{searchParams:Promise<{section?:string}>}){await requireSession(["client","estate_manager"],"/client/login");return <DashboardClient initialSection={(await searchParams).section}/>}
