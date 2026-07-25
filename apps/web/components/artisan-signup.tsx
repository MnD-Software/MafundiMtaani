"use client";

import { useState } from "react";
import { ArrowRight, BadgeCheck, CheckCircle2, FileUp, ShieldCheck } from "lucide-react";
import { nairobiEstates } from "@/lib/data";
import Link from "next/link";

const evidence = ["National ID · front and back", "Trade certificate or portfolio", "Police clearance certificate", "Two client or employer references"];

export function ArtisanSignup() {
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<Record<string, File>>({});
  const [form, setForm] = useState({ name: "", email: "", password: "", trade: "Plumbing", years: "", area: "Kilimani", phone: "" });
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setSending(true); setError("");
    try {
      const account = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email, password: form.password, name: form.name, phone: form.phone, account_type: "artisan" }) });
      const accountData = await account.json();
      if (!account.ok) throw new Error(accountData.detail || "Account could not be created.");
      const uploaded: string[] = [];
      for (const [label, file] of Object.entries(documents)) {
        const payload = new FormData(); payload.set("file", file); payload.set("category", "artisan_verification");
        const upload = await fetch("/api/marketplace/uploads", { method: "POST", body: payload });
        const uploadData = await upload.json();
        if (!upload.ok) throw new Error(uploadData.detail || `${label} could not be uploaded.`);
        uploaded.push(uploadData.url);
      }
      const response = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, phone: form.phone, trade: form.trade, area: form.area, years_experience: Number(form.years), documents: uploaded }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Application could not be sent.");
      setDone(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The service is unavailable."); }
    finally { setSending(false); }
  };

  if (done) return <main className="signup-shell"><div className="success-card"><span><CheckCircle2 size={36} /></span><p className="kicker">Application received</p><h1>We&apos;re verifying your details.</h1><p>You can track each check from your dashboard after approval. Most applications are reviewed in under 24 hours.</p><Link className="button button-dark" href="/">Return to marketplace</Link></div></main>;

  return <main className="signup-shell">
    <div className="signup-promise"><span className="kicker">Build your business</span><h1>Turn your skill into a trusted Nairobi brand.</h1><p>Get local work, protected payments, business tools and a portable trust record—all in one place.</p><ul><li><ShieldCheck /> Identity and skill verification</li><li><BadgeCheck /> A profile clients can trust</li><li><ArrowRight /> Smart matching, not lead chasing</li></ul></div>
    <form className="signup-form" onSubmit={(event) => { event.preventDefault(); if (step < 1) setStep(1); else void submit(); }}>
      <div className="progress"><div className="current"><span>1</span><small>Your details</small></div><div className={step > 0 ? "current" : ""}><span>2</span><small>Verification</small></div></div>
      {step === 0 ? <div className="form-panel"><h2>Create your professional profile</h2>
        <label>Full legal name<input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="As shown on your National ID" /></label>
        <div className="field-row"><label>Email address<input required type="email" autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label><label>Secure password<input required minLength={10} type="password" autoComplete="new-password" value={form.password} onChange={(event) => update("password", event.target.value)} /></label></div>
        <div className="field-row"><label>Primary trade<select value={form.trade} onChange={(event) => update("trade", event.target.value)}><option>Plumbing</option><option>Electrical</option><option>Carpentry</option><option>Painting</option><option>Cleaning</option><option>Appliance repair</option></select></label><label>Years of experience<input required value={form.years} onChange={(event) => update("years", event.target.value)} type="number" min="0" /></label></div>
        <label>Home estate<select value={form.area} onChange={(event) => update("area", event.target.value)}>{nairobiEstates.map((estate) => <option key={estate}>{estate}</option>)}</select></label>
        <label>Mobile number<input required value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+254 7..." /></label>
      </div> : <div className="form-panel"><h2>Verify your work and identity</h2><p className="form-lead">All four documents are required. Files are uploaded securely in production object storage.</p>
        {evidence.map((item) => <label className="document-upload" key={item}><FileUp /><span><strong>{item}</strong><small>{documents[item]?.name || "PDF, JPG, PNG or WebP · up to 5 MB"}</small></span><em>{documents[item] ? "Added" : "Choose file"}</em><input type="file" required accept=".pdf,image/jpeg,image/png,image/webp" onChange={(event) => { const file=event.target.files?.[0]; if(file)setDocuments((current) => ({ ...current, [item]: file })); }} /></label>)}
      </div>}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">{step > 0 ? <button type="button" className="button button-quiet" onClick={() => setStep(0)}>Back</button> : <span />}<button disabled={sending || (step === 1 && Object.keys(documents).length < evidence.length)} className="button button-dark">{sending ? "Submitting securely" : step === 0 ? "Continue" : "Submit for verification"} <ArrowRight size={16} /></button></div>
    </form>
  </main>;
}
