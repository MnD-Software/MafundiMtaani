"use client";

import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, CalendarClock, Compass, LayoutDashboard, Map, Plus, Search, ShieldCheck, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {href:string;label:string;icon:typeof Compass;primary:boolean};
const common = { explore:{href:"/",label:"Explore",icon:Compass,primary:false}, map:{href:"/map",label:"Map",icon:Map,primary:false} } as const;

export function MobileNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => { void fetch("/api/auth/me").then((response) => response.json()).then((data) => setRole(data.user?.role || null)); }, []);
  const items:NavItem[] = role === "artisan" ? [
    common.explore,
    {href:"/dashboard?section=jobs",label:"Jobs",icon:BriefcaseBusiness,primary:false},
    {href:"/dashboard",label:"Work",icon:LayoutDashboard,primary:true},
    {href:"/dashboard?section=schedule",label:"Schedule",icon:CalendarClock,primary:false},
    {href:"/dashboard?section=profile",label:"Profile",icon:UserRound,primary:false},
  ] : ["admin","support"].includes(role || "") ? [
    {href:"/admin",label:"Overview",icon:LayoutDashboard,primary:false},
    {href:"/admin?section=artisans",label:"Approvals",icon:BadgeCheck,primary:false},
    {href:"/admin?section=jobs",label:"Operations",icon:ShieldCheck,primary:true},
    {href:"/admin?section=coverage",label:"Coverage",icon:Map,primary:false},
    {href:"/admin?section=finance",label:"Finance",icon:BriefcaseBusiness,primary:false},
  ] : role ? [
    common.explore,
    {href:"/#services",label:"Search",icon:Search,primary:false},
    {href:"/post-job",label:"Post",icon:Plus,primary:true},
    {href:"/dashboard?section=jobs",label:"My jobs",icon:BriefcaseBusiness,primary:false},
    {href:"/dashboard",label:"Account",icon:UserRound,primary:false},
  ] : [
    common.explore,
    {href:"/#services",label:"Search",icon:Search,primary:false},
    {href:"/join",label:"Join",icon:Plus,primary:true},
    common.map,
    {href:"/login",label:"Sign in",icon:UserRound,primary:false},
  ];
  const isActive = (href: string) => pathname === href.split("?")[0] || (href === "/" && pathname.startsWith("/artisan/"));
  return <nav className="mobile-app-nav" aria-label="Mobile navigation">
    {items.map(({ href, label, icon: Icon, primary }) => <Link className={`${isActive(href) ? "active" : ""} ${primary ? "primary" : ""}`} href={href} key={href}><span><Icon size={19} /></span><small>{label}</small></Link>)}
  </nav>;
}
