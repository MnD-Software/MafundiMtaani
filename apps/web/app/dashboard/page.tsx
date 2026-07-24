import { DashboardClient } from "@/components/dashboard-client";
export default async function DashboardPage({ searchParams }:{searchParams:Promise<{section?:string}>}) { return <DashboardClient initialSection={(await searchParams).section}/>; }
