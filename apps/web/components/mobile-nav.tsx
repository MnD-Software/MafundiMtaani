"use client";

import Link from "next/link";
import { BriefcaseBusiness, Compass, LayoutDashboard, Map, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const publicItems = [
  { href: "/", label: "Explore", icon: Compass },
  { href: "/map", label: "Map", icon: Map },
  { href: "/post-job", label: "Post", icon: Plus, primary: true },
];

export function MobileNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => { void fetch("/api/auth/me").then((response) => response.json()).then((data) => setRole(data.user?.role || null)); }, []);
  const items = [...publicItems, ...(role === "artisan" ? [{ href:"/dashboard",label:"Jobs",icon:BriefcaseBusiness }] : []), ...(["admin","support"].includes(role || "") ? [{ href:"/admin",label:"Ops",icon:LayoutDashboard }] : []), ...(!role ? [{ href:"/login",label:"Sign in",icon:LayoutDashboard }] : [])];
  const isActive = (href: string) => pathname === href || (href === "/" && pathname.startsWith("/artisan/"));
  return <nav className="mobile-app-nav" aria-label="Mobile navigation">
    {items.map(({ href, label, icon: Icon, primary }) => <Link className={`${isActive(href) ? "active" : ""} ${primary ? "primary" : ""}`} href={href} key={href}><span><Icon size={19} /></span><small>{label}</small></Link>)}
  </nav>;
}
