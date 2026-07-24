"use client";

import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, CalendarClock, Compass, LayoutDashboard, Map, Plus, Search, ShieldCheck, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useExperience } from "./experience-provider";

type NavItem={href:string;label:string;icon:typeof Compass;primary:boolean};
const common={explore:{href:"/",label:"Explore",icon:Compass,primary:false},map:{href:"/map",label:"Map",icon:Map,primary:false}} as const;

export function MobileNavClient({role}:{role:string|null}){
  const pathname=usePathname();const{language}=useExperience();const sw=language==="sw";
  const items:NavItem[]=role==="artisan"?[
    {...common.explore,label:sw?"Gundua":"Explore"},
    {href:"/dashboard?section=jobs",label:sw?"Kazi":"Jobs",icon:BriefcaseBusiness,primary:false},
    {href:"/dashboard",label:sw?"Fanya":"Work",icon:LayoutDashboard,primary:true},
    {href:"/dashboard?section=schedule",label:sw?"Ratiba":"Schedule",icon:CalendarClock,primary:false},
    {href:"/dashboard?section=profile",label:sw?"Wasifu":"Profile",icon:UserRound,primary:false},
  ]:["admin","support"].includes(role||"")?[
    {href:"/admin",label:"Overview",icon:LayoutDashboard,primary:false},
    {href:"/admin?section=artisans",label:"Approvals",icon:BadgeCheck,primary:false},
    {href:"/admin?section=jobs",label:"Operations",icon:ShieldCheck,primary:true},
    {href:"/admin?section=coverage",label:"Coverage",icon:Map,primary:false},
    {href:"/admin?section=finance",label:"Finance",icon:BriefcaseBusiness,primary:false},
  ]:role?[
    {...common.explore,label:sw?"Gundua":"Explore"},
    {href:"/#services",label:sw?"Tafuta":"Search",icon:Search,primary:false},
    {href:"/post-job",label:sw?"Weka":"Post",icon:Plus,primary:true},
    {href:"/dashboard?section=jobs",label:sw?"Kazi zangu":"My jobs",icon:BriefcaseBusiness,primary:false},
    {href:"/dashboard",label:sw?"Akaunti":"Account",icon:UserRound,primary:false},
  ]:[
    {...common.explore,label:sw?"Gundua":"Explore"},
    {href:"/#services",label:sw?"Tafuta":"Search",icon:Search,primary:false},
    {href:"/join",label:sw?"Jiunge":"Join",icon:Plus,primary:true},
    {...common.map,label:sw?"Ramani":"Map"},
    {href:"/login",label:sw?"Ingia":"Sign in",icon:UserRound,primary:false},
  ];
  const active=(href:string)=>pathname===href.split("?")[0].split("#")[0];
  return <nav className="mobile-app-nav" aria-label="Mobile navigation">{items.map(({href,label,icon:Icon,primary})=><Link className={`${active(href)?"active":""} ${primary?"primary":""}`} href={href} key={href}><span><Icon size={19}/></span><small>{label}</small></Link>)}</nav>;
}
