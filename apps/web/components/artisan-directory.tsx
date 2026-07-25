"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, MapPin, MessageCircle, Search, Star } from "lucide-react";
import { nairobiEstates } from "@/lib/data";
import { useLiveLocation } from "./live-location-provider";

type Artisan = {
  id:string; name:string; avatar_url:string; trade:string; area:string;
  years_experience:number; rating:number; completed_jobs:number;
  available:boolean; verified:boolean; skills:string[];
};

export function ArtisanDirectory() {
  const live=useLiveLocation();
  const [items,setItems]=useState<Artisan[]>([]);
  const [query,setQuery]=useState("");
  const [area,setArea]=useState("");
  const [rating,setRating]=useState("0");
  const [experience,setExperience]=useState("0");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{if(live.state==="live"&&live.area)setArea(live.area)},[live.state,live.area]);
  useEffect(()=>{
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      const params=new URLSearchParams();
      if(query.trim())params.set("q",query.trim());
      if(area)params.set("area",area);
      if(Number(rating))params.set("min_rating",rating);
      if(Number(experience))params.set("min_experience",experience);
      try{
        const response=await fetch(`/api/artisans?${params}`,{signal:controller.signal});
        if(response.ok)setItems(await response.json());
      }finally{setLoading(false)}
    },250);
    return()=>{controller.abort();window.clearTimeout(timer)};
  },[query,area,rating,experience]);
  const ranked=useMemo(()=>items.map((item,index)=>({...item,rank:index+1})),[items]);
  return <main className="directory-shell">
    <section className="directory-hero">
      <span className="kicker">Verified Nairobi professionals</span>
      <h1>Choose the right artisan,<br/>with the proof in front of you.</h1>
      <p>Browse profiles freely. Rankings use verified stars, completed Mafundi projects, experience and current availability.</p>
      <div className="directory-filters">
        <label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Trade, name or skill"/></label>
        <label><MapPin/><select value={area} onChange={event=>setArea(event.target.value)}><option value="">All Nairobi areas</option>{nairobiEstates.map(item=><option key={item}>{item}</option>)}</select></label>
        <select aria-label="Minimum rating" value={rating} onChange={event=>setRating(event.target.value)}><option value="0">Any rating</option><option value="4">4+ stars</option><option value="4.5">4.5+ stars</option><option value="4.8">4.8+ stars</option></select>
        <select aria-label="Minimum experience" value={experience} onChange={event=>setExperience(event.target.value)}><option value="0">Any experience</option><option value="2">2+ years</option><option value="5">5+ years</option><option value="10">10+ years</option></select>
      </div>
      <button className={`directory-near-me ${live.state==="live"?"active":""}`} type="button" onClick={()=>{
        if(live.state==="live"&&live.area)setArea(live.area);else live.start();
      }}><MapPin/>{live.state==="live"?`Show artisans near ${live.area}`:live.state==="locating"?"Finding your live area…":"Use my live location"}</button>
    </section>
    <section className="directory-results">
      <div className="directory-result-head"><div><span className="kicker">Ranked matches</span><h2>{loading?"Checking live profiles…":`${ranked.length} professionals found`}</h2></div><small>Location · Stars · Projects · Experience</small></div>
      <div className="directory-grid">
        {ranked.map(item=><article className="directory-card" key={item.id}>
          <div className="directory-photo">{item.avatar_url?<img src={item.avatar_url} alt={`${item.name}, ${item.trade}`}/>:<span>{item.name.split(" ").map(part=>part[0]).join("").slice(0,2)}</span>}<b>#{item.rank} match</b>{item.available&&<em>Available</em>}</div>
          <div className="directory-card-body">
            <div><h3>{item.name}<BadgeCheck size={17}/></h3><p>{item.trade} · {item.area}</p></div>
            <div className="directory-proof"><span><Star fill="currentColor"/><strong>{item.rating||"New"}</strong><small>verified stars</small></span><span><BriefcaseBusiness/><strong>{item.completed_jobs}</strong><small>Mafundi projects</small></span><span><BadgeCheck/><strong>{item.years_experience}</strong><small>years experience</small></span></div>
            <div className="directory-actions"><Link className="button button-outline" href={`/artisan/${item.id}`}>View profile</Link><Link className="button button-dark" href={`/contact-artisan?id=${item.id}&name=${encodeURIComponent(item.name)}&trade=${encodeURIComponent(item.trade)}`}><MessageCircle/>Start chat</Link></div>
          </div>
        </article>)}
      </div>
      {!loading&&!ranked.length&&<div className="directory-empty"><h3>No exact match yet</h3><p>Remove one filter or browse another nearby Nairobi area.</p></div>}
    </section>
  </main>;
}
