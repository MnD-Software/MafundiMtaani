"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowRight,X} from "lucide-react";
type Campaign={slug:string;name:string;headline:string;message:string;theme:string;offer_code:string};
export function SeasonalCampaign(){
  const[campaign,setCampaign]=useState<Campaign|null>(null);const[slide,setSlide]=useState(0);const[hidden,setHidden]=useState(false);
  useEffect(()=>{void fetch("/api/campaign").then(r=>r.ok?r.json():null).then(data=>{if(data){setCampaign(data);document.documentElement.dataset.campaign=data.theme}})},[]);
  useEffect(()=>{if(!campaign)return;const timer=window.setInterval(()=>setSlide(value=>(value+1)%3),5500);return()=>window.clearInterval(timer)},[campaign]);
  if(!campaign||hidden)return null;
  const slides=[{title:campaign.headline,text:campaign.message},{title:"Thank you, Nairobi.",text:"Every completed job strengthens a local business and a neighbourhood."},{title:"Celebrate skilled work.",text:"Transparent quotes, protected milestones and verified reviews—every time."}];
  return <aside className={`seasonal-campaign theme-${campaign.theme}`} role="region" aria-label={`${campaign.name} campaign`}><div><small>{campaign.name}</small><strong>{slides[slide].title}</strong><span>{slides[slide].text}</span></div><Link href="/post-job">{campaign.offer_code?`Use ${campaign.offer_code}`:"Find trusted help"}<ArrowRight size={14}/></Link><div className="campaign-dots">{slides.map((_,index)=><button key={index} className={slide===index?"active":""} onClick={()=>setSlide(index)} aria-label={`Show campaign message ${index+1}`}/>)}</div><button className="campaign-close" onClick={()=>setHidden(true)} aria-label="Close campaign"><X size={14}/></button></aside>
}
