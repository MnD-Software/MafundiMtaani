"use client";

import Link from "next/link";
import { HardHat, Navigation } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useExperience } from "./experience-provider";
import { useLiveLocation } from "./live-location-provider";

export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{name:string;role:string;avatar_url?:string}|null>(null);
  const role=user?.role||null;
  const {language}=useExperience();const sw=language==="sw";
  const live=useLiveLocation();
  useEffect(() => { void fetch("/api/auth/me").then((response) => response.json()).then((data) => setUser(data.user || null)); }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (pathname.includes("/dashboard") || pathname.startsWith("/admin")) return null;
  return <header className="site-header">
    <Link className="brand" href="/"><span className="brand-mark"><HardHat size={19} /></span><span>Mafundi Mtaani<span className="brand-dot">.</span></span></Link>
    <nav className={open ? "open" : ""} aria-label="Main navigation">
      <Link href="/#services" onClick={() => setOpen(false)}>{sw?"Huduma":"Services"}</Link>
      <Link href="/artisans" onClick={() => setOpen(false)}>{sw?"Tafuta fundi":"Find a fundi"}</Link>
      <Link href="/map" onClick={() => setOpen(false)}>{sw?"Ramani ya Nairobi":"Nairobi map"}</Link>
      {!role && <Link href="/join" onClick={() => setOpen(false)}>{sw?"Kuwa fundi":"Become an artisan"}</Link>}
      {role === "artisan" && <Link href="/artisan/dashboard" onClick={() => setOpen(false)}>{sw?"Kazi zangu":"My jobs"}</Link>}
      {["admin","support"].includes(role || "") && <Link href="/admin" onClick={() => setOpen(false)}>{sw?"Operesheni":"Operations"}</Link>}
    </nav>
    <button className={`header-live-location ${live.state==="live"?"active":""}`} type="button" onClick={live.start} aria-label="Use my live location">
      <Navigation size={15}/>
      <span>
        <small>{live.state==="live"?"Your live area":"Find artisans near"}</small>
        <strong>
          <span className="location-full">{live.state==="locating"?"Locating…":live.area||"Use my location"}</span>
          <span className="location-compact">{live.state==="locating"?"Locating…":live.state==="live"?(live.area||"Live area"):"Near me"}</span>
        </strong>
      </span>
    </button>
    <div className="header-actions">{!role ? <><Link className="text-action" href="/login">{sw?"Ingia":"Sign in"}</Link><Link className="text-action" href="/register">{sw?"Jisajili":"Sign up"}</Link></>:<Link className="header-account" href={role==="artisan"?"/artisan/dashboard":(["admin","support"].includes(role)?"/admin":"/client/dashboard")}>{user?.avatar_url?<img src={user.avatar_url} alt=""/>:<span>{user?.name?.split(" ").map(part=>part[0]).join("").slice(0,2)}</span>}<strong>{sw?"Akaunti":"Account"}</strong></Link>} {(!role||["client","estate_manager"].includes(role))&&<Link className="button button-dark button-small" href="/post-job">{sw?"Weka kazi":"Post a job"}</Link>}</div>
    <button className={`mobile-menu-button${open ? " open" : ""}`} onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}><span/><span/></button>
  </header>;
}
