"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, Heart, MapPin, MessageCircle, RotateCcw, Search, Star, X } from "lucide-react";
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
  const [favorites,setFavorites]=useState<Set<string>>(new Set());
  const [recent,setRecent]=useState<Array<{query:string;area:string}>>([]);
  useEffect(()=>{
    try{setRecent(JSON.parse(localStorage.getItem("mafundi-recent-searches")||"[]"))}catch{setRecent([])}
    void fetch("/api/marketplace/favorites").then(async response=>{
      if(response.ok)setFavorites(new Set((await response.json()).map((row:{artisan:{id:string}})=>row.artisan.id)));
    });
  },[]);
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
  useEffect(()=>{
    if(!query.trim()&&!area)return;
    const timer=window.setTimeout(()=>{
      const entry={query:query.trim(),area};
      setRecent(current=>{
        const next=[entry,...current.filter(item=>item.query!==entry.query||item.area!==entry.area)].slice(0,5);
        localStorage.setItem("mafundi-recent-searches",JSON.stringify(next));return next;
      });
    },800);
    return()=>window.clearTimeout(timer);
  },[query,area]);
  const toggleFavorite=async(id:string)=>{
    const active=favorites.has(id);
    const response=await fetch(`/api/marketplace/favorites/${id}`,{method:active?"DELETE":"POST"});
    if(response.status===401){window.location.href="/client/login?next=/artisans";return}
    if(response.ok)setFavorites(current=>{const next=new Set(current);active?next.delete(id):next.add(id);return next});
  };
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
      {!!recent.length&&<div className="recent-searches"><span>Recent</span>{recent.map((item,index)=><button key={`${item.query}-${item.area}-${index}`} onClick={()=>{setQuery(item.query);setArea(item.area)}}>{item.query||"All services"}{item.area?` · ${item.area}`:""}<RotateCcw/></button>)}<button aria-label="Clear recent searches" onClick={()=>{setRecent([]);localStorage.removeItem("mafundi-recent-searches")}}><X/></button></div>}
    </section>
    <section className="directory-results">
      <div className="directory-result-head"><div><span className="kicker">Ranked matches</span><h2>{loading?"Checking live profiles…":`${ranked.length} professionals found`}</h2></div><small>Location · Stars · Projects · Experience</small></div>
      <div className="directory-grid">
        {ranked.map(item=><article className="directory-card" key={item.id}>
          <div className="directory-photo">{item.avatar_url?<img src={item.avatar_url} alt={`${item.name}, ${item.trade}`}/>:<span>{item.name.split(" ").map(part=>part[0]).join("").slice(0,2)}</span>}<b>#{item.rank} match</b>{item.available&&<em>Available</em>}<button className={`favorite-button ${favorites.has(item.id)?"active":""}`} aria-label={favorites.has(item.id)?`Remove ${item.name} from favourites`:`Save ${item.name} to favourites`} onClick={()=>void toggleFavorite(item.id)}><Heart fill={favorites.has(item.id)?"currentColor":"none"}/></button></div>
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
