"use client";

import Link from "next/link";
import { BriefcaseBusiness, Compass, LayoutDashboard, Map, Plus, Search, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const publicItems = [
  { href: "/", label: "Explore", icon: Compass, primary: false },
  { href: "/#services", label: "Search", icon: Search, primary: false },
  { href: "/post-job", label: "Post", icon: Plus, primary: true },
  { href: "/map", label: "Map", icon: Map, primary: false },
];

export function MobileNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => { void fetch("/api/auth/me").then((response) => response.json()).then((data) => setRole(data.user?.role || null)); }, []);
  const accountItem = role === "artisan"
    ? { href:"/dashboard",label:"Jobs",icon:BriefcaseBusiness,primary:false }
    : ["admin","support"].includes(role || "")
      ? { href:"/admin",label:"Ops",icon:LayoutDashboard,primary:false }
      : role
        ? { href:"/dashboard",label:"Account",icon:UserRound,primary:false }
        : { href:"/login",label:"Sign in",icon:UserRound,primary:false };
  const items = [...publicItems, accountItem];
  const isActive = (href: string) => pathname === href || (href === "/" && pathname.startsWith("/artisan/"));
  return <nav className="mobile-app-nav" aria-label="Mobile navigation">
    {items.map(({ href, label, icon: Icon, primary }) => <Link className={`${isActive(href) ? "active" : ""} ${primary ? "primary" : ""}`} href={href} key={href}><span><Icon size={19} /></span><small>{label}</small></Link>)}
  </nav>;
}
