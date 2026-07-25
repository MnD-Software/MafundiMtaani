import { AdminDashboard } from "@/components/admin-dashboard";
import { requireSession } from "@/lib/server-auth";
export default async function AdminPage({ searchParams }:{searchParams:Promise<{section?:string}>}) { await requireSession(["admin","support"],"/operations/login");return <AdminDashboard initialSection={(await searchParams).section}/>; }
