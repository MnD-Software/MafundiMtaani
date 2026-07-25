"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";

export function ContactArtisan() {
  const params = useSearchParams();
  const name = params.get("name") || "the artisan";
  const trade = params.get("trade") || "professional";
  const artisanId = params.get("id") || "";
  const [sent, setSent] = useState(false);
  const [error,setError]=useState("");const[loading,setLoading]=useState(false);const[message,setMessage]=useState("");const[phone,setPhone]=useState("");
  if (sent) return <main className="contact-artisan-shell"><div className="success-card"><span><CheckCircle2 size={36} /></span><p className="kicker">Message sent</p><h1>{name} will reply in your job room.</h1><p>Your contact details remain private until you choose to book.</p><Link className="button button-dark" href="/dashboard">Open messages</Link></div></main>;
  return <main className="contact-artisan-shell"><Link className="back-link" href="/#artisans"><ArrowLeft size={17} /> Back to professionals</Link><div className="contact-card"><span className="identity-badge large">{name.split(" ").map((part) => part[0]).join("").slice(0,2)}</span><div className="contact-heading"><span className="kicker">Secure introduction</span><h1>Message {name}</h1><p>{trade} · Response times depend on live availability</p></div><form onSubmit={async event=>{event.preventDefault();setLoading(true);setError("");const response=await fetch("/api/marketplace/inquiries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({artisan_id:artisanId,message,phone})});if(response.ok)setSent(true);else setError((await response.json()).detail||"Message could not be sent.");setLoading(false)}}><label>What do you need help with?<textarea required rows={6} value={message} onChange={event=>setMessage(event.target.value)} placeholder="Describe the work, timing and anything the artisan should know." /></label><label>Your mobile number<input required value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+254 7..." /></label><div className="contact-assurance"><ShieldCheck size={18} /> Your number is stored securely with this introduction.</div>{error&&<p className="form-error">{error}</p>}<button disabled={loading||!artisanId} className="button button-dark button-wide"><MessageCircle size={17} />{loading?"Sending…":"Send secure message"}</button></form></div></main>;
}
