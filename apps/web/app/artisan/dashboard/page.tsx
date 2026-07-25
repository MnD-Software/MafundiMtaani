import {DashboardClient} from "@/components/dashboard-client";
import {requireSession} from "@/lib/server-auth";
export default async function ArtisanDashboard({searchParams}:{searchParams:Promise<{section?:string}>}){await requireSession(["artisan"],"/artisan/login");return <DashboardClient initialSection={(await searchParams).section}/>}
