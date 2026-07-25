"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, CheckCircle2, Clock3, MapPin, MessageSquare, Send, ShieldAlert, Star } from "lucide-react";

type Quote = {id:string;artisan_name:string;artisan_rating:number;amount:number;message:string;eta_hours:number;status:string};
type Message = {id:string;sender_id:string;body:string;kind:string;created_at:string};
type Milestone = {id:string;title:string;amount:number;status:string};
type Room = {job:{id:string;reference:string;title:string;trade:string;area:string;status:string;assigned_artisan_id:string|null};quotes:Quote[];messages:Message[];milestones:Milestone[];dispute:null|{id:string;reason:string;status:string};viewer:{id:string;role:string};tracking:null|{latitude:number;longitude:number;accuracy_m:number;eta_minutes:number;recorded_at:string};evidence:{id:string;stage:string;file_url:string;caption:string;created_at:string}[];completion:null|{approved:boolean;note:string;approved_at:string|null}};

export function JobRoom({ jobId }:{jobId:string}) {
  const [room,setRoom] = useState<Room|null>(null);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [message,setMessage] = useState("");
  const [quote,setQuote] = useState({amount:"",message:"",eta_hours:"24"});
  const [milestone,setMilestone] = useState({title:"",amount:""});
  const refresh = async () => {
    const response = await fetch(`/api/marketplace/jobs/${jobId}/room`);
    if(response.ok) setRoom(await response.json()); else setError((await response.json()).detail || "Job room unavailable.");
  };
  useEffect(()=>{void refresh()},[jobId]);
  const act = async (url:string,method:string,body?:object) => {
    setError("");
    const response = await fetch(`/api/marketplace/${url}`,{method,headers:{"Content-Type":"application/json"},body:body ? JSON.stringify(body):undefined});
    if(!response.ok){setError((await response.json()).detail || "Action failed.");return false}
    setNotice("Saved successfully."); window.setTimeout(()=>setNotice(""),2200); await refresh(); return true;
  };
  if(!room) return <main className="room-shell"><Link href="/dashboard"><ArrowLeft size={16}/>Dashboard</Link><section className="room-loading">{error || "Opening protected job room…"}</section></main>;
  const artisan = room.viewer.role === "artisan";
  const client = ["client","estate_manager"].includes(room.viewer.role);
  return <main className="room-shell">
    <Link className="back-link" href="/dashboard"><ArrowLeft size={16}/>Dashboard</Link>
    <header className="room-header"><div><span className="kicker">{room.job.reference} · {room.job.trade}</span><h1>{room.job.title}</h1><p><MapPin size={15}/>{room.job.area}<span className={`room-status ${room.job.status}`}>{room.job.status.replaceAll("_"," ")}</span></p></div><div className="room-trust"><BadgeCheck/><span><strong>Protected job room</strong><small>Quotes, messages and payments stay attached to this job.</small></span></div></header>
    {notice && <div className="action-toast">{notice}</div>}{error && <p className="form-error">{error}</p>}
    <div className="room-grid">
      <section className="room-main">
        <article className="room-card"><div className="room-card-head"><div><span className="kicker">Compare offers</span><h2>Artisan quotes</h2></div><span>{room.quotes.length} received</span></div>
          {room.quotes.length ? <div className="quote-list">{room.quotes.map(item=><article key={item.id}><div><strong>{item.artisan_name}<BadgeCheck size={14}/></strong><span><Star size={12} fill="currentColor"/>{item.artisan_rating || "New"} · <Clock3 size={12}/>{item.eta_hours}h arrival</span></div><strong>KSh {item.amount.toLocaleString()}</strong><p>{item.message}</p>{client && item.status==="pending" && <button onClick={()=>void act(`quotes/${item.id}/accept`,"POST")} className="button button-dark">Accept quote</button>}<em className={item.status}>{item.status}</em></article>)}</div>:<Empty text="No artisan has quoted yet."/>}
          {artisan && ["open","matched"].includes(room.job.status) && <form className="inline-form" onSubmit={async e=>{e.preventDefault();if(await act("quotes","POST",{job_id:jobId,amount:Number(quote.amount),message:quote.message,eta_hours:Number(quote.eta_hours)}))setQuote({amount:"",message:"",eta_hours:"24"})}}><h3>Send a quote</h3><input required type="number" min="1" placeholder="Amount (KSh)" value={quote.amount} onChange={e=>setQuote({...quote,amount:e.target.value})}/><input required placeholder="What is included?" value={quote.message} onChange={e=>setQuote({...quote,message:e.target.value})}/><input required type="number" min="1" placeholder="Arrival hours" value={quote.eta_hours} onChange={e=>setQuote({...quote,eta_hours:e.target.value})}/><button className="button button-dark">Submit quote</button></form>}
        </article>
        <article className="room-card"><div className="room-card-head"><div><span className="kicker">Live job room</span><h2>Messages</h2></div><MessageSquare/></div><div className="message-thread">{room.messages.length?room.messages.map(item=><div className={item.sender_id===room.viewer.id?"mine":""} key={item.id}><strong>{item.sender_id===room.viewer.id?"You":"Job participant"}</strong><p>{item.body}</p><time>{new Date(item.created_at).toLocaleString()}</time></div>):<Empty text="The conversation starts here."/>}</div><form className="message-compose" onSubmit={async e=>{e.preventDefault();if(await act(`jobs/${jobId}/messages`,"POST",{body:message,kind:"text"}))setMessage("")}}><input required value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write a secure message…"/><button aria-label="Send"><Send size={18}/></button></form></article>
      </section>
      <aside className="room-aside">
        {room.tracking&&<section className="room-card"><span className="kicker">Live arrival</span><h2>{room.tracking.eta_minutes} min away</h2><p><MapPin size={14}/> Location updated {new Date(room.tracking.recorded_at).toLocaleTimeString()}</p><a className="button button-outline button-wide" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${room.tracking.latitude},${room.tracking.longitude}`}>View live position</a></section>}
        <section className="room-card"><span className="kicker">Work record</span><h2>Before & after evidence</h2>{room.evidence.length?room.evidence.map(item=><a className="evidence-row" href={item.file_url} target="_blank" rel="noreferrer" key={item.id}><strong>{item.stage}</strong><span>{item.caption||"View evidence"}</span></a>):<Empty text="No evidence added yet."/>}<button onClick={()=>{const file_url=window.prompt("Paste the secure photo or file URL");if(file_url){const caption=window.prompt("Add a short caption")||"";void act(`jobs/${jobId}/evidence`,"POST",{stage:artisan?"after":"before",file_url,caption})}}}>Add evidence</button></section>
        {artisan&&["assigned","in_progress"].includes(room.job.status)&&<button className="button button-outline button-wide" onClick={()=>navigator.geolocation.getCurrentPosition(position=>{const eta=Number(window.prompt("Estimated arrival in minutes","10")||10);void act(`jobs/${jobId}/tracking`,"POST",{latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy_m:position.coords.accuracy,eta_minutes:eta})},()=>setError("Location permission is required."))}>Share live location & ETA</button>}
        <section className="room-card"><span className="kicker">FairPay plan</span><h2>Milestones</h2>{room.milestones.length?room.milestones.map(item=><div className="milestone" key={item.id}><CheckCircle2/><span><strong>{item.title}</strong><small>{item.status}</small></span><b>KSh {item.amount.toLocaleString()}</b></div>):<Empty text="No milestones proposed."/>}{artisan && room.job.assigned_artisan_id && <form className="milestone-form" onSubmit={async e=>{e.preventDefault();if(await act(`jobs/${jobId}/milestones`,"POST",{title:milestone.title,amount:Number(milestone.amount)}))setMilestone({title:"",amount:""})}}><input required value={milestone.title} onChange={e=>setMilestone({...milestone,title:e.target.value})} placeholder="Milestone title"/><input required type="number" min="0" value={milestone.amount} onChange={e=>setMilestone({...milestone,amount:e.target.value})} placeholder="Amount"/><button>Propose milestone</button></form>}</section>
        {artisan && room.job.status==="assigned" && <button onClick={()=>void act(`jobs/${jobId}/status?next_status=in_progress`,"PATCH")} className="button button-dark button-wide">Mark work started</button>}
        {artisan && room.job.status==="in_progress" && <button onClick={()=>void act(`jobs/${jobId}/status?next_status=completed`,"PATCH")} className="button button-dark button-wide">Mark job complete</button>}
        {client&&room.job.assigned_artisan_id&&["assigned","in_progress"].includes(room.job.status)&&<PaymentPanel jobId={jobId}/>}
        {client&&room.job.status==="completed"&&!room.completion?.approved&&<section className="room-card"><span className="kicker">Client inspection</span><h2>Approve completed work</h2><button className="button button-dark button-wide" onClick={()=>void act(`jobs/${jobId}/completion-approval`,"POST",{approved:true,note:"Work inspected and approved"})}>Approve completion</button></section>}
        {client&&room.job.status==="completed"&&<section className="room-card"><span className="kicker">90-day cover</span><h2>Workmanship warranty</h2><button onClick={()=>{const details=window.prompt("Describe what needs a follow-up inspection");if(details)void act(`jobs/${jobId}/warranty-claims`,"POST",{reason:"Workmanship follow-up",details})}}>Open warranty claim</button></section>}
        {client && room.job.status==="completed" && <ReviewForm act={act} jobId={jobId}/>}
        <section className="room-card safety-card"><ShieldAlert/><div><strong>Need support?</strong><p>Open a dispute and keep all job evidence together.</p></div>{room.dispute?<span>{room.dispute.status}</span>:<button onClick={()=>{const details=window.prompt("Describe the issue in detail");if(details)void act(`jobs/${jobId}/disputes`,"POST",{reason:"Job issue",details,evidence:[]})}}>Open dispute</button>}</section>
      </aside>
    </div>
  </main>
}

function ReviewForm({act,jobId}:{act:(url:string,method:string,body?:object)=>Promise<boolean>;jobId:string}){const[rating,setRating]=useState(5);const[comment,setComment]=useState("");return <form className="room-card review-form" onSubmit={e=>{e.preventDefault();void act(`jobs/${jobId}/reviews`,"POST",{rating,comment})}}><span className="kicker">Verified review</span><h2>Rate completed work</h2><select value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} stars</option>)}</select><textarea required value={comment} onChange={e=>setComment(e.target.value)} placeholder="How did the work go?"/><button className="button button-dark">Publish review</button></form>}
function PaymentPanel({jobId}:{jobId:string}){const[form,setForm]=useState({phone:"",amount:"",promotion_code:""});const[notice,setNotice]=useState("");const pay=async()=>{const response=await fetch("/api/marketplace/payments/mpesa/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({job_id:jobId,phone:form.phone,amount:Number(form.amount),promotion_code:form.promotion_code})});const data=await response.json();setNotice(response.ok?data.message:data.detail||"Payment could not start.")};return <section className="room-card payment-panel"><span className="kicker">Protected payment</span><h2>Fund with M-Pesa</h2><p>Like a ride payment, your selected method stays attached to this job and the provider confirms every transaction.</p><input value={form.phone} onChange={event=>setForm({...form,phone:event.target.value})} placeholder="M-Pesa phone"/><input type="number" min="1" value={form.amount} onChange={event=>setForm({...form,amount:event.target.value})} placeholder="Amount (KSh)"/><input value={form.promotion_code} onChange={event=>setForm({...form,promotion_code:event.target.value.toUpperCase()})} placeholder="Offer code (optional)"/><button onClick={()=>void pay()} className="button button-dark">Send M-Pesa prompt</button>{notice&&<small>{notice}</small>}</section>}
function Empty({text}:{text:string}){return <div className="room-empty">{text}</div>}
