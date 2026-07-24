"use client";

import Link from "next/link";
import { HardHat, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useExperience } from "./experience-provider";

export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const {language}=useExperience();const sw=language==="sw";
  useEffect(() => { void fetch("/api/auth/me").then((response) => response.json()).then((data) => setRole(data.user?.role || null)); }, []);
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) return null;
  return <header className="site-header">
    <Link className="brand" href="/"><span className="brand-mark"><HardHat size={19} /></span><span>Mafundi<span className="brand-dot">.</span></span></Link>
    <nav className={open ? "open" : ""} aria-label="Main navigation">
      <Link href="/#services" onClick={() => setOpen(false)}>{sw?"Huduma":"Services"}</Link>
      <Link href="/#artisans" onClick={() => setOpen(false)}>{sw?"Tafuta fundi":"Find a fundi"}</Link>
      <Link href="/map" onClick={() => setOpen(false)}>{sw?"Ramani ya Nairobi":"Nairobi map"}</Link>
      {!role && <Link href="/join" onClick={() => setOpen(false)}>{sw?"Kuwa fundi":"Become an artisan"}</Link>}
      {role === "artisan" && <Link href="/dashboard" onClick={() => setOpen(false)}>{sw?"Kazi zangu":"My jobs"}</Link>}
      {["admin","support"].includes(role || "") && <Link href="/admin" onClick={() => setOpen(false)}>{sw?"Operesheni":"Operations"}</Link>}
    </nav>
    <div className="header-actions">{!role && <><Link className="text-action" href="/login">{sw?"Ingia":"Sign in"}</Link><Link className="text-action" href="/register">{sw?"Jisajili":"Sign up"}</Link></>}<Link className="button button-dark button-small" href="/post-job">{sw?"Weka kazi":"Post a job"}</Link></div>
    <button className="mobile-menu-button" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X /> : <Menu />}</button>
  </header>;
}
