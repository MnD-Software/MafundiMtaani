import { AdminDashboard } from "@/components/admin-dashboard";
export default async function AdminPage({ searchParams }:{searchParams:Promise<{section?:string}>}) { return <AdminDashboard initialSection={(await searchParams).section}/>; }
