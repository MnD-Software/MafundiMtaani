"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, LoaderCircle, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { nairobiEstates } from "@/lib/data";

const steps = ["The job", "Location & timing", "Budget & contact"];

export function JobForm() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [reference, setReference] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [form, setForm] = useState({ trade: "Plumbing", title: "", description: "", area: "Kilimani", urgency: "today", budgetMin: "", budgetMax: "", name: "", phone: "" });
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submitJob = async () => {
    setSending(true); setError("");
    try {
      const response = await fetch("/api/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: form.name, client_phone: form.phone, trade: form.trade, title: form.title, description: form.description, area: form.area, urgency: form.urgency === "week" ? "this_week" : form.urgency, budget_min: Number(form.budgetMin || 0), budget_max: Number(form.budgetMax || 0) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "We could not post the job.");
      setReference(data.reference); setSubmitted(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The service is temporarily unavailable."); }
    finally { setSending(false); }
  };
  if (submitted) return <div className="job-shell"><div className="success-card"><span><CheckCircle2 size={36} /></span><p className="kicker">Request {reference} created</p><h1>Your job is on its way.</h1><p>Verified {form.trade.toLowerCase()} professionals near {form.area} can now review your request. Updates will appear in your job room.</p><Link className="button button-dark" href="/dashboard">Track my request <ArrowRight size={17} /></Link></div></div>;

  return <main className="job-shell">
    <div className="job-layout">
      <div className="job-aside"><Link href="/"><ArrowLeft size={17} /> Back home</Link><span className="kicker">Post a job</span><h1>What needs doing?</h1><p>Tell us about the work. We&apos;ll match you with skilled, verified artisans nearby.</p><div className="job-assurance"><ShieldCheck size={22} /><div><strong>Your job is protected</strong><span>Verified professionals, clear quotes, and our satisfaction guarantee.</span></div></div></div>
      <form className="job-form" onSubmit={(e) => { e.preventDefault(); if (step < 2) setStep(step + 1); else void submitJob(); }}>
        <div className="progress">{steps.map((name, index) => <div className={index <= step ? "current" : ""} key={name}><span>{index + 1}</span><small>{name}</small></div>)}</div>
        {step === 0 && <div className="form-panel"><h2>Describe the work</h2><label>Service needed<select value={form.trade} onChange={(e) => update("trade", e.target.value)}><option>Plumbing</option><option>Electrical</option><option>Carpentry</option><option>Painting</option><option>Appliance repair</option><option>Cleaning</option></select></label><label>Job title<input required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Fix a leaking kitchen tap" /></label><label>Tell us more<textarea required value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="What happened? Include any useful measurements or details." rows={5} /></label><label className="upload-box"><ImagePlus size={23} /><span><strong>{files.length ? `${files.length} photo${files.length > 1 ? "s" : ""} added` : "Add photos"}</strong><small>{files.length ? files.join(", ") : "Help artisans quote accurately"}</small></span><input type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).map((file) => file.name))} /></label></div>}
        {step === 1 && <div className="form-panel"><h2>Where and when?</h2><label>Estate or neighbourhood<div className="input-icon"><MapPin size={18} /><select value={form.area} onChange={(e) => update("area", e.target.value)}>{nairobiEstates.map((estate) => <option key={estate}>{estate}</option>)}</select></div></label><label>When do you need help?<div className="choice-grid">{[["today","Today"],["week","This week"],["scheduled","Choose a date"]].map(([value, label]) => <button type="button" className={form.urgency === value ? "selected" : ""} onClick={() => update("urgency", value)} key={value}>{label}</button>)}</div></label></div>}
        {step === 2 && <div className="form-panel"><h2>Budget and contact</h2><div className="field-row"><label>Minimum budget<input type="number" value={form.budgetMin} onChange={(e) => update("budgetMin", e.target.value)} placeholder="KSh 1,000" /></label><label>Maximum budget<input type="number" value={form.budgetMax} onChange={(e) => update("budgetMax", e.target.value)} placeholder="KSh 5,000" /></label></div><label>Your name<input required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Full name" /></label><label>Mobile number<input required value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+254 7..." /></label><div className="summary-box"><strong>{form.title || `${form.trade} job`} · {form.area}</strong><span>{form.urgency === "today" ? "Needed today" : "Flexible timing"} · Quotes are free</span></div></div>}
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">{step > 0 ? <button type="button" className="button button-quiet" onClick={() => setStep(step - 1)}>Back</button> : <span />}<button disabled={sending} className="button button-dark">{sending ? <><LoaderCircle className="spin" size={17} /> Posting securely</> : <>{step === 2 ? "Post job" : "Continue"} <ArrowRight size={17} /></>}</button></div>
      </form>
    </div>
  </main>;
}
